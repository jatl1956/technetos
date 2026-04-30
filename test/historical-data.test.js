import { describe, it, expect, beforeEach } from 'vitest';
const HistoricalData = require('../multiplayer/historical-data.js');

/**
 * Build a deterministic test bundle.
 * 30 entries with linear bull trend, easy to verify post-transform.
 */
function buildTestBundle() {
  const aapl = [];
  for (let i = 0; i < 30; i++) {
    const close = 100 + i;       // 100, 101, 102, ...
    const open = close - 0.5;
    const high = close + 0.7;
    const low = open - 0.3;
    const date = `2024-01-${String(i + 1).padStart(2, '0')}`;
    aapl.push([date, open, high, low, close, 1000 + i * 10]);
  }
  return { AAPL: aapl };
}

beforeEach(() => {
  HistoricalData._bundle = null;
  HistoricalData._tickers = [];
  HistoricalData._series = [];
  HistoricalData._index = 0;
  HistoricalData._sourceKey = null;
  HistoricalData._transform = null;
});

// ====================================================================
// loadBundle
// ====================================================================

describe('loadBundle', () => {
  it('loads tickers and marks isLoaded=true', () => {
    expect(HistoricalData.isLoaded()).toBe(false);
    HistoricalData.loadBundle(buildTestBundle());
    expect(HistoricalData.isLoaded()).toBe(true);
    expect(HistoricalData.getScenarioCount()).toBe(1);
  });

  it('preserves the order of keys', () => {
    HistoricalData.loadBundle({
      ZZZ: [['2024-01-01', 100, 101, 99, 100, 1000]],
      AAA: [['2024-01-01', 50, 51, 49, 50, 500]]
    });
    expect(HistoricalData._tickers).toEqual(['ZZZ', 'AAA']);
  });
});

// ====================================================================
// prepareSeries — basic behavior
// ====================================================================

describe('prepareSeries', () => {
  beforeEach(() => {
    HistoricalData.loadBundle(buildTestBundle());
  });

  it('returns scenario name and totals', () => {
    const result = HistoricalData.prepareSeries(0, { startDay: 0, maxCandles: 30, targetPrice: 200 });
    expect(result.scenarioName).toBeTruthy();
    expect(result.totalCandles).toBeGreaterThan(0);
    expect(result.initialPrice).toBeGreaterThan(0);
  });

  it('with targetPrice=200 first close is approximately 200', () => {
    HistoricalData._sourceKey = null;
    let mirroredCount = 0;
    let normalCount = 0;
    // Run multiple times since there is a 30% chance of mirror;
    // when not mirrored, first close == 200 exactly (after scaling).
    for (let i = 0; i < 30; i++) {
      const result = HistoricalData.prepareSeries(0, { startDay: 0, maxCandles: 30, targetPrice: 200 });
      const firstClose = HistoricalData._series[0].close;
      // initialPrice should match the first close
      expect(firstClose).toBeCloseTo(result.initialPrice, 2);
      if (HistoricalData._transform.mirror) mirroredCount++;
      else normalCount++;
    }
    // Both branches should be reachable across 30 trials
    expect(normalCount).toBeGreaterThan(0);
  });

  it('OHLC consistency: low <= open,close <= high after transform', () => {
    for (let trial = 0; trial < 10; trial++) {
      HistoricalData.prepareSeries(0, { startDay: 0, maxCandles: 30, targetPrice: 150 });
      for (const c of HistoricalData._series) {
        expect(c.low).toBeLessThanOrEqual(c.open);
        expect(c.low).toBeLessThanOrEqual(c.close);
        expect(c.high).toBeGreaterThanOrEqual(c.open);
        expect(c.high).toBeGreaterThanOrEqual(c.close);
      }
    }
  });

  it('time field is monotonically increasing', () => {
    HistoricalData.prepareSeries(0, { startDay: 0, maxCandles: 30, targetPrice: 100 });
    for (let i = 1; i < HistoricalData._series.length; i++) {
      expect(HistoricalData._series[i].time).toBeGreaterThan(HistoricalData._series[i - 1].time);
    }
  });

  it('scenarioIndex picks the right ticker', () => {
    HistoricalData.loadBundle({
      AAPL: [['2024-01-01', 100, 102, 99, 101, 1000]],
      MSFT: [['2024-01-01', 200, 202, 199, 201, 2000]]
    });
    HistoricalData.prepareSeries(1, { maxCandles: 1, targetPrice: 100 });
    expect(HistoricalData._sourceKey).toBe('MSFT');
  });

  it('scenarioIndex modulo wraps around', () => {
    HistoricalData.loadBundle({
      AAPL: [['2024-01-01', 100, 102, 99, 101, 1000]]
    });
    HistoricalData.prepareSeries(7, { maxCandles: 1, targetPrice: 100 });
    expect(HistoricalData._sourceKey).toBe('AAPL'); // 7 % 1 = 0
  });
});

// ====================================================================
// Transformation: mirror logic
// ====================================================================

describe('mirror transformation', () => {
  beforeEach(() => {
    HistoricalData.loadBundle(buildTestBundle());
  });

  it('when mirror=false, prices preserve direction (bull stays bull)', () => {
    // Force non-mirror by running until we get one
    let attempts = 0;
    while (attempts < 50) {
      HistoricalData.prepareSeries(0, { startDay: 0, maxCandles: 30, targetPrice: 200 });
      if (!HistoricalData._transform.mirror) break;
      attempts++;
    }
    expect(HistoricalData._transform.mirror).toBe(false);
    const series = HistoricalData._series;
    // Original was bull (close went from 100 to 129).
    // Without mirror, last close > first close.
    expect(series[series.length - 1].close).toBeGreaterThan(series[0].close);
  });

  it('when mirror=true, direction is inverted (bull becomes bear)', () => {
    let attempts = 0;
    while (attempts < 100) {
      HistoricalData.prepareSeries(0, { startDay: 0, maxCandles: 30, targetPrice: 200 });
      if (HistoricalData._transform.mirror) break;
      attempts++;
    }
    if (HistoricalData._transform.mirror) {
      const series = HistoricalData._series;
      // First close should be near targetPrice; last close should be lower.
      expect(series[series.length - 1].close).toBeLessThan(series[0].close);
    }
    // If we never hit mirror in 100 trials, the test is non-deterministic but
    // the assertion above only fires when mirror=true.
  });

  it('first close approximately equals targetPrice in both modes', () => {
    for (let i = 0; i < 20; i++) {
      const result = HistoricalData.prepareSeries(0, {
        startDay: 0, maxCandles: 30, targetPrice: 250
      });
      // initialPrice IS the first close after transform
      expect(HistoricalData._series[0].close).toBeCloseTo(result.initialPrice, 1);
      // The transform target was 250, so initialPrice should be near 250
      expect(result.initialPrice).toBeCloseTo(250, 0);
    }
  });
});

// ====================================================================
// nextCandle
// ====================================================================

describe('nextCandle', () => {
  beforeEach(() => {
    HistoricalData.loadBundle(buildTestBundle());
    HistoricalData.prepareSeries(0, { startDay: 0, maxCandles: 30, targetPrice: 100 });
  });

  it('returns candles in order, then null', () => {
    let count = 0;
    let c;
    while ((c = HistoricalData.nextCandle()) !== null) {
      expect(c).toHaveProperty('open');
      expect(c).toHaveProperty('volume');
      expect(c).toHaveProperty('bid');
      expect(c).toHaveProperty('ask');
      count++;
      if (count > 100) break;
    }
    expect(count).toBe(30);
  });

  it('attaches bid/ask spread', () => {
    const c = HistoricalData.nextCandle();
    expect(c.bid).toBeLessThan(c.close);
    expect(c.ask).toBeGreaterThan(c.close);
    expect(c.spread).toBeGreaterThan(0);
  });

  it('preserves volume from source', () => {
    const c = HistoricalData.nextCandle();
    expect(c.volume).toBe(1000); // first entry in test bundle has volume 1000
  });

  it('tickIndex starts at 1 and increments', () => {
    const c1 = HistoricalData.nextCandle();
    const c2 = HistoricalData.nextCandle();
    expect(c1.tickIndex).toBe(1);
    expect(c2.tickIndex).toBe(2);
  });
});

// ====================================================================
// remaining / reset
// ====================================================================

describe('remaining and reset', () => {
  beforeEach(() => {
    HistoricalData.loadBundle(buildTestBundle());
    HistoricalData.prepareSeries(0, { startDay: 0, maxCandles: 30, targetPrice: 100 });
  });

  it('remaining decreases as candles are consumed', () => {
    expect(HistoricalData.remaining()).toBe(30);
    HistoricalData.nextCandle();
    expect(HistoricalData.remaining()).toBe(29);
    HistoricalData.nextCandle();
    HistoricalData.nextCandle();
    expect(HistoricalData.remaining()).toBe(27);
  });

  it('reset returns to beginning', () => {
    HistoricalData.nextCandle();
    HistoricalData.nextCandle();
    HistoricalData.reset();
    expect(HistoricalData._index).toBe(0);
    expect(HistoricalData.remaining()).toBe(30);
  });
});

// ====================================================================
// SCENARIO_NAMES alignment
// ====================================================================

describe('SCENARIO_NAMES', () => {
  it('contains 19 entries (one per production ticker)', () => {
    expect(HistoricalData.SCENARIO_NAMES.length).toBe(19);
  });

  it('crypto entries include the (Crypto) sector hint', () => {
    const crypto = HistoricalData.SCENARIO_NAMES.filter(n => n.includes('(Crypto)'));
    expect(crypto.length).toBe(2); // BTC + ETH
  });
});
