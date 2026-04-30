/* =========================================================
   Technetos Multiplayer — Student
   Module: offline beacon on tab close (Fase D / D.2)
   ========================================================= */


/* === Fase D / D.2: mark disconnected on tab close ===
 * Uses fetch(keepalive) so the PATCH reliably leaves the browser even after
 * the page starts unloading. Authorization MUST be the user's access token
 * (not the anon key) because participants is RLS-scoped to user_id.
 *
 * The token is cached on `window._cachedAccessToken` by Auth (see auth.js),
 * which updates on init / signIn / signUp / TOKEN_REFRESHED / signOut.
 *
 * Persistence of portfolio state happens on every fill and every 5s, so
 * a refresh keeps everything intact regardless of whether this beacon fires.
 */
function _sendOfflineBeacon() {
  if (!RoomManager.currentParticipant) return;
  // Without a valid user token, RLS will reject the PATCH (zero rows affected).
  // Bail out early instead of sending a request that we know will be ignored.
  const accessToken = window._cachedAccessToken;
  if (!accessToken) return;

  const url = window.SUPABASE_URL + '/rest/v1/participants?id=eq.' + RoomManager.currentParticipant.id;
  const headers = {
    'apikey': window.SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };
  const body = JSON.stringify({ is_connected: false });

  // Preferred: fetch(keepalive). PATCH supported and survives unload.
  if (typeof fetch === 'function') {
    try {
      fetch(url, { method: 'PATCH', headers, body, keepalive: true });
      return;
    } catch (_) { /* fall through */ }
  }
  // Last resort: sendBeacon (POST only, won't update via PATCH but at least leaves a trace).
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
  }
}
window.addEventListener('pagehide', _sendOfflineBeacon);
window.addEventListener('beforeunload', _sendOfflineBeacon);
