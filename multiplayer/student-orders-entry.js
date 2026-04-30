/* =========================================================
   Technetos Multiplayer — Student
   Module: order entry UI + submission (submitOrder, side/type buttons)
   ========================================================= */

/* === ORDER ENTRY === */
function setSide(side) {
  currentSide = side;
  document.getElementById('btn-buy').classList.toggle('active', side === 'BUY');
  document.getElementById('btn-sell').classList.toggle('active', side === 'SELL');
  document.getElementById('btn-short').classList.toggle('active', side === 'SHORT_SELL');
  document.getElementById('btn-cover').classList.toggle('active', side === 'BUY_TO_COVER');
  const btn = document.getElementById('btn-submit-order');
  const isBuySide = (side === 'BUY' || side === 'BUY_TO_COVER');
  btn.className = 'btn-submit-order ' + (isBuySide ? 'buy-order' : 'sell-order');
  updateSubmitText();
}

function setOrderType(type) {
  currentOrderType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  document.getElementById('limit-price-row').style.display = (type === 'LIMIT' || type === 'STOP_LIMIT') ? 'flex' : 'none';
  document.getElementById('stop-price-row').style.display = (type === 'STOP' || type === 'STOP_LIMIT') ? 'flex' : 'none';
  document.getElementById('trail-row').style.display = type === 'TRAILING' ? 'flex' : 'none';
  updateSubmitText();
}

function adjustQty(delta) {
  const el = document.getElementById('order-qty');
  el.value = Math.max(1, parseInt(el.value || 0) + delta);
  updateSubmitText();
  updateEstValue();
}

function updateSubmitText() {
  const qty = document.getElementById('order-qty').value;
  const typeMap = { MARKET: 'MKT', LIMIT: 'LMT', STOP: 'STP', STOP_LIMIT: 'S-LMT', TRAILING: 'TRAIL' };
  const sideLabels = { BUY: 'BUY', SELL: 'SELL', SHORT_SELL: 'SHORT', BUY_TO_COVER: 'COVER' };
  document.getElementById('submit-text').textContent = `${sideLabels[currentSide] || currentSide} ${qty} ${typeMap[currentOrderType]}`;
}

function updateEstValue() {
  const qty = parseInt(document.getElementById('order-qty').value) || 0;
  const isBuySide = (currentSide === 'BUY' || currentSide === 'BUY_TO_COVER');
  const price = lastTick ? (isBuySide ? lastTick.ask : lastTick.bid) : 0;
  const value = qty * price;
  const comm = OrderEngine.calcCommission(qty);
  document.getElementById('order-est-value').textContent = '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' + $' + comm.toFixed(2) + ' comm';
}

async function submitOrder() {
  if (!lastTick) { showToast('Waiting for price data...', 'error'); return; }

  // Block new position-opening orders during margin call
  if (marginCallState.active && OrderEngine.isOpeningOrder(currentSide)) {
    showToast('MARGIN CALL ACTIVE — Cannot open new positions. Close existing positions to restore margin.', 'error');
    return;
  }

  const qty = parseInt(document.getElementById('order-qty').value);
  if (!qty || qty <= 0) { showToast('Invalid quantity.', 'error'); return; }

  const orderData = {
    side: currentSide,
    orderType: currentOrderType,
    qty,
    limitPrice: parseFloat(document.getElementById('order-limit-price').value) || null,
    stopPrice: parseFloat(document.getElementById('order-stop-price').value) || null,
    trailAmount: parseFloat(document.getElementById('order-trail-amount').value) || null,
    tif: document.getElementById('order-tif').value
  };

  // Validation
  const commission = OrderEngine.calcCommission(qty);
  const equity = OrderEngine.calcEquity(portfolio, lastTick.close);
  const buyingPower = equity * OrderEngine.sessionParams.maxLeverage;

  if (currentSide === 'BUY') {
    const estCost = qty * lastTick.ask + commission;
    if (estCost > buyingPower) { showToast('Insufficient buying power.', 'error'); return; }
  } else if (currentSide === 'SELL') {
    if (qty > portfolio.shares) { showToast('Insufficient shares.', 'error'); return; }
  } else if (currentSide === 'SHORT_SELL') {
    if (!OrderEngine.sessionParams.shortSellingEnabled) { showToast('Short selling is disabled.', 'error'); return; }
    const shortValue = qty * lastTick.bid;
    const reqEquity = shortValue * OrderEngine.sessionParams.maintenanceMargin;
    if (equity - commission < reqEquity) { showToast('Insufficient equity for short.', 'error'); return; }
  } else if (currentSide === 'BUY_TO_COVER') {
    if (qty > portfolio.shortShares) { showToast('Cannot cover more than short position.', 'error'); return; }
  }
  if ((currentOrderType === 'LIMIT' || currentOrderType === 'STOP_LIMIT') && !orderData.limitPrice) {
    showToast('Limit price required.', 'error'); return;
  }
  if ((currentOrderType === 'STOP' || currentOrderType === 'STOP_LIMIT') && !orderData.stopPrice) {
    showToast('Stop price required.', 'error'); return;
  }

  try {
    const order = await OrderEngine.submitOrder(
      RoomManager.currentRoom.id,
      RoomManager.currentParticipant.id,
      orderData
    );

    // Add to local working orders
    portfolio.orders.unshift(order);
    showToast(`Order submitted: ${currentSide} ${qty} ${currentOrderType}`, 'info');
    updateOrdersDisplay();

    // If MARKET order, process immediately on next tick
  } catch (e) {
    showToast(e.message || 'Order failed.', 'error');
  }
}
