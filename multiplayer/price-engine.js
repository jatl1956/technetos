/* =========================================================
   Technetos Multiplayer — Price Engine
   Two modes:
   1. HISTORICAL (default): replays real OHLC market data
   2. GBM: generates synthetic prices via Geometric Brownian Motion
   Runs in the Master's browser, broadcasts via Realtime
   ========================================================= */

const PriceEngine = {
  // State
  price: 185.0,
  prevClose: 185.0,
  tickIndex: 0,
  _baseTime: 0,
  candles: [],

  // Mode: 'historical' or 'gbm'
  mode: 'historical',

  // Historical mode state
  _histScenarioName: null,
  _histTotalCandles: 0,

  params: {
    ticker: 'AAPL',
    initialPrice: 185.0,
    drift: 0.08,
    volatility: 0.25,
    tickSpeedMs: 600,
    spreadBps: 10
  },

  /** Normal random (Box-Muller) */
  _randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  },

  /** Generate realistic OHLC — GBM mode */
  _realisticOHLC(basePrice, vol, prevClose) {
    const dayVol = vol / Math.sqrt(252);
    const gapMult = 1 + (Math.random() - 0.5) * dayVol * 0.15;
    const open = prevClose * gapMult;
    const direction = Math.random() < 0.5 ? 1 : -1;
    const bodySize = dayVol * (0.2 + Math.random() * 0.6);
    const close = open * (1 + direction * bodySize);
    const body = Math.abs(close - open);
    const wickFactor = 0.3 + Math.random() * 0.5;
    const high = Math.max(open, close) + body * wickFactor * Math.random();
    const low = Math.min(open, close) - body * wickFactor * Math.random();
    return {
      open: +open.toFixed(4),
      high: +high.toFixed(4),
      low: +low.toFixed(4),
      close: +close.toFixed(4)
    };
  },

  /** GBM step */
  _gbmStep() {
    const dt = 1 / 252;
    const z = this._randn();
    const mu = this.params.drift;
    const sigma = this.params.volatility;
    const drift = (mu - 0.5 * sigma * sigma) * dt;
    const diffusion = sigma * Math.sqrt(dt) * z;
    this.price = this.price * Math.exp(drift + diffusion);
    return this.price;
  },

  /** Generate the next candle — dispatches to historical or GBM mode */
  nextCandle() {
    if (this.mode === 'historical') {
      return this._nextCandleHistorical();
    }
    return this._nextCandleGBM();
  },

  /** Historical mode: replay real market data */
  _nextCandleHistorical() {
    const raw = HistoricalData.nextCandle();
    if (!raw) return null; // series exhausted

    this.price = raw.close;
    this.prevClose = raw.close;
    this.tickIndex = raw.tickIndex;

    const candle = {
      time: raw.time,
      open: raw.open,
      high: raw.high,
      low: raw.low,
      close: raw.close,
      volume: raw.volume,
      bid: raw.bid,
      ask: raw.ask,
      spread: raw.spread,
      ticker: this.params.ticker,
      tickIndex: raw.tickIndex
    };

    this.candles.push(candle);
    return candle;
  },

  /** GBM mode: generate synthetic prices */
  _nextCandleGBM() {
    const basePrice = this._gbmStep();
    const ohlc = this._realisticOHLC(basePrice, this.params.volatility, this.prevClose);

    this.price = ohlc.close;
    this.prevClose = ohlc.close;
    this.tickIndex++;

    const spread = ohlc.close * (this.params.spreadBps / 10000);
    const bid = +(ohlc.close - spread / 2).toFixed(4);
    const ask = +(ohlc.close + spread / 2).toFixed(4);

    const candle = {
      time: this._baseTime + this.tickIndex,
      open: ohlc.open,
      high: ohlc.high,
      low: ohlc.low,
      close: ohlc.close,
      bid,
      ask,
      spread: +(ask - bid).toFixed(4),
      ticker: this.params.ticker,
      tickIndex: this.tickIndex
    };

    this.candles.push(candle);
    return candle;
  },

  /**
   * Reset the price engine.
   *
   * Fase E.1: in historical mode, the result echoes back the resolved
   * replay identity (sourceKey, startDay, mirror, targetPrice) so the
   * caller can persist it for deterministic resume.
   *
   * For deterministic resume, the caller can pass `replayIdentity`:
   *   { scenarioIndex, startDay, mirror, targetPrice }
   * which forces prepareSeries to reconstruct the exact same series.
   */
  reset(params) {
    if (params) Object.assign(this.params, params);
    this.tickIndex = 0;
    this.candles = [];
    this._lastResetResult = null;

    if (this.mode === 'historical' && typeof HistoricalData !== 'undefined' && HistoricalData.isLoaded()) {
      const scenarioIndex = params && params.scenarioIndex != null ? params.scenarioIndex : null;
      // Fase E.1: optional deterministic-resume identity
      const ri = (params && params.replayIdentity) || {};
      const result = HistoricalData.prepareSeries(scenarioIndex, {
        maxCandles: 500,
        targetPrice: ri.targetPrice != null ? ri.targetPrice : (this.params.initialPrice || null),
        startDay: ri.startDay != null ? ri.startDay : null,
        mirror: (ri.mirror === true || ri.mirror === false) ? ri.mirror : null
      });
      this._histScenarioName = result.scenarioName;
      this._histTotalCandles = result.totalCandles;
      this.price = result.initialPrice;
      this.prevClose = result.initialPrice;
      this.params.initialPrice = result.initialPrice;
      // Stash the resolved identity so callers (master-sim-start) can persist it
      this._lastResetResult = result;
    } else {
      this.mode = 'gbm';
      this.price = this.params.initialPrice;
      this.prevClose = this.params.initialPrice;
    }

    this._baseTime = Math.floor(Date.now() / 1000);
    return this._lastResetResult;
  },

  /** Update params live */
  updateParams(newParams) {
    Object.assign(this.params, newParams);
  },

  /** Get scenario info (for UI display) */
  getScenarioInfo() {
    if (this.mode === 'historical') {
      return {
        mode: 'historical',
        scenarioName: this._histScenarioName,
        totalCandles: this._histTotalCandles,
        remaining: typeof HistoricalData !== 'undefined' ? HistoricalData.remaining() : 0
      };
    }
    return { mode: 'gbm', scenarioName: null };
  }
};

// Node.js export guard — invisible in the browser. Lets unit tests import the engine.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PriceEngine;
}
