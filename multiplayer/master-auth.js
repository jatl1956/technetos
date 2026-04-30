/* =========================================================
   Technetos Multiplayer — Master
   Module: auth — toggleAuthMode + doLogin
   ========================================================= */

/* === AUTH === */
function toggleAuthMode() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  const nameEl = document.getElementById('auth-name');
  const btnEl = document.getElementById('btn-auth');
  const toggleEl = document.getElementById('auth-toggle');
  if (authMode === 'signup') {
    nameEl.style.display = 'block';
    btnEl.textContent = 'CREATE ACCOUNT';
    toggleEl.innerHTML = 'Already have an account? <a onclick="toggleAuthMode()">Sign In</a>';
  } else {
    nameEl.style.display = 'none';
    btnEl.textContent = 'SIGN IN';
    toggleEl.innerHTML = 'Don\'t have an account? <a onclick="toggleAuthMode()">Sign Up</a>';
  }
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
      await Auth.signUp(email, password, name, 'master');
    } else {
      await Auth.signIn(email, password);
    }
    showLobby();
  } catch (e) {
    errEl.textContent = e.message || 'Authentication failed.';
    document.getElementById('btn-auth').textContent = authMode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN';
  }
}

async function handleSignOut() {
  await Auth.signOut();
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('lobby-overlay').classList.add('hidden');
  document.getElementById('waiting-overlay').classList.add('hidden');
  document.getElementById('sim-container').classList.add('hidden');
}
