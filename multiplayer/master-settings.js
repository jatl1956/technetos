/* =========================================================
   Technetos Multiplayer — Master
   Module: settings panel (params, toggles)
   ========================================================= */

/* === SETTINGS === */
function openSettings() {
  document.getElementById('param-drift').value = PriceEngine.params.drift;
  document.getElementById('drift-val').textContent = PriceEngine.params.drift;
  document.getElementById('param-vol').value = PriceEngine.params.volatility;
  document.getElementById('vol-val').textContent = PriceEngine.params.volatility;
  document.getElementById('param-speed').value = PriceEngine.params.tickSpeedMs;
  document.getElementById('speed-val').textContent = PriceEngine.params.tickSpeedMs;
  document.getElementById('param-spread').value = PriceEngine.params.spreadBps;
  document.getElementById('spread-val').textContent = PriceEngine.params.spreadBps;
  document.getElementById('modal-overlay').classList.add('active');
}

function closeSettings() {
  document.getElementById('modal-overlay').classList.remove('active');
}

function applySettings() {
  const newParams = {
    drift: parseFloat(document.getElementById('param-drift').value),
    volatility: parseFloat(document.getElementById('param-vol').value),
    tickSpeedMs: parseInt(document.getElementById('param-speed').value),
    spreadBps: parseInt(document.getElementById('param-spread').value)
  };
  PriceEngine.updateParams(newParams);
  
  // Update sidebar
  document.getElementById('ms-drift').textContent = newParams.drift;
  document.getElementById('ms-vol').textContent = newParams.volatility;
  document.getElementById('ms-speed').textContent = newParams.tickSpeedMs + 'ms';

  // Broadcast to students
  RoomManager.broadcastParamChange(newParams);

  // Save to DB
  RoomManager.updateRoom({
    drift: newParams.drift,
    volatility: newParams.volatility,
    tick_speed_ms: newParams.tickSpeedMs,
    spread_bps: newParams.spreadBps
  });

  // Restart sim with new speed
  if (isPlaying) {
    clearTimeout(simInterval);
    startSimulation();
  }

  closeSettings();
  showToast('Parameters updated live.', 'info');
}
