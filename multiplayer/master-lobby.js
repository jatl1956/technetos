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

  // Fase E: detect a resumable session (active or paused room owned by
  // this master) and surface a Resume banner. If none, hide the banner.
  await refreshResumeBanner();
}

/* Fase E: queries the DB for a resumable room and toggles the banner. */
async function refreshResumeBanner() {
  const banner = document.getElementById('resume-banner');
  if (!banner) return; // banner DOM not present yet (older HTML)
  try {
    const room = await RoomManager.getResumableRoom();
    if (!room) {
      banner.classList.add('hidden');
      return;
    }
    // Cache the room on the banner element so the click handler can use it
    // without re-querying.
    banner._room = room;
    const codeEl = document.getElementById('resume-code');
    const nameEl = document.getElementById('resume-name');
    const tickEl = document.getElementById('resume-tick');
    if (codeEl) codeEl.textContent = room.code;
    if (nameEl) nameEl.textContent = room.name || '(unnamed)';
    if (tickEl) tickEl.textContent = (room.last_tick_index || 0) + ' ticks';
    banner.classList.remove('hidden');
  } catch (e) {
    console.warn('[refreshResumeBanner] failed:', e && e.message);
    banner.classList.add('hidden');
  }
}

/* Fase E: button handler — grabs the cached room and hands off to resumeSession. */
async function handleResumeClick() {
  const banner = document.getElementById('resume-banner');
  if (!banner || !banner._room) {
    showToast('No session to resume', 'error');
    return;
  }
  await resumeSession(banner._room);
}

/* Fase E: button handler — marks the resumable room as completed and refreshes. */
async function handleDiscardResume() {
  const banner = document.getElementById('resume-banner');
  if (!banner || !banner._room) return;
  if (!confirm('Discard this session? It will be marked completed and cannot be resumed.')) return;
  try {
    RoomManager.setCurrentRoom(banner._room);
    await RoomManager.completeRoom();
    RoomManager.setCurrentRoom(null);
    banner._room = null;
    banner.classList.add('hidden');
    showToast('Session discarded', 'info');
  } catch (e) {
    showToast('Failed to discard: ' + (e && e.message), 'error');
  }
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
