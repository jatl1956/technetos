/* =========================================================
   Technetos Multiplayer — Student
   Module: margin call banner + forced liquidation UI
   ========================================================= */

/* === MARGIN CALL BANNER & LIQUIDATION === */
function showMarginCallBanner(show) {
  const banner = document.getElementById('margin-call-banner');
  if (banner) banner.style.display = show ? 'block' : 'none';
  // Dim the BUY and SHORT buttons when in margin call
  const btnSubmit = document.getElementById('btn-submit-order');
  if (btnSubmit && show && OrderEngine.isOpeningOrder(currentSide)) {
    btnSubmit.style.opacity = '0.4';
    btnSubmit.style.pointerEvents = 'none';
  } else if (btnSubmit && !show) {
    btnSubmit.style.opacity = '1';
    btnSubmit.style.pointerEvents = 'auto';
  }
}

function updateMarginCallBanner() {
  const countdown = document.getElementById('mc-countdown');
  const progress = document.getElementById('mc-progress');
  const msg = document.getElementById('mc-message');
  if (!countdown || !progress) return;

  const t = marginCallState.ticksRemaining;
  const total = marginCallState.totalGraceTicks;

  if (marginCallState.liquidationExecuted) {
    countdown.textContent = 'LIQUIDATED';
    progress.style.width = '100%';
    progress.style.background = '#ff0000';
    msg.textContent = 'Positions force-closed by broker';
  } else {
    countdown.textContent = t + ' ticks remaining';
    const pct = total > 0 ? ((total - t) / total) * 100 : 100;
    progress.style.width = pct + '%';
    progress.style.background = pct > 70 ? '#ff0000' : '#ff9900';
    msg.textContent = t <= 5 ? 'IMMINENT LIQUIDATION — Close positions NOW!' : 'Close positions to restore margin';
  }
}

function executeForcedLiquidation(tick) {
  const price = tick.close;
  const liquidations = OrderEngine.generateLiquidationOrders(portfolio, price);

  if (liquidations.length === 0) return;

  showToast('FORCED LIQUIDATION — Broker is closing your positions!', 'error');

  for (const liq of liquidations) {
    const fillPrice = (liq.side === 'SELL' || liq.side === 'SHORT_SELL') ? tick.bid : tick.ask;
    const fill = {
      orderId: 'LIQUIDATION-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
      side: liq.side,
      qty: liq.qty,
      fillPrice: +fillPrice.toFixed(4),
      value: +(fillPrice * liq.qty).toFixed(2),
      commission: +OrderEngine.calcCommission(liq.qty).toFixed(2)
    };

    // Apply fill to portfolio
    OrderEngine.applyFill(fill, portfolio);

    // Record in executions list (same structure as regular fills)
    portfolio.executions.unshift({
      time: new Date().toLocaleTimeString(),
      side: fill.side,
      type: 'LIQUIDATION',
      qty: fill.qty,
      fillPrice: fill.fillPrice,
      value: fill.value,
      commission: fill.commission,
      _liquidation: true
    });

    showToast(`LIQUIDATED: ${liq.side} ${liq.qty} @ ${fillPrice.toFixed(2)}`, 'error');
  }

  // Sync to DB
  const prt = portfolio;
  const p = lastTick ? lastTick.close : 100;
  OrderEngine.updateParticipant(RoomManager.currentParticipant.id, {
    cash: prt.cash,
    shares: prt.shares,
    avg_cost: prt.avgCost,
    short_shares: prt.shortShares,
    short_avg_cost: prt.shortAvgCost,
    realized_pnl: prt.realizedPnl,
    total_commissions: prt.totalCommissions,
    accrued_interest: prt.accruedCashInterest,
    accrued_margin_interest: prt.accruedMarginInterest,
    last_seen_tick: lastTick ? lastTick.tickIndex || 0 : 0
  });

  updateAccountDisplay();
  updateOrdersDisplay();
}
