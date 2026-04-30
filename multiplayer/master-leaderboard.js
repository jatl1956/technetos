/* =========================================================
   Technetos Multiplayer — Master
   Module: periodic leaderboard update
   ========================================================= */

/* === LEADERBOARD UPDATE (periodic) === */
let leaderboardInterval;
function startLeaderboardUpdates() {
  leaderboardInterval = setInterval(async () => {
    try {
      const allParticipants = await RoomManager.getParticipants();
      // Filter out the master — only show students
      const participants = allParticipants.filter(p => p.user_id !== Auth.currentUser.id);
      const tbody = document.getElementById('leaderboard-tbody');
      document.getElementById('sim-student-count').textContent = participants.length + ' student' + (participants.length !== 1 ? 's' : '');

      if (participants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:16px;font-size:10px;">No students yet</td></tr>';
        return;
      }

      // Calculate Total Equity for each student (long + short positions)
      const lastPrice = PriceEngine.price;
      const sorted = participants.map(p => {
        const longValue = (p.shares || 0) * lastPrice;
        const shortLiability = (p.short_shares || 0) * lastPrice;
        const equity = parseFloat(p.cash) + longValue - shortLiability;
        return { ...p, equity };
      }).sort((a, b) => b.equity - a.equity);

      let html = '';
      sorted.forEach((p, i) => {
        const startCash = parseFloat(RoomManager.currentRoom.starting_cash);
        const diff = p.equity - startCash;
        const eqClass = diff >= 0 ? 'price-up' : 'price-down';
        const eqStr = '$' + p.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        html += `<tr>
          <td class="rank">${i + 1}</td>
          <td class="name">${p.display_name}</td>
          <td class="pnl ${eqClass}">${eqStr}</td>
        </tr>`;
      });
      tbody.innerHTML = html;
    } catch (e) { /* silent */ }
  }, 3000);
}
