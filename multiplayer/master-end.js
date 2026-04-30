/* =========================================================
   Technetos Multiplayer — Master
   Module: end session
   ========================================================= */

/* === END SESSION === */
async function endSession() {
  if (!confirm('End this session? Students will be disconnected.')) return;
  isPlaying = false;
  clearTimeout(simInterval);
  RoomManager.broadcastControl('end');
  // Mark as deleted so it disappears completely
  try {
    const sb = SupabaseConfig.getClient();
    await sb.from('rooms').update({ status: 'deleted', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', RoomManager.currentRoom.id);
  } catch (e) { /* fallback: at least complete it */ await RoomManager.completeRoom(); }
  RoomManager.unsubscribeAll();
  RoomManager.currentRoom = null;

  document.getElementById('sim-container').classList.add('hidden');
  document.getElementById('lobby-overlay').classList.remove('hidden');
  showToast('Session ended and removed.', 'info');
}
