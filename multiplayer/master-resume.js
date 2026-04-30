/* =========================================================
   Technetos Multiplayer — Master
   Module: resume — rehydrate a session after refresh (Fase E)
   ========================================================= */

/* === RESUME SESSION ===
 * Rehydrates a master session that was interrupted by a refresh / tab close.
 *
 * Strategy:
 *   - data_mode='historical': PriceEngine.reset with the saved scenarioIndex
 *     and then fast-forward HistoricalData._index to last_tick_index. From
 *     there the next nextCandle() returns the same candle the master would
 *     have generated next, so students see continuity.
 *   - data_mode='gbm':       PriceEngine.reset with last_close as the new
 *     initialPrice. GBM ticks are random so we can't replay them bit-for-bit;
 *     resuming from last_close avoids a price jump for the students.
 *
 * In both cases:
 *   - We resume in PAUSED state. The master sees the play button and decides
 *     when to actually resume broadcasting. This is critical because the
 *     students might also need a moment to reconnect.
 */

async function resumeSession(room) {
  try {
    document.getElementById('lobby-overlay').classList.add('hidden');
    document.getElementById('sim-container').classList.remove('hidden');

    // Adopt the room
    RoomManager.setCurrentRoom(room);
    RoomManager.initBroadcast(room.id);

    const dataMode = room.data_mode || 'historical';
    const lastTickIndex = room.last_tick_index || 0;
    const lastClose = room.last_close ? parseFloat(room.last_close) : null;

    // Re-init engines
    PriceEngine.mode = dataMode;

    if (dataMode === 'historical') {
      // Use the original initial_price so HistoricalData scales the series
      // the same way it did originally; then fast-forward.
      PriceEngine.reset({
        ticker: room.ticker,
        initialPrice: parseFloat(room.initial_price),
        drift: parseFloat(room.drift),
        volatility: parseFloat(room.volatility),
        tickSpeedMs: room.tick_speed_ms,
        spreadBps: room.spread_bps,
        scenarioIndex: room.scenario_index
      });
      // Fast-forward HistoricalData to the saved tick index. Clamp to the
      // series length in case the saved index is past the end (e.g. data
      // exhausted between save and refresh).
      if (typeof HistoricalData !== 'undefined' && HistoricalData.isLoaded()) {
        const total = HistoricalData._series.length;
        const ff = Math.min(lastTickIndex, total);
        HistoricalData._index = ff;
        PriceEngine.tickIndex = ff;
      }
    } else {
      // GBM: continue from last_close (or initial_price if we never persisted)
      const newInitial = lastClose != null ? lastClose : parseFloat(room.initial_price);
      PriceEngine.reset({
        ticker: room.ticker,
        initialPrice: newInitial,
        drift: parseFloat(room.drift),
        volatility: parseFloat(room.volatility),
        tickSpeedMs: room.tick_speed_ms,
        spreadBps: room.spread_bps
      });
      // Preserve the saved tick index so the time axis on the chart keeps
      // moving forward instead of restarting at 0.
      PriceEngine.tickIndex = lastTickIndex;
    }

    // Order engine params (commission, leverage, margin, etc.)
    OrderEngine.initParams(room);

    // Update UI labels (mirror master-sim-start.js)
    document.getElementById('sim-room-code').textContent = 'CODE: ' + room.code;
    const ticker = room.ticker;
    document.getElementById('ticker-sym').value = ticker;
    document.getElementById('chart-title').textContent = ticker;
    document.getElementById('ms-ticker').textContent = ticker;
    document.getElementById('ms-speed').textContent = PriceEngine.params.tickSpeedMs + 'ms';

    const info = PriceEngine.getScenarioInfo();
    if (info.mode === 'historical') {
      document.getElementById('ms-mode').textContent = 'Historical';
      document.getElementById('ms-scenario').textContent = info.scenarioName || 'Random';
      document.getElementById('ms-remaining').textContent = info.remaining + ' candles';
      document.getElementById('ms-scenario-row').style.display = '';
      document.getElementById('ms-remaining-row').style.display = '';
      document.getElementById('ms-drift-row').style.display = 'none';
      document.getElementById('ms-vol-row').style.display = 'none';
    } else {
      document.getElementById('ms-mode').textContent = 'GBM';
      document.getElementById('ms-scenario-row').style.display = 'none';
      document.getElementById('ms-remaining-row').style.display = 'none';
      document.getElementById('ms-drift-row').style.display = '';
      document.getElementById('ms-vol-row').style.display = '';
      document.getElementById('ms-drift').textContent = PriceEngine.params.drift;
      document.getElementById('ms-vol').textContent = PriceEngine.params.volatility;
    }
    const sp = OrderEngine.sessionParams;
    document.getElementById('ms-leverage').textContent = sp.maxLeverage + 'x';
    document.getElementById('ms-short').textContent = sp.shortSellingEnabled ? 'ON' : 'OFF';
    document.getElementById('ms-commission').textContent = '$' + sp.commissionPerShare + '/sh';
    document.getElementById('ms-cash-rate').textContent = (sp.cashInterestRate * 100).toFixed(1) + '%';
    document.getElementById('ms-margin-rate').textContent = (sp.marginInterestRate * 100).toFixed(1) + '%';
    document.getElementById('ms-mc-grace').textContent = (sp.marginCallGraceTicks || 30) + ' ticks';

    // Init chart fresh. We can't replay past candles bit-for-bit, but if we
    // have a last_close we seed a single candle so the chart isn't empty.
    initChart();
    if (lastClose != null) {
      const seed = {
        time: PriceEngine._baseTime + PriceEngine.tickIndex,
        open: lastClose,
        high: lastClose,
        low: lastClose,
        close: lastClose,
        volume: 0
      };
      candleSeries.update(seed);
      document.getElementById('ticker-price').textContent = lastClose.toFixed(2);
      document.getElementById('ms-price').textContent = '$' + lastClose.toFixed(2);
      document.getElementById('ms-candles').textContent = PriceEngine.tickIndex;
    }

    // Resume in PAUSED state. Master clicks play to actually start ticking.
    isPlaying = false;
    document.getElementById('icon-pause').style.display = 'none';
    document.getElementById('icon-play').style.display = '';
    // Mark the room paused in DB so students see consistent state.
    await RoomManager.pauseRoom();
    RoomManager.broadcastControl('pause');

    startTime = Date.now();
    updateElapsed();
    showToast('Session resumed at tick ' + PriceEngine.tickIndex + '. Press play to continue.', 'info');
  } catch (e) {
    console.error('[resumeSession] failed:', e);
    showToast('Resume failed: ' + (e && e.message), 'error');
  }
}
