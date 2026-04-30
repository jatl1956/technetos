/* =========================================================
   Technetos Multiplayer — Master
   Module: start simulation (begin tick loop, init engines)
   ========================================================= */

/* === START SIMULATION === */
async function startSession() {
  if (waitingPollInterval) clearInterval(waitingPollInterval);
  try {
    await RoomManager.startRoom();
    RoomManager.initBroadcast(RoomManager.currentRoom.id);
    
    document.getElementById('waiting-overlay').classList.add('hidden');
    document.getElementById('sim-container').classList.remove('hidden');

    // Set data mode
    const dataMode = window._sessionDataMode || 'historical';
    const scenarioIdx = window._sessionScenarioIndex;
    PriceEngine.mode = dataMode;

    // Init price engine. In historical mode, reset() returns the resolved
    // replay identity (sourceKey, startDay, mirror, targetPrice) so we can
    // persist it for deterministic resume.
    const resetResult = PriceEngine.reset({
      ticker: RoomManager.currentRoom.ticker,
      initialPrice: parseFloat(RoomManager.currentRoom.initial_price),
      drift: parseFloat(RoomManager.currentRoom.drift),
      volatility: parseFloat(RoomManager.currentRoom.volatility),
      tickSpeedMs: RoomManager.currentRoom.tick_speed_ms,
      spreadBps: RoomManager.currentRoom.spread_bps,
      scenarioIndex: scenarioIdx
    });

    // Init order engine params
    OrderEngine.initParams(RoomManager.currentRoom);

    // Fase E.1: persist the full replay identity (not just scenario index).
    // resetResult is null for GBM, populated for historical.
    const replayIdentity = (dataMode === 'historical' && resetResult) ? {
      sourceKey:   resetResult.sourceKey,
      startDay:    resetResult.startDay,
      mirror:      resetResult.mirror,
      targetPrice: resetResult.targetPrice
    } : null;
    RoomManager.persistMasterMode({
      dataMode,
      // For random scenarios, persist the resolved index so resume picks the
      // same ticker (otherwise scenarioIndex was null and resume would
      // re-randomize).
      scenarioIndex: replayIdentity ? resetResult.scenarioIndex : (scenarioIdx == null ? null : scenarioIdx),
      replayIdentity
    });

    // Update UI
    document.getElementById('sim-room-code').textContent = 'CODE: ' + RoomManager.currentRoom.code;
    const ticker = RoomManager.currentRoom.ticker;
    document.getElementById('ticker-sym').value = ticker;
    document.getElementById('chart-title').textContent = ticker;
    document.getElementById('ms-ticker').textContent = ticker;
    document.getElementById('ms-speed').textContent = PriceEngine.params.tickSpeedMs + 'ms';

    // Update sidebar based on mode
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
    // Margin & fees sidebar
    const sp = OrderEngine.sessionParams;
    document.getElementById('ms-leverage').textContent = sp.maxLeverage + 'x';
    document.getElementById('ms-short').textContent = sp.shortSellingEnabled ? 'ON' : 'OFF';
    document.getElementById('ms-commission').textContent = '$' + sp.commissionPerShare + '/sh';
    document.getElementById('ms-cash-rate').textContent = (sp.cashInterestRate * 100).toFixed(1) + '%';
    document.getElementById('ms-margin-rate').textContent = (sp.marginInterestRate * 100).toFixed(1) + '%';
    document.getElementById('ms-mc-grace').textContent = (sp.marginCallGraceTicks || 30) + ' ticks';

    initChart();
    startSimulation();
    startTime = Date.now();
    updateElapsed();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
