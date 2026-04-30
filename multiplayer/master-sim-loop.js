/* =========================================================
   Technetos Multiplayer — Master
   Module: simulation loop (tick generation, broadcast, processOrders)
   ========================================================= */

/* === SIMULATION LOOP === */
function startSimulation() {
  isPlaying = true;
  const baseSpeed = PriceEngine.params.tickSpeedMs;
  
  function tick() {
    if (!isPlaying) return;
    
    const candle = PriceEngine.nextCandle();

    // Historical mode: null means series exhausted
    if (!candle) {
      isPlaying = false;
      showToast('Historical data exhausted — simulation ended', 'info');
      document.getElementById('icon-pause').style.display = 'none';
      document.getElementById('icon-play').style.display = '';
      RoomManager.broadcastControl('pause');
      return;
    }
    
    // Update chart
    candleSeries.update(candle);
    // Update volume bars (color matches candle direction)
    if (volumeSeries && candle.volume) {
      volumeSeries.update({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? 'rgba(0,200,83,0.25)' : 'rgba(255,61,87,0.25)'
      });
    }
    TAEngine.pushCandle(candle);
    
    // Update top bar
    document.getElementById('ticker-price').textContent = candle.close.toFixed(2);
    const change = candle.close - PriceEngine.params.initialPrice;
    const changePct = (change / PriceEngine.params.initialPrice) * 100;
    document.getElementById('ticker-change').textContent = (change >= 0 ? '+' : '') + change.toFixed(2);
    document.getElementById('ticker-change').className = 'ticker-change ' + (change >= 0 ? 'price-up' : 'price-down');
    document.getElementById('ticker-pct').textContent = '(' + (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%)';
    document.getElementById('ticker-pct').className = 'ticker-pct ' + (changePct >= 0 ? 'price-up' : 'price-down');
    
    // Update sidebar stats
    document.getElementById('ms-price').textContent = '$' + candle.close.toFixed(2);
    document.getElementById('ms-candles').textContent = PriceEngine.tickIndex;

    // Update remaining counter in historical mode
    if (PriceEngine.mode === 'historical') {
      const rem = HistoricalData.remaining();
      document.getElementById('ms-remaining').textContent = rem + ' candles';
    }

    // Broadcast to students
    RoomManager.broadcastPriceTick(candle);

    // Schedule next
    simInterval = setTimeout(tick, baseSpeed / speedMultiplier);
  }

  document.getElementById('icon-pause').style.display = '';
  document.getElementById('icon-play').style.display = 'none';
  tick();
}

function togglePlayPause() {
  if (isPlaying) {
    isPlaying = false;
    clearTimeout(simInterval);
    document.getElementById('icon-pause').style.display = 'none';
    document.getElementById('icon-play').style.display = '';
    RoomManager.broadcastControl('pause');
    RoomManager.pauseRoom();
  } else {
    RoomManager.resumeRoom();
    RoomManager.broadcastControl('resume');
    startSimulation();
  }
}

function setSpeed(s) {
  speedMultiplier = s;
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', Math.abs(parseFloat(b.dataset.speed) - s) < 0.01));
  if (isPlaying) {
    clearTimeout(simInterval);
    startSimulation();
  }
}
