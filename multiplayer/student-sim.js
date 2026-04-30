/* =========================================================
   Technetos Multiplayer — Student
   Module: simulation start + chart + tick handler (startStudentSim, initChart, handlePriceTick)
   ========================================================= */

/* === START SIMULATION === */
async function startStudentSim() {
  document.getElementById('join-overlay').classList.add('hidden');
  document.getElementById('waiting-badge').classList.add('hidden');
  document.getElementById('sim-container').classList.remove('hidden');

  const room = RoomManager.currentRoom;
  document.getElementById('ticker-sym').textContent = room.ticker;
  document.getElementById('chart-title').textContent = room.ticker;
  document.getElementById('sim-user-name').textContent = Auth.getDisplayName();
  
  // Init order engine with room params
  OrderEngine.initParams(room);

  // Show SHORT/COVER buttons if short selling enabled
  if (OrderEngine.sessionParams.shortSellingEnabled) {
    document.getElementById('btn-short').style.display = '';
    document.getElementById('btn-cover').style.display = '';
  }

  // Restore portfolio from participant data
  const p = RoomManager.currentParticipant;
  portfolio.cash = parseFloat(p.cash);
  portfolio.shares = p.shares || 0;
  portfolio.avgCost = parseFloat(p.avg_cost) || 0;
  portfolio.shortShares = p.short_shares || 0;
  portfolio.shortAvgCost = parseFloat(p.short_avg_cost) || 0;
  portfolio.realizedPnl = parseFloat(p.realized_pnl) || 0;
  portfolio.totalCommissions = parseFloat(p.total_commissions) || 0;
  portfolio.accruedCashInterest = parseFloat(p.accrued_interest) || 0;
  // accrued_margin_interest persisted as of migration 004 (Fase D)
  portfolio.accruedMarginInterest = parseFloat(p.accrued_margin_interest) || 0;

  // Fase D: restore WORKING orders from DB so refresh doesn't lose them.
  // IMPORTANT: keep DB shape (snake_case + order_type) because OrderEngine.processOrders
  // and updateOrdersDisplay both consume those exact field names. New orders inserted
  // via OrderEngine.submitOrder() return the same DB shape, so this is consistent.
  try {
    const dbOrders = await OrderEngine.getWorkingOrders(p.id);
    portfolio.orders = (dbOrders || []).map(o => ({
      id: o.id,
      side: o.side,
      order_type: o.order_type,
      qty: o.qty,
      limit_price: o.limit_price != null ? parseFloat(o.limit_price) : null,
      stop_price: o.stop_price != null ? parseFloat(o.stop_price) : null,
      trail_amount: o.trail_amount != null ? parseFloat(o.trail_amount) : null,
      tif: o.tif || 'GTC',
      status: 'WORKING',
      created_at: o.created_at,
      // TRAILING uses _bestPrice; reset on reconnect so engine re-tracks from current price
      _bestPrice: null
    }));
    if (portfolio.orders.length > 0) {
      showToast('Restored ' + portfolio.orders.length + ' working order(s) from previous session', 'info');
    }
  } catch (e) {
    console.warn('Failed to restore working orders:', e.message);
  }

  updateAccountDisplay();
  updateOrdersDisplay();

  initChart();

  // Subscribe to price ticks from master
  RoomManager.subscribeToPrices(
    room.id,
    onPriceTick,
    onParamChange,
    onSimControl
  );

  // Clock update
  setInterval(() => {
    document.getElementById('topbar-time').textContent = new Date().toLocaleTimeString();
  }, 1000);

  // Periodic portfolio sync to DB (every 5 seconds)
  // Fase D: include accrued_margin_interest and last_seen_tick for full refresh recovery
  setInterval(() => {
    if (RoomManager.currentParticipant) {
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
  }, 5000);
}

/* === CHART === */
function initChart() {
  const container = document.getElementById('chart-container');
  chart = LightweightCharts.createChart(container, {
    layout: {
      background: { type: 'Solid', color: '#0a0e17' },
      textColor: '#8b9dc3',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10
    },
    grid: {
      vertLines: { color: 'rgba(30, 40, 54, 0.5)' },
      horzLines: { color: 'rgba(30, 40, 54, 0.5)' }
    },
    crosshair: { mode: 0 },
    rightPriceScale: { borderColor: '#1e2836', scaleMargins: { top: 0.05, bottom: 0.20 } },
    timeScale: { borderColor: '#1e2836', timeVisible: true, secondsVisible: false, rightOffset: 5 }
  });
  // v5 API: addSeries(CandlestickSeries, options)
  candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: '#00c853', downColor: '#ff3d57',
    borderUpColor: '#00c853', borderDownColor: '#ff3d57',
    wickUpColor: '#00c853', wickDownColor: '#ff3d57'
  });

  // Volume histogram overlay (bottom of main chart, TradingView style)
  volumeSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceLineVisible: false,
    lastValueVisible: false,
    priceScaleId: 'vol',
  });
  chart.priceScale('vol').applyOptions({
    scaleMargins: { top: 0.85, bottom: 0 },
    borderVisible: false,
    visible: false
  });

  new ResizeObserver(() => {
    chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
  }).observe(container);

  // Initialize TA Engine
  TAEngine.init(chart, candleSeries);

  // Chart click handler for drawing tools
  chart.subscribeClick((param) => {
    if (!TAEngine.drawingMode) return;
    if (!param.time || !param.point) return;
    const price = candleSeries.coordinateToPrice(param.point.y);
    if (price === null || price === undefined) return;
    const consumed = TAEngine.handleClick(param.time, price);
    if (consumed) updateTAButtons();
  });
}

/* === PRICE TICK HANDLER === */
function onPriceTick(tick) {
  lastTick = tick;
  
  // Update chart
  candleSeries.update(tick);
  if (volumeSeries && tick.volume) {
    volumeSeries.update({
      time: tick.time,
      value: tick.volume,
      color: tick.close >= tick.open ? 'rgba(0,200,83,0.25)' : 'rgba(255,61,87,0.25)'
    });
  }
  TAEngine.pushCandle(tick);
  
  // Update top bar
  document.getElementById('ticker-price').textContent = tick.close.toFixed(2);
  const change = tick.close - initialPrice;
  const changePct = (change / initialPrice) * 100;
  document.getElementById('ticker-change').textContent = (change >= 0 ? '+' : '') + change.toFixed(2);
  document.getElementById('ticker-change').className = 'ticker-change ' + (change >= 0 ? 'price-up' : 'price-down');
  document.getElementById('ticker-pct').textContent = '(' + (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%)';
  document.getElementById('ticker-pct').className = 'ticker-pct ' + (changePct >= 0 ? 'price-up' : 'price-down');

  // Update bid/ask
  document.getElementById('bid-price').textContent = tick.bid.toFixed(2);
  document.getElementById('ask-price').textContent = tick.ask.toFixed(2);
  document.getElementById('spread-display').textContent = tick.spread.toFixed(2);

  // Accrue interest on each tick
  const interest = OrderEngine.calcTickInterest(portfolio, tick.close, 1);
  if (interest.cashInterest > 0) {
    portfolio.cash += interest.cashInterest;
    portfolio.accruedCashInterest += interest.cashInterest;
  }
  if (interest.marginInterest > 0) {
    portfolio.cash -= interest.marginInterest;
    portfolio.accruedMarginInterest += interest.marginInterest;
  }

  // === MARGIN CALL STATE MACHINE ===
  const inMarginCall = OrderEngine.isMarginCall(portfolio, tick.close);

  if (inMarginCall) {
    if (!marginCallState.active) {
      // Entering margin call — start grace period
      marginCallState.active = true;
      marginCallState.totalGraceTicks = OrderEngine.sessionParams.marginCallGraceTicks;
      marginCallState.ticksRemaining = marginCallState.totalGraceTicks;
      marginCallState.liquidationExecuted = false;
      showToast('MARGIN CALL — Close positions or face liquidation!', 'error');
      showMarginCallBanner(true);
    } else {
      // Already in margin call — count down
      marginCallState.ticksRemaining = Math.max(0, marginCallState.ticksRemaining - 1);
    }

    // Forced liquidation when grace period expires
    if (marginCallState.ticksRemaining <= 0 && !marginCallState.liquidationExecuted) {
      marginCallState.liquidationExecuted = true;
      executeForcedLiquidation(tick);
    }

    updateMarginCallBanner();
  } else {
    // Margin restored — clear state
    if (marginCallState.active) {
      marginCallState.active = false;
      marginCallState.ticksRemaining = 0;
      marginCallState.liquidationExecuted = false;
      showMarginCallBanner(false);
      showToast('Margin restored — margin call cleared.', 'info');
    }
  }

  // Process orders locally
  processLocalOrders(tick);

  // Update account
  updateAccountDisplay();
  updateEstValue();
}

function onParamChange(params) {
  // Update local state based on master's parameter changes
  showToast('Professor updated simulation parameters.', 'info');
}

function onSimControl(payload) {
  if (payload.action === 'pause') {
    showToast('Simulation paused by professor.', 'info');
  } else if (payload.action === 'resume') {
    showToast('Simulation resumed.', 'info');
  } else if (payload.action === 'end') {
    showToast('Session ended by professor.', 'cancel');
    // Save metrics
    saveEndMetrics();
  }
}
