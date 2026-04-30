/* =========================================================
   Technetos Multiplayer — Master
   Module: elapsed timer
   ========================================================= */

/* === ELAPSED TIMER === */
function updateElapsed() {
  if (!startTime) return;
  const elapsed = Date.now() - startTime;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  document.getElementById('ms-elapsed').textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  document.getElementById('topbar-time').textContent = new Date().toLocaleTimeString();
  requestAnimationFrame(updateElapsed);
}
