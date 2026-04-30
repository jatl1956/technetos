/* =========================================================
   Technetos Multiplayer — Student
   Module: server-side order processing (processWorkingOrders)
   ========================================================= */

/* === ORDER PROCESSING === */
function processLocalOrders(tick) {
  const working = portfolio.orders.filter(o => o.status === 'WORKING');
  const fills = OrderEngine.processOrders(working, tick, portfolio);

  for (const fill of fills) {
    const order = portfolio.orders.find(o => o.id === fill.orderId);
    if (!order) continue;
    order.status = 'FILLED';
    order.avg_fill_price = fill.fillPrice;

    // Apply fill using OrderEngine (handles BUY, SELL, SHORT_SELL, BUY_TO_COVER)
    OrderEngine.applyFill(fill, portfolio);

    const sideLabels = { BUY: 'BUY', SELL: 'SELL', SHORT_SELL: 'SHORT', BUY_TO_COVER: 'COVER' };
    portfolio.executions.unshift({
      time: new Date().toLocaleTimeString(),
      side: fill.side,
      type: order.order_type,
      qty: fill.qty,
      fillPrice: fill.fillPrice,
      value: fill.value,
      commission: fill.commission
    });

    const commStr = fill.commission > 0 ? ` (comm: $${fill.commission.toFixed(2)})` : '';
    showToast(`${sideLabels[fill.side] || fill.side} ${fill.qty} @ $${fill.fillPrice.toFixed(2)} FILLED${commStr}`, 'fill');

    // Async save to DB (fire and forget)
    OrderEngine.recordFill(fill, RoomManager.currentRoom.id, RoomManager.currentParticipant.id);
    OrderEngine.updateParticipant(RoomManager.currentParticipant.id, {
      cash: portfolio.cash,
      shares: portfolio.shares,
      avg_cost: portfolio.avgCost,
      short_shares: portfolio.shortShares,
      short_avg_cost: portfolio.shortAvgCost,
      realized_pnl: portfolio.realizedPnl,
      total_commissions: portfolio.totalCommissions,
      accrued_interest: portfolio.accruedCashInterest,
      accrued_margin_interest: portfolio.accruedMarginInterest,
      last_seen_tick: lastTick ? lastTick.tickIndex || 0 : 0
    });
  }

  updateOrdersDisplay();
  updateExecutionsDisplay();
  updatePositionsDisplay();
}
