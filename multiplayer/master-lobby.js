/* =========================================================
   Technetos Multiplayer — Master
   Module: lobby + create room
   ========================================================= */

/* === LOBBY === */
async function showLobby() {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('lobby-overlay').classList.remove('hidden');
  document.getElementById('lobby-user-email').textContent = Auth.currentUser.email;
  populateScenarios();  // ensure scenario dropdown is populated
}

/* === CREATE ROOM === */
async function createRoom() {
  const name = document.getElementById('room-name').value.trim();
  if (!name) { showToast('Enter a session name.', 'error'); return; }

  // Store data mode for startSession
  window._sessionDataMode = document.getElementById('lobby-data-mode').value || 'historical';
  const scenarioSel = document.getElementById('lobby-scenario').value;
  window._sessionScenarioIndex = (scenarioSel === 'random') ? null : parseInt(scenarioSel);

  const ticker = document.getElementById('lobby-ticker').value;
  const cash = parseFloat(document.getElementById('lobby-cash').value) || 100000;
  const maxLeverage = parseFloat(document.getElementById('lobby-leverage').value) || 2;
  const shortEnabled = document.getElementById('lobby-short').value === 'true';
  const maintMargin = parseFloat(document.getElementById('lobby-maint-margin').value) || 0.25;
  const commPerShare = parseFloat(document.getElementById('lobby-comm-share').value) || 0.005;
  const minComm = parseFloat(document.getElementById('lobby-min-comm').value) || 1.00;
  const cashRate = (parseFloat(document.getElementById('lobby-cash-rate').value) || 2.0) / 100;
  const marginRate = (parseFloat(document.getElementById('lobby-margin-rate').value) || 8.0) / 100;
  const mcGraceTicks = parseInt(document.getElementById('lobby-mc-grace').value) || 30;

  try {
    document.getElementById('btn-create-room').textContent = 'CREATING...';
    await RoomManager.createRoom(name, {
      ticker,
      startingCash: cash,
      maxLeverage,
      shortSellingEnabled: shortEnabled,
      maintenanceMargin: maintMargin,
      commissionPerShare: commPerShare,
      minCommission: minComm,
      cashInterestRate: cashRate,
      marginInterestRate: marginRate,
      marginCallGraceTicks: mcGraceTicks
    });
    showWaitingRoom();
  } catch (e) {
    showToast(e.message, 'error');
    document.getElementById('btn-create-room').textContent = 'CREATE SESSION';
  }
}
