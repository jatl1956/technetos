/* =========================================================
   Technetos Multiplayer — Master
   Module: waiting room (lobby for joining students)
   ========================================================= */

/* === WAITING ROOM === */
var waitingPollInterval = null;
function showWaitingRoom() {
  document.getElementById('lobby-overlay').classList.add('hidden');
  document.getElementById('waiting-overlay').classList.remove('hidden');
  document.getElementById('waiting-room-name').textContent = RoomManager.currentRoom.name;
  document.getElementById('waiting-room-code').textContent = RoomManager.currentRoom.code;

  // Subscribe to participant changes (Realtime)
  RoomManager.subscribeToParticipants(RoomManager.currentRoom.id, () => {
    refreshWaitingStudents();
  });
  // Polling fallback every 3s
  waitingPollInterval = setInterval(() => refreshWaitingStudents(), 3000);
  refreshWaitingStudents();
}

async function refreshWaitingStudents() {
  const participants = await RoomManager.getParticipants();
  const countEl = document.getElementById('waiting-student-count');
  const listEl = document.getElementById('waiting-student-list');
  countEl.textContent = participants.length + ' student' + (participants.length !== 1 ? 's' : '') + ' connected';

  if (participants.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text-muted);font-size:10px;padding:16px;text-align:center;">Waiting for students to join...</div>';
    return;
  }

  let html = '';
  for (const p of participants) {
    html += `<div class="student-item">
      <span class="student-name">${p.display_name}</span>
      <span class="student-status ${p.is_connected ? 'connected' : 'disconnected'}">${p.is_connected ? 'CONNECTED' : 'OFFLINE'}</span>
    </div>`;
  }
  listEl.innerHTML = html;
}

async function cancelSession() {
  if (waitingPollInterval) clearInterval(waitingPollInterval);
  RoomManager.unsubscribeAll();
  if (RoomManager.currentRoom) {
    await RoomManager.completeRoom();
  }
  RoomManager.currentRoom = null;
  document.getElementById('waiting-overlay').classList.add('hidden');
  document.getElementById('lobby-overlay').classList.remove('hidden');
}
