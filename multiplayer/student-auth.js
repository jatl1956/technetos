/* =========================================================
   Technetos Multiplayer — Student
   Module: auth + room join (toggleAuthMode, doLogin, joinRoom, waitForStart)
   ========================================================= */

/* === AUTH === */
function toggleAuthMode() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  document.getElementById('auth-name').style.display = authMode === 'signup' ? 'block' : 'none';
  document.getElementById('btn-auth').textContent = authMode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN';
  document.getElementById('auth-toggle').innerHTML = authMode === 'signup'
    ? 'Already have an account? <a onclick="toggleAuthMode()">Sign In</a>'
    : 'Don\'t have an account? <a onclick="toggleAuthMode()">Sign Up</a>';
  document.getElementById('auth-error').textContent = '';
}

async function handleAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name').value.trim();
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Email and password required.'; return; }
  if (authMode === 'signup' && !name) { errEl.textContent = 'Display name required.'; return; }
  try {
    document.getElementById('btn-auth').textContent = 'LOADING...';
    if (authMode === 'signup') {
      await Auth.signUp(email, password, name, 'student');
    } else {
      await Auth.signIn(email, password);
    }
    showJoinScreen();
  } catch (e) {
    errEl.textContent = e.message || 'Authentication failed.';
    document.getElementById('btn-auth').textContent = authMode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN';
  }
}

async function handleSignOut() {
  await Auth.signOut();
  RoomManager.unsubscribeAll();
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('join-overlay').classList.add('hidden');
  document.getElementById('waiting-badge').classList.add('hidden');
  document.getElementById('sim-container').classList.add('hidden');
}

/* === JOIN SCREEN === */
function showJoinScreen() {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('join-overlay').classList.remove('hidden');
  document.getElementById('join-user-email').textContent = Auth.currentUser.email;
  loadStudentHistory();
}

async function loadStudentHistory() {
  const cont = document.getElementById('student-history');
  try {
    const history = await RoomManager.getStudentHistory();
    if (history.length === 0) {
      cont.innerHTML = '<div style="color:var(--text-muted);font-size:10px;padding:12px;text-align:center;">No sessions yet. Enter a room code above.</div>';
      return;
    }
    let html = '<table class="history-table"><thead><tr><th>Session</th><th>Ticker</th><th>P&L</th><th>Status</th></tr></thead><tbody>';
    for (const h of history) {
      const pnl = h.session_metrics?.[0]?.total_pnl;
      const pnlStr = pnl != null ? (pnl >= 0 ? '+' : '') + '$' + parseFloat(pnl).toFixed(2) : '--';
      const pnlClass = pnl != null ? (pnl >= 0 ? 'price-up' : 'price-down') : '';
      html += `<tr><td>${h.rooms?.name || '--'}</td><td>${h.rooms?.ticker || '--'}</td><td class="${pnlClass}">${pnlStr}</td><td style="text-transform:uppercase;">${h.rooms?.status || '--'}</td></tr>`;
    }
    html += '</tbody></table>';
    cont.innerHTML = html;
  } catch (e) {
    cont.innerHTML = '<div style="color:var(--red);font-size:10px;padding:12px;">' + e.message + '</div>';
  }
}

/* === JOIN ROOM === */
async function joinRoom() {
  const code = document.getElementById('room-code-input').value.trim();
  const errEl = document.getElementById('join-error');
  errEl.textContent = '';
  if (!code || code.length < 4) { errEl.textContent = 'Enter a valid room code.'; return; }

  try {
    document.getElementById('btn-join').textContent = 'JOINING...';
    const result = await RoomManager.joinRoom(code);
    
    // Set portfolio cash
    portfolio.cash = parseFloat(result.room.starting_cash);
    initialPrice = parseFloat(result.room.initial_price);

    if (result.room.status === 'waiting') {
      // Show waiting screen
      document.getElementById('join-overlay').classList.add('hidden');
      document.getElementById('waiting-badge').classList.remove('hidden');
      document.getElementById('waiting-session-name').textContent = result.room.name;
      
      // Listen for room status changes (start)
      waitForStart(result.room.id);
    } else if (result.room.status === 'active') {
      startStudentSim();
    } else if (result.room.status === 'paused') {
      startStudentSim();
      showToast('Session is currently paused.', 'info');
    }
  } catch (e) {
    errEl.textContent = e.message;
    document.getElementById('btn-join').textContent = 'JOIN SESSION';
  }
}

function waitForStart(roomId) {
  // Use polling as primary (Realtime postgres_changes can be unreliable)
  var pollInterval = setInterval(async () => {
    try {
      const sb = getSupabase();
      const { data } = await sb.from('rooms').select('*').eq('id', roomId).single();
      if (data && data.status === 'active') {
        clearInterval(pollInterval);
        RoomManager.currentRoom = data;
        startStudentSim();
      }
    } catch (e) { /* silent */ }
  }, 2000);

  // Also try Realtime as bonus
  const sb = getSupabase();
  const ch = sb.channel('room_status_' + roomId)
    .on('postgres_changes', 
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        if (payload.new.status === 'active') {
          clearInterval(pollInterval);
          sb.removeChannel(ch);
          RoomManager.currentRoom = payload.new;
          startStudentSim();
        }
      }
    )
    .subscribe();
}
