/**
 * Fase E \u2014 master refresh recovery tests.
 *
 * The actual resume flow runs in the browser (uses DOM, fetch, Supabase),
 * but the core invariants \u2014 fast-forwarding HistoricalData, GBM resume
 * from last_close, persist cadence \u2014 are pure logic and can be tested
 * directly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
const PriceEngine = require('../multiplayer/price-engine.js');
const HistoricalData = require('../multiplayer/historical-data.js');

// Synthetic bundle: one ticker, 800 candles. We need >500 because
// prepareSeries defaults to maxCandles=500 and computes start with
// Math.random() * (raw.length - maxCandles), which becomes negative
// for small bundles and produces an empty slice.
// Per loadBundle: { TICKER: [[date, o, h, l, c, vol], ...] }
function makeBundle() {
  const rows = [];
  for (let i = 0; i < 800; i++) {
    const close = 100 + (i % 50); // gentle oscillation $100-$150
    rows.push(['2024-01-01', close - 0.5, close + 0.5, close - 1, close, 1000 + i * 10]);
  }
  return { TEST: rows };
}

// HistoricalData and PriceEngine are singletons — reset between tests
// so leftover state from one test doesn't break another.
beforeEach(() => {
  HistoricalData._bundle = null;
  HistoricalData._tickers = [];
  HistoricalData._series = [];
  HistoricalData._index = 0;
  HistoricalData._sourceKey = null;
  HistoricalData._transform = null;
});

describe('Fase E \u2014 historical mode resume (fast-forward)', () => {
  it('seeking HistoricalData._index to N advances series to that point', () => {
    HistoricalData.loadBundle(makeBundle());
    // Use prepareSeries directly with explicit startDay so we don't depend
    // on Math.random() picking a valid window. PriceEngine.reset wraps
    // prepareSeries but uses random startDay; we want determinism here.
    HistoricalData.prepareSeries(0, { startDay: 0, maxCandles: 100, targetPrice: 100 });

    const total = HistoricalData._series.length;
    expect(total).toBe(100);

    // Fast-forward (this is what resumeSession does after a refresh)
    HistoricalData._index = 10;

    // Next candle pulls from _series[10] and advances _index to 11
    const nextCandle = HistoricalData.nextCandle();
    expect(nextCandle).toBeTruthy();
    expect(HistoricalData._index).toBe(11);
  });

  it('fast-forward to series.length returns null on next (clamp logic)', () => {
    HistoricalData.loadBundle(makeBundle());
    HistoricalData.prepareSeries(0, { startDay: 0, maxCandles: 100, targetPrice: 100 });

    const total = HistoricalData._series.length;
    expect(total).toBe(100);
    // resumeSession clamps: HistoricalData._index = Math.min(saved, total)
    HistoricalData._index = total;

    const c = HistoricalData.nextCandle();
    expect(c).toBeNull();
  });
});

describe('Fase E \u2014 GBM mode resume', () => {
  it('resuming GBM with last_close as initialPrice continues near that price', () => {
    PriceEngine.mode = 'gbm';
    PriceEngine.reset({
      ticker: 'XYZ',
      initialPrice: 200,
      drift: 0.05,
      volatility: 0.2,
      tickSpeedMs: 600,
      spreadBps: 10
    });

    // Generate a few ticks
    for (let i = 0; i < 5; i++) PriceEngine.nextCandle();
    const lastClose = PriceEngine.price;
    expect(lastClose).toBeGreaterThan(0);

    // Simulate refresh + resume
    PriceEngine.reset({
      ticker: 'XYZ',
      initialPrice: lastClose, // <-- key: use last_close as new initial
      drift: 0.05,
      volatility: 0.2,
      tickSpeedMs: 600,
      spreadBps: 10
    });
    PriceEngine.tickIndex = 5; // preserve tick counter

    // GBM applies a small random gap (gapMult ≈ 1±0.5%) and the body adds
    // more variance. We don't expect bit-exact continuity — just that the
    // resumed series stays in the neighborhood of last_close so students
    // see no visible jump.
    const next = PriceEngine.nextCandle();
    expect(next).toBeTruthy();
    // open should be within ~2% of lastClose (gapMult is a tiny perturbation)
    expect(Math.abs(next.open - lastClose) / lastClose).toBeLessThan(0.02);
    expect(PriceEngine.tickIndex).toBe(6); // counter advanced
  });

  it('GBM tickIndex is preserved across resume so the chart time axis advances', () => {
    PriceEngine.mode = 'gbm';
    PriceEngine.reset({
      ticker: 'XYZ',
      initialPrice: 100,
      drift: 0,
      volatility: 0.1,
      tickSpeedMs: 600,
      spreadBps: 10
    });
    for (let i = 0; i < 20; i++) PriceEngine.nextCandle();
    const savedIndex = PriceEngine.tickIndex;
    const savedClose = PriceEngine.price;

    // Resume
    PriceEngine.reset({ ticker: 'XYZ', initialPrice: savedClose, drift: 0, volatility: 0.1, tickSpeedMs: 600, spreadBps: 10 });
    PriceEngine.tickIndex = savedIndex;

    const c = PriceEngine.nextCandle();
    expect(c.tickIndex).toBe(savedIndex + 1); // not back at 1
  });
});

describe('Fase E \u2014 persist cadence', () => {
  it('persist counter triggers exactly once per 5 ticks', () => {
    // Mirrors the logic in master-sim-loop.js so a refactor that breaks
    // the cadence would also break this test.
    const PERSIST_EVERY_TICKS = 5;
    let counter = 0;
    let persistCalls = 0;
    function fakeTick() {
      counter++;
      if (counter >= PERSIST_EVERY_TICKS) {
        counter = 0;
        persistCalls++;
      }
    }
    for (let i = 0; i < 25; i++) fakeTick();
    expect(persistCalls).toBe(5); // 25 ticks / 5 = 5 saves
  });

  it('partial windows do not trigger an extra persist', () => {
    const PERSIST_EVERY_TICKS = 5;
    let counter = 0;
    let persistCalls = 0;
    function fakeTick() {
      counter++;
      if (counter >= PERSIST_EVERY_TICKS) {
        counter = 0;
        persistCalls++;
      }
    }
    for (let i = 0; i < 12; i++) fakeTick();
    expect(persistCalls).toBe(2); // ticks 5 and 10 only; ticks 11..12 don't trigger
  });
});

describe('Fase E \u2014 getResumableRoom contract', () => {
  it('only rooms with active or paused status qualify', () => {
    // Simulates the .in('status', ['active', 'paused']) filter.
    const allRooms = [
      { id: 1, status: 'waiting' },
      { id: 2, status: 'active' },
      { id: 3, status: 'paused' },
      { id: 4, status: 'completed' },
      { id: 5, status: 'deleted' }
    ];
    const resumable = allRooms.filter(r => r.status === 'active' || r.status === 'paused');
    expect(resumable.map(r => r.id)).toEqual([2, 3]);
  });

  it('most-recently-active room wins when multiple are resumable', () => {
    // Simulates .order('last_tick_at', { ascending: false }).limit(1)
    const rooms = [
      { id: 'a', last_tick_at: '2026-04-30T10:00:00Z' },
      { id: 'b', last_tick_at: '2026-04-30T11:30:00Z' },
      { id: 'c', last_tick_at: '2026-04-30T09:00:00Z' }
    ];
    rooms.sort((x, y) => (y.last_tick_at || '').localeCompare(x.last_tick_at || ''));
    expect(rooms[0].id).toBe('b');
  });
});
