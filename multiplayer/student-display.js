/* =========================================================
   Technetos Multiplayer — Student
   Module: UI display updates (portfolio, leaderboard, orders table)
   ========================================================= */

/* === DISPLAY UPDATES === */
function updateAccountDisplay() {
  const price = lastTick ? lastTick.close : initialPrice;
  const longMktVal = portfolio.shares * price;
  const shortMktVal = portfolio.shortShares * price;
  const equity = OrderEngine.calcEquity(portfolio, price);
  const buyingPower = equity * OrderEngine.sessionParams.maxLeverage;
  const marginUsed = OrderEngine.calcMarginUsed(portfolio, price);

  // Unrealized P&L: longs + shorts
  const longUnrealPnl = portfolio.shares > 0 ? (price - portfolio.avgCost) * portfolio.shares : 0;
  const shortUnrealPnl = portfolio.shortShares > 0 ? (portfolio.shortAvgCost - price) * portfolio.shortShares : 0;
  const unrealPnl = longUnrealPnl + shortUnrealPnl;
  const totalPnl = portfolio.realizedPnl + unrealPnl;

  const fmt = (v) => '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const fmtSigned = (v) => (v >= 0 ? '+' : '-') + fmt(v);

  document.getElementById('acct-cash').textContent = (portfolio.cash < 0 ? '-' : '') + fmt(portfolio.cash);
  document.getElementById('acct-buying-power').textContent = fmt(buyingPower);
  document.getElementById('acct-mktval').textContent = fmt(longMktVal);
  document.getElementById('acct-short-mktval').textContent = fmt(shortMktVal);
  document.getElementById('acct-equity').textContent = fmt(equity);
  document.getElementById('acct-margin-used').textContent = fmt(marginUsed);
  
  const upnlEl = document.getElementById('acct-unreal-pnl');
  upnlEl.textContent = fmtSigned(unrealPnl);
  upnlEl.className = 'acct-value ' + (unrealPnl >= 0 ? 'price-up' : 'price-down');

  const rpnlEl = document.getElementById('acct-real-pnl');
  rpnlEl.textContent = fmtSigned(portfolio.realizedPnl);
  rpnlEl.className = 'acct-value ' + (portfolio.realizedPnl >= 0 ? 'price-up' : 'price-down');

  const tpnlEl = document.getElementById('acct-total-pnl');
  tpnlEl.textContent = fmtSigned(totalPnl);
  tpnlEl.className = 'acct-value highlight ' + (totalPnl >= 0 ? 'price-up' : 'price-down');

  document.getElementById('acct-commissions').textContent = '-' + fmt(portfolio.totalCommissions);
  document.getElementById('acct-interest-earned').textContent = '+' + fmt(portfolio.accruedCashInterest);
  document.getElementById('acct-margin-interest').textContent = '-' + fmt(portfolio.accruedMarginInterest);

  // Update margin status box
  updateMarginStatusBox(price, equity);
}

function updateMarginStatusBox(price, equity) {
  const totalPos = (portfolio.shares * price) + (portfolio.shortShares * price);
  const maintReq = OrderEngine.calcMaintenanceReq(portfolio, price);
  const surplus = equity - maintReq;
  const ratio = totalPos > 0 ? (equity / totalPos) : 0;
  const maintPct = OrderEngine.sessionParams.maintenanceMargin;

  const fmt = (v) => '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 });

  // Status badge
  const badge = document.getElementById('ms-status-badge');
  const infoLine = document.getElementById('ms-info-line');
  const surplusEl = document.getElementById('ms-equity-surplus');
  const box = document.getElementById('margin-status-box');

  if (!badge || !box) return;

  document.getElementById('ms-maint-req').textContent = fmt(maintReq);

  if (totalPos > 0) {
    document.getElementById('ms-equity-ratio').textContent = (ratio * 100).toFixed(1) + '% (min ' + (maintPct * 100).toFixed(0) + '%)';
  } else {
    document.getElementById('ms-equity-ratio').textContent = 'No positions';
  }

  if (totalPos === 0) {
    // No positions — all clear
    badge.textContent = 'OK';
    badge.style.background = '#0d3320'; badge.style.color = '#33ff99';
    box.style.borderColor = '#2a3a4a';
    surplusEl.textContent = '--';
    surplusEl.style.color = '#33ff99';
    infoLine.style.display = 'none';
  } else if (marginCallState.liquidationExecuted) {
    // Liquidated
    badge.textContent = 'LIQUIDATED';
    badge.style.background = '#4d0000'; badge.style.color = '#ff3333';
    box.style.borderColor = '#ff3333';
    surplusEl.textContent = (surplus >= 0 ? '+' : '-') + fmt(surplus);
    surplusEl.style.color = '#ff3333';
    infoLine.style.display = 'block';
    infoLine.style.background = '#1a0000'; infoLine.style.color = '#ff6666';
    infoLine.textContent = 'Positions were force-closed by the broker. You may resume trading.';
  } else if (marginCallState.active) {
    // Margin Call active
    const t = marginCallState.ticksRemaining;
    badge.textContent = 'MARGIN CALL';
    badge.style.background = '#4d0000'; badge.style.color = '#ff3333';
    box.style.borderColor = '#ff3333';
    surplusEl.textContent = '-' + fmt(Math.abs(surplus));
    surplusEl.style.color = '#ff3333';
    infoLine.style.display = 'block';
    infoLine.style.background = '#1a0000'; infoLine.style.color = '#ff9900';
    if (t <= 5) {
      infoLine.textContent = '\u26A0 IMMINENT LIQUIDATION in ' + t + ' ticks! Sell/cover positions immediately or they will be force-closed.';
    } else {
      infoLine.textContent = '\u26A0 Equity below maintenance margin. You have ' + t + ' ticks to close positions. New BUY/SHORT orders are blocked.';
    }
  } else if (ratio > 0 && ratio < maintPct * 1.5) {
    // Warning — approaching margin call
    badge.textContent = 'WARNING';
    badge.style.background = '#332200'; badge.style.color = '#ffaa00';
    box.style.borderColor = '#ff9900';
    surplusEl.textContent = '+' + fmt(surplus);
    surplusEl.style.color = '#ffaa00';
    infoLine.style.display = 'block';
    infoLine.style.background = '#1a1100'; infoLine.style.color = '#ffcc66';
    infoLine.textContent = 'Approaching maintenance margin. Consider reducing positions to avoid a margin call.';
  } else {
    // OK
    badge.textContent = 'OK';
    badge.style.background = '#0d3320'; badge.style.color = '#33ff99';
    box.style.borderColor = '#2a3a4a';
    surplusEl.textContent = '+' + fmt(surplus);
    surplusEl.style.color = '#33ff99';
    infoLine.style.display = 'none';
  }
}

function updatePositionsDisplay() {
  const tbody = document.getElementById('positions-tbody');
  const empty = document.getElementById('positions-empty');
  if (portfolio.shares === 0 && portfolio.shortShares === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';
  const price = lastTick ? lastTick.close : initialPrice;
  const ticker = RoomManager.currentRoom.ticker;
  let html = '';

  // Long position
  if (portfolio.shares > 0) {
    const mktVal = portfolio.shares * price;
    const unrealPnl = (price - portfolio.avgCost) * portfolio.shares;
    const pctChg = portfolio.avgCost > 0 ? ((price - portfolio.avgCost) / portfolio.avgCost * 100) : 0;
    const pnlClass = unrealPnl >= 0 ? 'positive' : 'negative';
    html += `<tr>
      <td>${ticker}</td>
      <td class="positive">LONG</td>
      <td>${portfolio.shares}</td>
      <td>$${portfolio.avgCost.toFixed(2)}</td>
      <td>$${price.toFixed(2)}</td>
      <td>$${mktVal.toFixed(2)}</td>
      <td class="${pnlClass}">${(unrealPnl >= 0 ? '+' : '')}$${unrealPnl.toFixed(2)}</td>
      <td class="${pnlClass}">${(pctChg >= 0 ? '+' : '')}${pctChg.toFixed(2)}%</td>
    </tr>`;
  }

  // Short position
  if (portfolio.shortShares > 0) {
    const shortMktVal = portfolio.shortShares * price;
    const shortUnrealPnl = (portfolio.shortAvgCost - price) * portfolio.shortShares;
    const shortPctChg = portfolio.shortAvgCost > 0 ? ((portfolio.shortAvgCost - price) / portfolio.shortAvgCost * 100) : 0;
    const shortPnlClass = shortUnrealPnl >= 0 ? 'positive' : 'negative';
    html += `<tr>
      <td>${ticker}</td>
      <td class="negative">SHORT</td>
      <td>${portfolio.shortShares}</td>
      <td>$${portfolio.shortAvgCost.toFixed(2)}</td>
      <td>$${price.toFixed(2)}</td>
      <td>$${shortMktVal.toFixed(2)}</td>
      <td class="${shortPnlClass}">${(shortUnrealPnl >= 0 ? '+' : '')}$${shortUnrealPnl.toFixed(2)}</td>
      <td class="${shortPnlClass}">${(shortPctChg >= 0 ? '+' : '')}${shortPctChg.toFixed(2)}%</td>
    </tr>`;
  }

  tbody.innerHTML = html;
}

function updateOrdersDisplay() {
  const working = portfolio.orders.filter(o => o.status === 'WORKING');
  const tbody = document.getElementById('orders-tbody');
  const empty = document.getElementById('orders-empty');
  if (working.length === 0) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  let html = '';
  for (const o of working) {
    const price = o.limit_price || o.stop_price || '--';
    const time = new Date(o.created_at).toLocaleTimeString();
    html += `<tr>
      <td>${time}</td>
      <td class="${o.side === 'BUY' ? 'positive' : 'negative'}">${o.side}</td>
      <td>${o.order_type}</td><td>${o.qty}</td>
      <td>${price !== '--' ? '$' + parseFloat(price).toFixed(2) : '--'}</td>
      <td style="color:var(--yellow);">WORKING</td>
      <td><button class="btn-cancel-order" onclick="cancelOrder('${o.id}')">CANCEL</button></td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

function updateExecutionsDisplay() {
  const tbody = document.getElementById('executions-tbody');
  const empty = document.getElementById('executions-empty');
  if (portfolio.executions.length === 0) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  let html = '';
  for (const e of portfolio.executions.slice(0, 50)) {
    const isLiq = e._liquidation || e.type === 'LIQUIDATION';
    const rowStyle = isLiq ? ' style="background:rgba(255,0,0,0.15);"' : '';
    const typeLabel = isLiq ? '<span style="color:#ff3333;font-weight:700;">LIQ</span>' : e.type;
    html += `<tr${rowStyle}>
      <td>${e.time}</td>
      <td class="${e.side === 'BUY' || e.side === 'BUY_TO_COVER' ? 'positive' : 'negative'}">${e.side}</td>
      <td>${typeLabel}</td><td>${e.qty}</td>
      <td>$${e.fillPrice.toFixed(2)}</td>
      <td>$${e.value.toFixed(2)}</td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

async function cancelOrder(orderId) {
  try {
    await OrderEngine.cancelOrder(orderId);
    const order = portfolio.orders.find(o => o.id === orderId);
    if (order) order.status = 'CANCELLED';
    updateOrdersDisplay();
    showToast('Order cancelled.', 'cancel');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  document.getElementById('tab-' + tab).style.display = 'block';
}

async function saveEndMetrics() {
  const price = lastTick ? lastTick.close : initialPrice;
  const equity = OrderEngine.calcEquity(portfolio, price);
  const startCash = parseFloat(RoomManager.currentRoom.starting_cash);
  const pnl = equity - startCash;
  const pnlPct = (pnl / startCash) * 100;
  
  await OrderEngine.saveMetrics(RoomManager.currentRoom.id, RoomManager.currentParticipant.id, {
    cash: portfolio.cash,
    shares: portfolio.shares,
    equity,
    pnl,
    pnlPct,
    numTrades: portfolio.executions.length,
    totalCommissions: portfolio.totalCommissions,
    totalInterestEarned: portfolio.accruedCashInterest,
    totalMarginInterest: portfolio.accruedMarginInterest,
    maxMarginUsed: OrderEngine.calcMarginUsed(portfolio, price)
  });
}
