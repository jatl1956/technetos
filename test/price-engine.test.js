import { describe, it, expect, beforeEach } from 'vitest';
const PriceEngine = require('../multiplayer/price-engine.js');
const HistoricalData = require('../multiplayer/historical-data.js');

// PriceEngine references HistoricalData via the global. In Node, expose it.
globalThis.HistoricalData = HistoricalData;

beforeEach(() => {
  PriceEngine.mode = 'gbm';
  PriceEngine.params = {
    ticker: 'TEST',
    initialPrice: 100.0,
    drift: 0.08,
    volatility: 0.25,
    tickSpeedMs: 600,
    spreadBps: 10
  };
  PriceEngine.candles = [];
});

// ====================================================================
// reset
// ====================================================================

describe('reset', () => {
  it('GBM mode: resets price/prevClose/tickIndex/candles', () => {
    PriceEngine.mode = 'gbm';
    PriceEngine.reset({ initialPrice: 200 });
    expect(PriceEngine.price).toBe(200);
    expect(PriceEngine.prevClose).toBe(200);
    expect(PriceEngine.tickIndex).toBe(0);
    expect(PriceEngine.candles).toEqual([]);
  });

  it('historical mode without bundle falls back to GBM', () => {
    HistoricalData._bundle = null;
    HistoricalData._tickers = [];
    PriceEngine.mode = 'historical';
    PriceEngine.reset({ initialPrice: 150 });
    // Should silently fall back to gbm
    expect(PriceEngine.mode).toBe('gbm');
    expect(PriceEngine.price).toBe(150);
  });
});

// ====================================================================
// nextCandle - GBM mode
// ====================================================================

describe('nextCandle (GBM)', () => {
  beforeEach(() => {
    PriceEngine.mode = 'gbm';
    PriceEngine.reset({ initialPrice: 100 });
  });

  it('returns a candle with all required fields', () => {
    const c = PriceEngine.nextCandle();
    expect(c).toHaveProperty('time');
    expect(c).toHaveProperty('open');
    expect(c).toHaveProperty('high');
    expect(c).toHaveProperty('low');
    expect(c).toHaveProperty('close');
    expect(c).toHaveProperty('bid');
    expect(c).toHaveProperty('ask');
    expect(c).toHaveProperty('spread');
    expect(c).toHaveProperty('ticker');
    expect(c).toHaveProperty('tickIndex');
  });

  it('OHLC consistency: low <= open,close <= high', () => {
    for (let i = 0; i < 50; i++) {
      const c = PriceEngine.nextCandle();
      expect(c.low).toBeLessThanOrEqual(c.open);
      expect(c.low).toBeLessThanOrEqual(c.close);
      expect(c.high).toBeGreaterThanOrEqual(c.open);
      expect(c.high).toBeGreaterThanOrEqual(c.close);
    }
  });

  it('bid < close < ask, spread > 0', () => {
    for (let i = 0; i < 20; i++) {
      const c = PriceEngine.nextCandle();
      expect(c.bid).toBeLessThan(c.close);
      expect(c.ask).toBeGreaterThan(c.close);
      expect(c.spread).toBeGreaterThan(0);
    }
  });

  it('spread matches spreadBps configuration', () => {
    PriceEngine.params.spreadBps = 20; // 20 bps = 0.2%
    PriceEngine.reset({ initialPrice: 100 });
    const c = PriceEngine.nextCandle();
    // spread should be roughly close * 0.2% = ~0.2 (close to 100)
    const expectedSpread = c.close * 0.002;
    expect(c.spread).toBeCloseTo(expectedSpread, 3);
  });

  it('tickIndex monotonically increases', () => {
    const c1 = PriceEngine.nextCandle();
    const c2 = PriceEngine.nextCandle();
    const c3 = PriceEngine.nextCandle();
    expect(c2.tickIndex).toBe(c1.tickIndex + 1);
    expect(c3.tickIndex).toBe(c2.tickIndex + 1);
  });

  it('time is monotonically increasing (lightweight-charts requirement)', () => {
    const candles = [];
    for (let i = 0; i < 10; i++) candles.push(PriceEngine.nextCandle());
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].time).toBeGreaterThan(candles[i - 1].time);
    }
  });

  it('candles are pushed to internal history', () => {
    PriceEngine.reset({ initialPrice: 100 });
    expect(PriceEngine.candles).toHaveLength(0);
    PriceEngine.nextCandle();
    PriceEngine.nextCandle();
    PriceEngine.nextCandle();
    expect(PriceEngine.candles).toHaveLength(3);
  });

  it('all numeric fields are finite numbers (no NaN/Infinity)', () => {
    for (let i = 0; i < 20; i++) {
      const c = PriceEngine.nextCandle();
      expect(Number.isFinite(c.open)).toBe(true);
      expect(Number.isFinite(c.high)).toBe(true);
      expect(Number.isFinite(c.low)).toBe(true);
      expect(Number.isFinite(c.close)).toBe(true);
      expect(Number.isFinite(c.bid)).toBe(true);
      expect(Number.isFinite(c.ask)).toBe(true);
    }
  });
});

// ====================================================================
// nextCandle - Historical mode
// ====================================================================

describe('nextCandle (Historical)', () => {
  beforeEach(() => {
    // Load a small known bundle
    HistoricalData.loadBundle({
      TEST: [
        ['2024-01-01', 100, 102, 99,  101, 1000],
        ['2024-01-02', 101, 104, 100, 103, 1100],
        ['2024-01-03', 103, 105, 102, 104, 1200],
        ['2024-01-04', 104, 106, 103, 105, 1300],
        ['2024-01-05', 105, 107, 104, 106, 1400]
      ]
    });
    PriceEngine.mode = 'historical';
    PriceEngine.reset({ initialPrice: 100, scenarioIndex: 0 });
  });

  it('returns a candle from the historical bundle', () => {
    const c = PriceEngine.nextCandle();
    expect(c).not.toBeNull();
    expect(c).toHaveProperty('volume');
    expect(c.volume).toBeGreaterThan(0);
  });

  it('returns null when series exhausted', () => {
    let count = 0;
    let c;
    while ((c = PriceEngine.nextCandle()) !== null) {
      count++;
      if (count > 100) break; // safety
    }
    expect(count).toBeLessThan(10); // we only have 5 candles
    expect(c).toBeNull();
  });

  it('OHLC consistency holds after price transformation', () => {
    let c;
    while ((c = PriceEngine.nextCandle()) !== null) {
      expect(c.low).toBeLessThanOrEqual(c.open);
      expect(c.low).toBeLessThanOrEqual(c.close);
      expect(c.high).toBeGreaterThanOrEqual(c.open);
      expect(c.high).toBeGreaterThanOrEqual(c.close);
    }
  });

  it('volume is preserved from source', () => {
    const c1 = PriceEngine.nextCandle();
    expect(c1.volume).toBe(1000);
    const c2 = PriceEngine.nextCandle();
    expect(c2.volume).toBe(1100);
  });
});

// ====================================================================
// getScenarioInfo
// ====================================================================

describe('getScenarioInfo', () => {
  it('GBM mode returns mode without scenario name', () => {
    PriceEngine.mode = 'gbm';
    const info = PriceEngine.getScenarioInfo();
    expect(info.mode).toBe('gbm');
    expect(info.scenarioName).toBeNull();
  });

  it('historical mode returns scenario name when loaded', () => {
    HistoricalData.loadBundle({ TEST: [['2024-01-01', 100, 102, 99, 101, 1000]] });
    PriceEngine.mode = 'historical';
    PriceEngine.reset({ initialPrice: 100, scenarioIndex: 0 });
    const info = PriceEngine.getScenarioInfo();
    expect(info.mode).toBe('historical');
    expect(info.scenarioName).toBeTruthy();
  });
});
