# 05 — TA Engine (Indicators + Drawing Tools)

The TA Engine runs in BOTH master and student browsers. Each user manages their own indicators and drawings independently.

## Indicators

All indicators are built on top of `lightweight-charts v5.1.0`, which natively supports separate panes (panels) for multi-pane charts.

### Overlay indicators (drawn ON the price chart)

| Indicator | Params | Calculation |
|---|---|---|
| **SMA** (Simple Moving Average) | `period` (e.g., 20, 50, 200), `color` | Average of last N closes |
| **EMA** (Exponential Moving Average) | `period`, `color` | Recursive: `EMA = α·close + (1-α)·EMA_prev`, where α = 2/(N+1) |
| **Bollinger Bands** | `period` (default 20), `stdDev` (default 2) | Middle = SMA(20); Upper = middle + 2σ; Lower = middle - 2σ. Three line series. |

### Pane indicators (separate panel below price)

| Indicator | Params | Calculation |
|---|---|---|
| **RSI** (Relative Strength Index) | `period` (default 14) | `RSI = 100 - 100/(1 + avg_gain/avg_loss)` over N periods. Drawn 0-100 with 30/70 reference lines. |
| **MACD** | `fast` (12), `slow` (26), `signal` (9) | MACD line = EMA_fast - EMA_slow; Signal = EMA(MACD, 9); Histogram = MACD - Signal. Three series in pane. |
| **Volume** | none | Histogram of `candle.volume`, colored by candle direction. |

## Drawing tools

| Tool | Description | Click count |
|---|---|---|
| **Horizontal Line** | Solid gold line at clicked price level, spans full chart | 1 click |
| **Trend Line** | Line connecting two clicked points, extends as new candles arrive | 2 clicks |
| **Horizontal Ray** | Dashed orange line from click point extending right | 1 click |

### Was REMOVED
- **Channel** (3-click parallel line): user disliked it, removed in PR #23.

## Interaction model

### Toolbar
Two dropdowns above the chart:
- **Indicators**: shows all indicator options grouped by Overlay / Pane
- **Draw**: shows drawing tools

After clicking an option:
- Indicators are added immediately and start computing
- Drawing tools enter "drawing mode" — chart click captures price/time

### Active studies
Once at least one indicator or drawing exists, two extra buttons appear:
- **Active** — opens a modal listing all active studies with × buttons to remove individually
- **× (Clear)** — removes all studies

### Drawing mode
- Cursor changes to crosshair (via lightweight-charts default)
- Status bar shows e.g., "Click 2 points for trend line"
- Escape key cancels
- Click-away on dropdowns closes them

## TAEngine internals

### State
```js
TAEngine = {
  chart: null,           // lightweight-charts IChartApi
  candleSeries: null,    // main candlestick series
  candles: [],           // all candles seen so far

  indicators: [],        // [{ id, type, params, label, series, paneIndex, ... }, ...]
  drawings: [],          // [{ id, type, series, p1, p2, price, ... }, ...]

  drawingMode: null,     // 'horzline' | 'trendline' | 'horzray' | null
  drawingPoints: [],     // for multi-click tools
  _nextId: 1
}
```

### Key methods

```js
init(chart, candleSeries)              // called once after chart creation
pushCandle(candle)                      // called on every tick — recomputes all indicators + extends drawings
addIndicator(type, params)              // adds an indicator
removeIndicator(id)                     // removes by id
startDrawing(type)                      // enters drawing mode
handleClick(time, price)                // called when chart is clicked in drawing mode
addHorizontalLine(price)                // adds at clicked price
addTrendLine(p1, p2)                    // adds between two points
clearAll()                              // removes all
```

### Pane management

`lightweight-charts v5` exposes `paneIndex` parameter on `addSeries`. The TAEngine assigns:
- Pane 0: main price chart (candles + overlay indicators + drawings)
- Pane 1: first separate-pane indicator (e.g., RSI)
- Pane 2: second separate-pane indicator (e.g., MACD)
- Pane N: each subsequent indicator gets its own pane

Volume is drawn IN pane 0 as a histogram series with its own price scale (`priceScaleId: 'vol'`) at the bottom 15% of the pane. This is a separate mechanism from pane indicators.

### Drawing extension (auto-grow)

When a new candle arrives via `pushCandle()`:
- Trend lines: extrapolate the slope from `p1`→`p2` and add a point at `(candle.time, calculated_price)`
- Horizontal rays: add `{ time: candle.time, value: ray.price }` if `candle.time >= ray.startTime`
- Horizontal lines: don't need extension (use lightweight-charts `priceLine` which auto-spans)

## Computational cost

For each tick:
- N indicators × O(period) recalculation
- M drawings × O(1) update
- Typical: 5 indicators × 200 period = 1000 ops/tick. Negligible.

For 500 candles total × 1 tick/600ms, total compute is trivial.

## Bugs / quirks

- When `clearAll()` is called, the chart sometimes flickers if drawings were in different panes
- Volume color uses `rgba(0,200,83,0.25)` for green and `rgba(255,61,87,0.25)` for red — these are hardcoded
- The `Active` modal HTML is built via string concatenation (XSS-safe because no user-supplied text, but ugly)

## Optimization opportunities

- Replace ad-hoc string-concat HTML with proper DOM construction
- Pull indicator math into a separate `indicators.js` for testability
- Add MACD histogram coloring (green > 0, red < 0)
- Add hover tooltips showing indicator values
- Add click-to-edit indicator parameters (currently they are fixed at creation)
- Add Fibonacci retracement, pitchforks, channels, parallel lines (would justify migrating to TradingView Charting Library)
