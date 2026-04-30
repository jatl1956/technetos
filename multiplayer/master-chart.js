/* =========================================================
   Technetos Multiplayer — Master
   Module: chart init + updateChart
   ========================================================= */

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
    rightPriceScale: {
      borderColor: '#1e2836',
      scaleMargins: { top: 0.05, bottom: 0.20 }  // leave 20% at bottom for volume
    },
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
    scaleMargins: { top: 0.85, bottom: 0 },  // volume uses bottom 15% of chart
    borderVisible: false,
    visible: false  // hide the volume price scale
  });

  // Resize
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
