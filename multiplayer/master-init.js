/* =========================================================
   Technetos Multiplayer — Master
   Module: app init IIFE (Auth.init -> showLobby + leaderboard observer)
   ========================================================= */

/* === INIT === */
(async function init() {
  try {
    const hasSession = await Auth.init();
    if (hasSession) {
      showLobby();
    }
  } catch (e) {
    console.error('Init error:', e);
  }

  // Start leaderboard updates when sim is visible
  const observer = new MutationObserver(() => {
    if (!document.getElementById('sim-container').classList.contains('hidden')) {
      startLeaderboardUpdates();
    } else {
      clearInterval(leaderboardInterval);
    }
  });
  observer.observe(document.getElementById('sim-container'), { attributes: true, attributeFilter: ['class'] });
})();
