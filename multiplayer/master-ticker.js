/* =========================================================
   Technetos Multiplayer — Master
   Module: change ticker + data mode & scenario helpers
   ========================================================= */

/* === CHANGE TICKER — restarts with a new random scenario === */
function changeTicker(val) {
  // Update display name
  document.getElementById('chart-title').textContent = val;
  document.getElementById('ms-ticker').textContent = val;
  PriceEngine.params.ticker = val;
  RoomManager.broadcastParamChange({ ticker: val });

  // If historical mode, restart with a new random scenario
  if (PriceEngine.mode === 'historical') {
    // Pause, clear chart, prepare new series
    isPlaying = false;
    clearTimeout(simInterval);

    PriceEngine.reset({
      ticker: val,
      initialPrice: null,  // let historical engine pick
      tickSpeedMs: PriceEngine.params.tickSpeedMs,
      spreadBps: PriceEngine.params.spreadBps,
      scenarioIndex: null  // random
    });

    // Clear chart data
    candleSeries.setData([]);
    if (volumeSeries) volumeSeries.setData([]);
    TAEngine.clearAll();

    // Update sidebar
    const info = PriceEngine.getScenarioInfo();
    document.getElementById('ms-scenario').textContent = info.scenarioName || 'Random';
    document.getElementById('ms-remaining').textContent = info.remaining + ' candles';
    document.getElementById('ms-price').textContent = '$' + PriceEngine.price.toFixed(2);
    document.getElementById('ms-candles').textContent = '0';

    // Update topbar initial price for change calculation
    document.getElementById('ticker-price').textContent = PriceEngine.price.toFixed(2);
    document.getElementById('ticker-change').textContent = '+0.00';
    document.getElementById('ticker-pct').textContent = '(0.00%)';

    // Broadcast reset to students
    RoomManager.broadcastControl('reset');

    // Resume
    startSimulation();
    showToast('New scenario: ' + info.scenarioName, 'info');
  }
}

/* === DATA MODE & SCENARIO HELPERS === */
function onDataModeChange(mode) {
  const scenarioSel = document.getElementById('lobby-scenario');
  if (mode === 'historical') {
    populateScenarios();
    scenarioSel.parentElement.style.display = '';
  } else {
    scenarioSel.parentElement.style.display = 'none';
  }
}
function populateScenarios() {
  const sel = document.getElementById('lobby-scenario');
  sel.innerHTML = '<option value="random">Random</option>';
  if (HistoricalData.isLoaded()) {
    const names = HistoricalData.SCENARIO_NAMES;
    for (let i = 0; i < names.length; i++) {
      sel.innerHTML += '<option value="' + i + '">' + names[i] + '</option>';
    }
  }
}
// Populate scenarios after a tick (ensures bundle is loaded)
setTimeout(function() {
  if (typeof HistoricalData !== 'undefined' && HistoricalData.isLoaded()) {
    populateScenarios();
  }
}, 100);
