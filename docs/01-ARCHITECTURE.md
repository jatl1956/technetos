# 01 — Architecture

## High-level diagram

```
┌────────────────────── MASTER BROWSER ──────────────────────┐
│                                                              │
│  master.html                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  PriceEngine ─────► nextCandle() every tickSpeedMs     │ │
│  │     │                                                   │ │
│  │     ├─► Mode HISTORICAL: HistoricalData.nextCandle()   │ │
│  │     │     (replays transformed real OHLC)              │ │
│  │     │                                                   │ │
│  │     └─► Mode GBM: synthesizes via GBM                   │ │
│  │                                                         │ │
│  │  Each tick:                                             │ │
│  │   1. Update local chart (lightweight-charts)            │ │
│  │   2. Update volume bars                                 │ │
│  │   3. Update TAEngine (indicators + drawings)            │ │
│  │   4. Update top bar (price, change %)                   │ │
│  │   5. Update sidebar (candles, remaining, leaderboard)   │ │
│  │   6. RoomManager.broadcastPriceTick(candle)             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────┬──────────────────────────┘
                                   │
                  Supabase Realtime channel
                  Channel: room:{room_code}
                  Events: price_tick, control, param_change
                                   │
                                   ▼
┌────────────────────── STUDENT BROWSER ──────────────────────┐
│                                                              │
│  student.html                                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  RoomManager.subscribe('room:{code}')                  │ │
│  │     ├─► onPriceTick(candle) ──► onTick(candle)          │ │
│  │     │       │                                           │ │
│  │     │       ├─► Update chart, volume, indicators        │ │
│  │     │       ├─► Update positions/orders/equity          │ │
│  │     │       └─► OrderEngine.processTick(candle)         │ │
│  │     │             (checks limits, stops, trails for fill)│ │
│  │     │                                                   │ │
│  │     ├─► onControl('pause' | 'resume' | 'end' | 'reset') │ │
│  │     │                                                   │ │
│  │     └─► onParamChange({ ticker, ... })                  │ │
│  │                                                         │ │
│  │  Local OrderEngine:                                     │ │
│  │   - Tracks cash, positions (long/short), orders         │ │
│  │   - Computes margin, equity, unrealized/realized P&L    │ │
│  │   - Fills orders against incoming candles               │ │
│  │   - Triggers margin call / liquidation                  │ │
│  │   - Persists state via Supabase (orders table)          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌────────────────────────── SUPABASE ──────────────────────────┐
│                                                                │
│  Auth: email + password                                        │
│                                                                │
│  Tables:                                                       │
│   - rooms       (id, code, master_id, ticker, status, params)  │
│   - participants (id, room_id, student_id, equity, ...)        │
│   - orders      (id, room_id, student_id, side, type, ...)     │
│                                                                │
│  Realtime:                                                     │
│   - broadcast channel per room                                 │
│   - master sends, students receive                             │
│   - leaderboard updates (every N ticks via DB query)           │
│                                                                │
│  RLS Policies:                                                 │
│   - Master can update their own rooms                          │
│   - Students can read rooms they're in                         │
│   - Students can insert/update only their own orders           │
└────────────────────────────────────────────────────────────────┘
```

## Component responsibilities

### PriceEngine (`price-engine.js`, 181 LOC)

**Single responsibility:** generate OHLC candles, one at a time.

- `mode`: 'historical' | 'gbm'
- `nextCandle()` → returns next candle or null (historical mode exhausted)
- `reset(params)` — initializes a new run
- In historical mode, delegates to `HistoricalData.nextCandle()`
- In GBM mode, uses `_gbmStep()` (Box-Muller) + `_realisticOHLC()` to make wicks/bodies natural

### HistoricalData (`historical-data.js`, 186 LOC)

**Single responsibility:** load real OHLC bundle, transform it, replay it.

- `loadBundle(_HISTORICAL_BUNDLE)` — called once at page load by `historical-bundle.js`
- `prepareSeries(scenarioIndex, opts)` — picks a series, transforms (scale + optional mirror), stores in memory
- `nextCandle()` — returns next candle from prepared series, with bid/ask spread added
- `remaining()` — how many candles left to play

### OrderEngine (`order-engine.js`, 443 LOC)

**Single responsibility:** student-side order management.

- Order types: MARKET, LIMIT, STOP, STOP_LIMIT, TRAILING (+ COVER for closing shorts)
- State: `cash`, `positions[]`, `orders[]`, `executions[]`
- `placeOrder(order)` — validates, persists to DB
- `processTick(candle)` — fills working orders if conditions met
- `getEquity()`, `getMarginUsed()`, `getMaintenanceRequired()`
- `checkMarginCall(candle)` — flips status to MARGIN_CALL or LIQUIDATED
- Persists each fill to Supabase `orders` table

### TAEngine (`ta-engine.js`, 616 LOC)

**Single responsibility:** indicators + drawing tools on the chart.

- Indicators: SMA, EMA, Bollinger Bands (overlay) + RSI, MACD, Volume (separate panes via lightweight-charts v5 native pane support)
- Drawings: Horizontal Line, Trend Line (auto-extends), Horizontal Ray (auto-extends)
- `pushCandle(candle)` — recomputes all active indicators, extends drawings
- `addIndicator(type, params)`, `removeIndicator(id)`, `clearAll()`
- Drawing mode: click handler captures price/time, uses lightweight-charts `coordinateToPrice`

### RoomManager (`room-manager.js`, 288 LOC)

**Single responsibility:** Supabase rooms + realtime broadcasting.

- `createRoom(params)`, `joinRoom(code)`, `completeRoom()`
- `broadcastPriceTick(candle)`, `broadcastControl(event)`, `broadcastParamChange(params)`
- Subscriptions: `onPriceTick`, `onControl`, `onParamChange`, `onParticipantsChange`
- Uses `SupabaseConfig.getClient()` for the singleton

### Auth (`auth.js`)

**Single responsibility:** sign in / sign up / sign out wrapper around Supabase auth.

### SupabaseConfig (`supabase-config.js`)

**Single responsibility:** initialize the Supabase client. Includes a `navigator.locks` polyfill for sandboxed iframes.

## Build pipeline (`build-inline.js`)

The reason: Vercel serves static files; we don't want 8 separate JS HTTP requests on page load. So we inline everything.

```js
function buildInlineHtml(filename, modules) {
  let html = readFile(filename);
  for (const mod of modules) {
    html = html.replace(
      `<script src="./${mod.file}"></script>`,
      `<script>${mod.content}</script>`
    );
  }
  return html;
}
```

The master gets ALL modules including `historical-bundle.js` (1.25 MB → ~1.4 MB final HTML).
The student gets all modules EXCEPT `historical-bundle.js` and `price-engine.js` — students don't need the data, they receive ticks via realtime.

Output written to `dist/multiplayer/master.html` and `dist/multiplayer/student.html`. The user manually copies these to root for Vercel.

## Why this architecture

1. **Master-as-server** avoids needing a backend service. The professor's browser IS the simulation host. Reduces hosting cost to just static + Supabase free tier.

2. **Realtime broadcasts** mean students don't pull state — they receive it. Latency is ~100ms typically.

3. **Local order engine on student** means each student computes their own P&L. The master never sees individual student positions; it only queries the `participants.equity` column for the leaderboard.

4. **Inlined builds** make hosting trivial — Vercel just serves HTML files.

## Failure modes

- **Master refreshes mid-session** → all in-memory state lost. Students disconnected (room marked `paused` after timeout).
- **Student refreshes** → student must re-join. Their orders persist in DB but local in-memory state is rebuilt from scratch.
- **Supabase Realtime drops** → master keeps running locally but students stop receiving ticks.
- **Master closes tab without END** → session stays `active` forever in DB.

These are all known issues and acceptable for an educational tool used in a classroom (professor is present, can restart).
