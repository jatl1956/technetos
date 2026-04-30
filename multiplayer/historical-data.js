/* =========================================================
   Technetos — Historical Data Engine
   Loads real OHLC data, transforms prices to be unrecognizable,
   and replays candle-by-candle as if real-time.
   ========================================================= */

const HistoricalData = {
  // Raw bundle: { TICKER: [[date,o,h,l,c,vol], ...], ... }
  _bundle: null,
  _tickers: [],

  // Active replay state
  _series: [],       // transformed candles for current session
  _index: 0,         // current position in _series
  _sourceKey: null,   // which ticker was selected (internal, not exposed)
  _transform: null,   // { scale, offset } applied

  // Scenario names — fictitious for students, with sector hint for professor
  // Order matches alphabetical ticker keys: AAPL, AMD, AMZN, BA, BAC, BTCUSD, CVX, ETHUSD, GOOGL, GS, JNJ, JPM, KO, MSFT, NVDA, PFE, SPY, TSLA, XOM
  SCENARIO_NAMES: [
    'Quantum Corp (Tech)',         // AAPL
    'Echo Robotics (Tech)',        // AMD
    'Nexus Digital (Consumer)',     // AMZN
    'Sterling Motors (Industrial)',// BA
    'Polaris Finance (Banking)',   // BAC
    'Cobalt Chain (Crypto)',       // BTCUSD
    'Vertex Energy (Energy)',      // CVX
    'Meridian Chain (Crypto)',     // ETHUSD
    'NovaTech (Tech)',             // GOOGL
    'Zenith Capital (Banking)',    // GS
    'Atlas Bio (Healthcare)',      // JNJ
    'Orion Holdings (Banking)',    // JPM
    'Pinnacle Foods (Consumer)',   // KO
    'Apex Industries (Tech)',      // MSFT
    'Titan Dynamics (Tech)',       // NVDA
    'Crescent Pharma (Healthcare)',// PFE
    'Vanguard Index (Index)',      // SPY
    'Helix Motors (Volatile)',     // TSLA
    'Sapphire Mining (Energy)'    // XOM
  ],

  /** Load the bundle (called once at page load) */
  loadBundle(bundleData) {
    this._bundle = bundleData;
    this._tickers = Object.keys(bundleData);
    console.log(`[HistoricalData] Loaded ${this._tickers.length} series`);
  },

  /** Check if bundle is loaded */
  isLoaded() {
    return this._bundle !== null && this._tickers.length > 0;
  },

  /** Get available scenario count */
  getScenarioCount() {
    return this._tickers.length;
  },

  /**
   * Select and prepare a series for playback.
   *
   * Fase E.1: this function takes 4 "replay identity" inputs that fully
   * determine the resulting series. The returned object echoes all four
   * back so the caller can persist them and reproduce the exact same
   * series later (deterministic resume).
   *
   * @param {number|null} scenarioIndex — null = random ticker, otherwise index into _tickers
   * @param {object} opts
   *   @prop {number|null} startDay   — row in raw CSV; null = random
   *   @prop {number}      maxCandles — default 500
   *   @prop {number|null} targetPrice — null = random $80–$300
   *   @prop {boolean|null} mirror    — null = random 30%, otherwise force
   * @returns {object} resolved replay identity + series metadata:
   *   { scenarioName, totalCandles, initialPrice,
   *     scenarioIndex, sourceKey, startDay, mirror, targetPrice }
   */
  prepareSeries(scenarioIndex, opts = {}) {
    if (!this.isLoaded()) throw new Error('Historical data not loaded');

    const {
      startDay = null,
      maxCandles = 500,
      targetPrice = null,
      mirror = null
    } = opts;

    // Pick ticker
    const resolvedScenarioIdx = (scenarioIndex !== null && scenarioIndex !== undefined)
      ? scenarioIndex % this._tickers.length
      : Math.floor(Math.random() * this._tickers.length);

    this._sourceKey = this._tickers[resolvedScenarioIdx];
    const raw = this._bundle[this._sourceKey]; // [[date,o,h,l,c,vol], ...]

    // Pick start point
    const maxStart = Math.max(0, raw.length - 50); // ensure at least 50 candles
    const resolvedStart = startDay !== null && startDay !== undefined
      ? Math.min(Math.max(0, startDay), maxStart)
      : Math.floor(Math.random() * Math.max(1, raw.length - maxCandles));

    const end = Math.min(resolvedStart + maxCandles, raw.length);
    const slice = raw.slice(resolvedStart, end);

    // Transform: scale prices so first close ≈ target price
    const firstClose = slice[0][4]; // index 4 = close
    const resolvedTarget = (targetPrice !== null && targetPrice !== undefined)
      ? targetPrice
      : (80 + Math.random() * 220); // random $80–$300
    const scale = resolvedTarget / firstClose;

    // Optional: mirror the series. Caller can force true/false; otherwise
    // randomize 30% of the time.
    const resolvedMirror = (mirror === true || mirror === false)
      ? mirror
      : (Math.random() < 0.30);

    this._transform = { scale, mirror: resolvedMirror, targetPrice: resolvedTarget };
    this._series = [];
    this._index = 0;

    // Base time for chart X-axis
    const baseTime = Math.floor(Date.now() / 1000);

    for (let i = 0; i < slice.length; i++) {
      const [date, rawO, rawH, rawL, rawC, rawVol] = slice[i];

      let o, h, l, c;
      if (resolvedMirror && i > 0) {
        // Mirror: invert price changes relative to first candle
        // price_mirrored = 2 * firstClose - price_original (then scale)
        const pivot = firstClose;
        o = (2 * pivot - rawO) * scale;
        h = (2 * pivot - rawL) * scale; // high becomes mirrored low
        l = (2 * pivot - rawH) * scale; // low becomes mirrored high
        c = (2 * pivot - rawC) * scale;
      } else {
        o = rawO * scale;
        h = rawH * scale;
        l = rawL * scale;
        c = rawC * scale;
      }

      // Ensure OHLC consistency after transform
      const realHigh = Math.max(o, h, l, c);
      const realLow = Math.min(o, h, l, c);

      this._series.push({
        time: baseTime + i,
        open: +o.toFixed(2),
        high: +realHigh.toFixed(2),
        low: +realLow.toFixed(2),
        close: +c.toFixed(2),
        volume: rawVol,
        _originalDate: date
      });
    }

    const scenarioName = this.SCENARIO_NAMES[resolvedScenarioIdx] || ('Scenario ' + (resolvedScenarioIdx + 1));
    return {
      scenarioName,
      totalCandles: this._series.length,
      initialPrice: this._series[0].close,
      // Replay identity — persist these to reproduce the same series later
      scenarioIndex: resolvedScenarioIdx,
      sourceKey: this._sourceKey,
      startDay: resolvedStart,
      mirror: resolvedMirror,
      targetPrice: resolvedTarget
    };
  },

  /**
   * Get the next candle for playback.
   * Returns null when series is exhausted.
   */
  nextCandle() {
    if (this._index >= this._series.length) return null;
    
    const candle = this._series[this._index];
    this._index++;

    // Add bid/ask spread (10 bps)
    const spreadBps = 10;
    const spread = candle.close * (spreadBps / 10000);
    candle.bid = +(candle.close - spread / 2).toFixed(2);
    candle.ask = +(candle.close + spread / 2).toFixed(2);
    candle.spread = +(candle.ask - candle.bid).toFixed(4);
    candle.tickIndex = this._index;

    return candle;
  },

  /** How many candles remain */
  remaining() {
    return this._series.length - this._index;
  },

  /** Current index */
  currentIndex() {
    return this._index;
  },

  /** Reset playback to beginning */
  reset() {
    this._index = 0;
  }
};

// Node.js export guard — invisible in the browser. Lets unit tests import the engine.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoricalData;
}
