/* =========================================================
   Technetos Multiplayer — Master
   Module: toast notifications
   ========================================================= */

/* === TOAST === */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
