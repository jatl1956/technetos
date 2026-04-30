# 02 — Data Models

## Supabase tables

### `rooms`

```sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                 -- 6-letter join code (e.g., "T68YTE")
  name text not null,                         -- session name shown to professor
  master_id uuid references auth.users(id) not null,
  ticker text not null,                       -- display name (AAPL, BTC, etc.) - NOT the source
  status text not null default 'active',     -- active | paused | completed | deleted
  initial_price numeric not null,
  drift numeric not null default 0.08,
  volatility numeric not null default 0.25,
  tick_speed_ms int not null default 600,
  spread_bps int not null default 10,
  -- Margin & short selling (migration 001)
  starting_cash numeric not null default 100000,
  max_leverage numeric not null default 2,
  short_selling_enabled boolean not null default true,
  maintenance_margin numeric not null default 0.25,
  commission_per_share numeric not null default 0.005,
  min_commission numeric not null default 1.00,
  cash_int_rate numeric not null default 2.0,    -- annual %
  margin_int_rate numeric not null default 8.0,  -- annual %
  -- Margin call grace (migration 002)
  margin_call_grace_ticks int not null default 30,
  --
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
```

**Notes:**
- `ticker` is the **display name** shown in the UI. The actual data source (when `historical` mode) is selected separately and not stored in the room. The professor can change the displayed ticker mid-session via a topbar dropdown — this also picks a new random scenario.
- `status = 'deleted'` is used as a soft-delete (RLS does not allow DELETE).
- Pricing/margin params are snapshotted at room creation; they cannot be changed mid-session except for `tick_speed_ms` (via `updateParams`).

### `participants`

```sql
create table participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  student_id uuid references auth.users(id) not null,
  display_name text not null,
  cash numeric not null,
  equity numeric not null,                  -- = cash + market_value(positions)
  total_pnl numeric not null default 0,
  margin_status text not null default 'OK', -- OK | WARNING | MARGIN_CALL | LIQUIDATED
  margin_call_tick int,                      -- tick index when MC started (for grace countdown)
  joined_at timestamptz not null default now(),
  unique(room_id, student_id)
);
```

**Used for:** leaderboard. Master polls this table every N ticks via `select * from participants where room_id = ? order by equity desc`.

### `orders`

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  student_id uuid references auth.users(id) not null,
  side text not null,                       -- BUY | SELL | SHORT | COVER
  type text not null,                       -- MARKET | LIMIT | STOP | STOP_LIMIT | TRAILING
  qty int not null,
  limit_price numeric,
  stop_price numeric,
  trail_amount numeric,                     -- for TRAILING orders
  trail_pct numeric,                        -- alternative to trail_amount
  tif text not null default 'GTC',          -- GTC | DAY | IOC
  status text not null default 'WORKING',   -- WORKING | FILLED | CANCELLED | REJECTED
  fill_price numeric,
  fill_qty int,
  commission numeric,
  filled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
```

**Notes:**
- The order engine is local to the student browser. `orders` is a write-only audit log — orders are inserted on placement and updated on fill/cancel.
- `side = SHORT` opens a short position; `side = COVER` closes it. `side = SELL` only closes long positions.
- `trail_amount` is in dollars; `trail_pct` is a percentage. Use one or the other.

## Candle format (in-memory + over the wire)

```js
{
  time: 1745000000,         // UNIX seconds (lightweight-charts requires ascending integers)
  open: 187.45,
  high: 188.20,
  low: 186.80,
  close: 187.95,
  volume: 1543200,          // present in historical mode, absent in GBM
  bid: 187.85,              // close - spread/2
  ask: 188.05,              // close + spread/2
  spread: 0.20,
  ticker: "AAPL",
  tickIndex: 47             // 0-indexed sequential tick number
}
```

`tickIndex` is monotonic per-session, used for margin call grace tracking.

## Realtime channel events

Channel name: `room:{room_code}` (e.g., `room:T68YTE`).

### Event: `price_tick`

Master → all students. Payload = candle object above.

### Event: `control`

Master → all students. Payload:

```js
{ action: 'play' | 'pause' | 'resume' | 'end' | 'reset' }
```

### Event: `param_change`

Master → all students. Payload:

```js
{ ticker?: string, tickSpeedMs?: number, ... }
```

When `ticker` changes, the simulation is reset on the master side (new random scenario picked) and students receive a `reset` control event.

## Historical bundle format

Stored in `historical-bundle.js` as a giant JS object:

```js
const _HISTORICAL_BUNDLE = {
  "AAPL": [
    ["2021-04-30", 132.85, 133.04, 131.83, 131.46, 86643670],
    ["2021-05-03", 132.04, 134.07, 131.83, 132.54, 75135100],
    // ... ~1250 entries (5 years of trading days)
  ],
  "AMD": [...],
  "BTCUSD": [...],   // ~1825 entries (crypto, 7 days/week)
  "ETHUSD": [...],
  // ... 19 tickers total
};
HistoricalData.loadBundle(_HISTORICAL_BUNDLE);
```

Each entry: `[date_str, open, high, low, close, volume]` — array form to save bytes (vs. object form).

## Internal price engine state

```js
PriceEngine = {
  // current tick
  price: 185.0,           // last close
  prevClose: 185.0,
  tickIndex: 0,
  _baseTime: 0,           // UNIX seconds at simulation start

  candles: [],            // accumulated history (in-memory only)

  mode: 'historical',     // 'historical' or 'gbm'

  // historical mode
  _histScenarioName: null,
  _histTotalCandles: 0,

  params: {
    ticker: 'AAPL',
    initialPrice: 185.0,
    drift: 0.08,           // GBM annualized
    volatility: 0.25,      // GBM annualized
    tickSpeedMs: 600,
    spreadBps: 10
  }
}
```

## Internal historical data state

```js
HistoricalData = {
  _bundle: { AAPL: [...], ...},  // loaded from historical-bundle.js
  _tickers: ['AAPL', 'AMD', ...], // alphabetical

  // active replay state
  _series: [],                    // transformed candles for current scenario
  _index: 0,                      // playback position
  _sourceKey: null,               // e.g., 'AAPL' (NOT exposed to UI)
  _transform: { scale, mirror, targetPrice }
}
```

`_sourceKey` is intentionally hidden from the student-facing UI. The professor sees the scenario name (e.g., "Quantum Corp (Tech)") which they know maps to AAPL via the SCENARIO_NAMES array.
