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

  // Scenario names — fictitious, so students can't identify the real ticker
  SCENARIO_NAMES: [
    'Quantum Corp', 'Apex Industries', 'NovaTech', 'Orion Holdings',
    'Titan Dynamics', 'Vertex Energy', 'Cobalt Systems', 'Meridian Group',
    'Zenith Capital', 'Atlas Bio', 'Helix Networks', 'Polaris Finance',
    'Vanguard Micro', 'Crescent Pharma', 'Sterling Motors', 'Nexus Digital',
    'Sapphire Mining', 'Echo Robotics', 'Pinnacle Foods'
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
   * @param {number|null} scenarioIndex - null = random, 0-18 = specific scenario
   * @param {object} opts - { startDay, maxCandles, targetPrice }
   *   startDay: where in the series to start (default: random)
   *   maxCandles: max candles to replay (default: 500)
   *   targetPrice: transform so first candle's close ≈ this price (default: 100-300 random)
   * @returns {object} { scenarioName, totalCandles }
   */
  prepareSeries(scenarioIndex, opts = {}) {
    if (!this.isLoaded()) throw new Error('Historical data not loaded');

    const {
      startDay = null,
      maxCandles = 500,
      targetPrice = null
    } = opts;

    // Pick ticker
    const idx = (scenarioIndex !== null && scenarioIndex !== undefined)
      ? scenarioIndex % this._tickers.length
      : Math.floor(Math.random() * this._tickers.length);
    
    this._sourceKey = this._tickers[idx];
    const raw = this._bundle[this._sourceKey]; // [[date,o,h,l,c,vol], ...]

    // Pick start point
    const maxStart = Math.max(0, raw.length - 50); // ensure at least 50 candles
    const start = startDay !== null
      ? Math.min(startDay, maxStart)
      : Math.floor(Math.random() * Math.max(1, raw.length - maxCandles));
    
    const end = Math.min(start + maxCandles, raw.length);
    const slice = raw.slice(start, end);

    // Transform: scale prices so first close ≈ target price
    const firstClose = slice[0][4]; // index 4 = close
    const target = targetPrice || (80 + Math.random() * 220); // random $80-$300
    const scale = target / firstClose;

    // Optional: randomly flip (mirror) the series ~30% of the time
    const mirror = Math.random() < 0.30;

    this._transform = { scale, mirror, targetPrice: target };
    this._series = [];
    this._index = 0;

    // Base time for chart X-axis
    const baseTime = Math.floor(Date.now() / 1000);

    for (let i = 0; i < slice.length; i++) {
      const [date, rawO, rawH, rawL, rawC, rawVol] = slice[i];
      
      let o, h, l, c;
      if (mirror && i > 0) {
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

    const scenarioName = this.SCENARIO_NAMES[idx] || ('Scenario ' + (idx + 1));
    return {
      scenarioName,
      totalCandles: this._series.length,
      initialPrice: this._series[0].close
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
