/* =========================================================
   Technetos Multiplayer — Student
   Module: app init IIFE (Auth.init, showJoinScreen / restore session)
   ========================================================= */

/* === INIT === */
(async function init() {
  try {
    const hasSession = await Auth.init();
    if (hasSession) {
      showJoinScreen();
    }
  } catch (e) {
    console.error('Init error:', e);
  }
})();
