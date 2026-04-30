# 02b — Schema Reality (Code-Verified)

This file supersedes `02-DATA-MODELS.md` where there is conflict. **The code is the source of truth**, and v1's docs had drift. This file was written by reading the actual queries in `room-manager.js`, `order-engine.js`, `student.html`, and `master.html`.

## Tables (as the code uses them)

### `rooms` — ACTUAL columns referenced by code

| Column | Set by | Read by |
|---|---|---|
| `id` (uuid) | DB | room-manager, order-engine |
| `code` (text, 6 chars uppercase) | createRoom | joinRoom |
| `name` (text) | createRoom | UI |
| `master_id` (uuid → auth.users) | createRoom | RLS |
| `status` (text) | createRoom='waiting', updateRoom | student/master flows |
| `ticker` (text, e.g. 'AAPL') | createRoom | UI display |
| `initial_price` (numeric) | createRoom | PriceEngine |
| `drift` (numeric) | createRoom | PriceEngine (GBM) |
| `volatility` (numeric) | createRoom | PriceEngine (GBM) |
| `tick_speed_ms` (int) | createRoom, updateRoom | master tick loop |
| `spread_bps` (int) | createRoom | PriceEngine |
| `starting_cash` (numeric) | createRoom | participants insert + OrderEngine |
| `pattern_frequency` (int) | createRoom | (legacy, patterns removed) |
| `pattern_success_rate` (numeric) | createRoom | (legacy) |
| `selected_pattern` (text) | createRoom | (legacy) |
| `enabled_patterns` (text[]) | createRoom | (legacy) |
| `max_leverage` (numeric) | createRoom | OrderEngine.initParams |
| `commission_per_share` (numeric) | createRoom | OrderEngine |
| `min_commission` (numeric) | createRoom | OrderEngine |
| `cash_interest_rate` (numeric) | createRoom | OrderEngine |
| `margin_interest_rate` (numeric) | createRoom | OrderEngine |
| `short_selling_enabled` (boolean) | createRoom | OrderEngine, UI |
| `maintenance_margin` (numeric) | createRoom | OrderEngine.isMarginCall |
| `margin_call_grace_ticks` (int) | createRoom (Fase A) | OrderEngine.initParams (Fase A) |
| `started_at` (timestamptz) | startRoom (status=active) | — |
| `completed_at` (timestamptz) | completeRoom (status=completed) | — |
| **Fase E** — master refresh recovery state (migration 005) | | |
| `last_tick_index` (int, NOT NULL DEFAULT 0) | persistMasterState every 5 ticks | resumeSession (fast-forward) |
| `last_close` (numeric) | persistMasterState every 5 ticks | resumeSession (chart seed; GBM new initialPrice) |
| `data_mode` (text, NOT NULL DEFAULT 'historical') | persistMasterMode at startSession | resumeSession (which engine path) |
| `scenario_index` (int, nullable) | persistMasterMode (resolved value, never original null) | resumeSession (which ticker) |
| `last_tick_at` (timestamptz) | persistMasterState every 5 ticks | getResumableRoom ORDER BY |
| **Fase E.1** — deterministic historical replay identity (migration 006) | | |
| `source_key` (text) | persistMasterMode at startSession | resumeSession (sanity check; warns on mismatch) |
| `start_day` (int) | persistMasterMode at startSession | resumeSession → prepareSeries.startDay |
| `mirror` (boolean) | persistMasterMode at startSession | resumeSession → prepareSeries.mirror |
| `target_price` (numeric) | persistMasterMode at startSession | resumeSession → prepareSeries.targetPrice |
| `created_at` (timestamptz) | DB | UI |
| `updated_at` (timestamptz) | every updateRoom | — |

**Status values used:** `'waiting'` (default), `'active'`, `'paused'`, `'completed'`, `'deleted'`

**Recovery write contract (Fase E.2):** `persistMasterMode` returns `{ ok, error }`. Historical sessions block on this write at startSession; if it fails, the room stays in `'waiting'` and an error is shown. GBM sessions are best-effort — a missed write only costs a slightly older recovery point.

**Index for resume queries (migration 005):**
```sql
CREATE INDEX IF NOT EXISTS rooms_master_status_idx
  ON rooms (master_id, status)
  WHERE status IN ('active', 'paused');
```

### `participants` — ACTUAL columns

| Column | Set when | Used by |
|---|---|---|
| `id` (uuid) | DB | order-engine, room-manager |
| `room_id` (uuid → rooms) | joinRoom | RLS |
| `user_id` (uuid → auth.users) | joinRoom | RLS, queries |
| `display_name` (text) | joinRoom | leaderboard |
| `cash` (numeric) | init=starting_cash, then updates | equity calc |
| `shares` (int) | OrderEngine.applyFill via syncParticipant | leaderboard, refresh |
| `short_shares` (int) | applyFill | leaderboard |
| `avg_cost` (numeric) | applyFill | unrealized P&L |
| `short_avg_cost` (numeric) | applyFill | unrealized P&L |
| `realized_pnl` (numeric) | applyFill | leaderboard |
| `total_commissions` (numeric) | applyFill | account display |
| `accrued_interest` (numeric) | tick interest accrual | account display |
| **Fase D** — student state persistence across refresh (migration 004) | | |
| `accrued_margin_interest` (numeric, NOT NULL DEFAULT 0) | applyFill margin interest accrual | hydration on rejoin |
| `last_seen_tick` (int, NOT NULL DEFAULT 0) | sync payload every 5s + on fill | hydration on rejoin |
| `is_connected` (boolean, DEFAULT true) | beforeunload beacon (false on tab close), joinRoom reconnect (true) | master UI CONNECTED/OFFLINE label |
| `joined_at` (timestamptz) | DB | history |

> Note: v1's docs referenced `equity`, `total_pnl`, `margin_status`, `margin_call_tick`. Those names DO NOT EXIST in the current code. Equity is computed live; status is a local UI state.

**Beacon write contract (Fase D.2):** the unload beacon hits `/rest/v1/participants?id=eq.<id>` with `Authorization: Bearer <user-access-token>` (NOT the anon key, which RLS would reject) and `apikey: <anon-key>`. The user token is cached on `window._cachedAccessToken` by `auth.js` and refreshed on every `onAuthChange` event including `TOKEN_REFRESHED`. The beacon bails out if no token is cached.

### `orders` — ACTUAL columns

| Column | Set by | Notes |
|---|---|---|
| `id` (uuid) | DB | |
| `room_id` (uuid) | placeOrder | |
| `participant_id` (uuid) | placeOrder | NOT student_id |
| `user_id` (uuid → auth.users) | placeOrder | for RLS |
| `side` (text) | placeOrder | values: BUY, SELL, SHORT_SELL, BUY_TO_COVER |
| `order_type` (text) | placeOrder | NOT `type`. Values: MARKET, LIMIT, STOP, STOP_LIMIT, TRAILING |
| `qty` (int) | placeOrder | |
| `limit_price` (numeric) | placeOrder if LIMIT/STOP_LIMIT | |
| `stop_price` (numeric) | placeOrder if STOP/STOP_LIMIT | |
| `trail_amount` (numeric) | placeOrder if TRAILING | |
| `tif` (text) | placeOrder | values: GTC, DAY, IOC |
| `status` (text) | DB default + updates | values: WORKING, FILLED, CANCELLED, REJECTED |
| `filled_qty` (int) | applyFill update | NOT `fill_qty` |
| `avg_fill_price` (numeric) | applyFill update | NOT `fill_price` |
| `created_at` (timestamptz) | DB | |
| `updated_at` (timestamptz) | every state change | |

### `session_metrics` — exists, used by saveMetrics

| Column | |
|---|---|
| `room_id` | |
| `participant_id` | |
| `user_id` | |
| `final_cash` | |
| `final_shares` | |
| `final_equity` | |
| `total_pnl` | |
| `pnl_pct` | |
| `num_trades` | |
| `total_commissions` | |
| `total_interest_earned` | |
| `total_margin_interest` | |
| `max_margin_used` | |

## Order sides — CORRECT names

Used throughout `student.html`, `order-engine.js`:

| Side | Action |
|---|---|
| `BUY` | Open or add to long |
| `SELL` | Reduce or close long (NOT used to open shorts) |
| `SHORT_SELL` | Open or add to short |
| `BUY_TO_COVER` | Reduce or close short |

> v1 docs incorrectly said `SHORT` and `COVER`. The actual names use underscores.

## Order types — CORRECT names

Used in `student.html` order entry and `order-engine.js`:

| Type | UI button | Description |
|---|---|---|
| `MARKET` | MKT | Fills at next tick's bid (sell) / ask (buy) |
| `LIMIT` | LMT | Fills at limit_price or better |
| `STOP` | STP | Becomes MARKET when stop crossed |
| `STOP_LIMIT` | S-LMT | Becomes LIMIT when stop crossed |
| `TRAILING` | TRAIL | Trails price by trail_amount |

## Portfolio (in-memory, student.html)

Initialized at line 489 of `student.html`:

```js
let portfolio = {
  cash: 100000,           // starting cash from room
  shares: 0,              // long position qty (always >= 0)
  avgCost: 0,             // weighted avg entry for long
  shortShares: 0,         // short position qty (always >= 0)
  shortAvgCost: 0,        // weighted avg entry for short
  realizedPnl: 0,
  totalCommissions: 0,
  accruedCashInterest: 0,
  accruedMarginInterest: 0,
  orders: [],             // working orders (local mirror of DB)
  executions: []          // fills (local history)
};
```

Note: longs and shorts are tracked **separately**. A student can theoretically be both long AND short at once (it's not blocked, though the user said the policy is one position at a time).

## Margin call state machine (student.html)

Local state, not persisted:

```js
let marginCallState = {
  active: false,
  totalGraceTicks: 30,        // set from sessionParams.marginCallGraceTicks (Fase A fix)
  ticksRemaining: 0,
  liquidationExecuted: false
};
```

Transitions per tick:
- `OK` → `WARNING` (equity ratio between 1.05× and 1.0× of maintenance)
- `WARNING` → `MARGIN_CALL` (equity ratio < 1.0× of maintenance)
- `MARGIN_CALL` (countdown)
  - if equity recovers → back to `OK` or `WARNING`
  - if grace expires → `executeForcedLiquidation` → all positions closed at market → `OK`

## Realtime channels (code-verified)

The master/student do NOT key channels by room code. They use the room UUID:

### Broadcast channel (master → students)
- Name: `room:${roomId}` where `roomId` is the **`rooms.id` UUID** (NOT `code`)
- Master uses `{ broadcast: { self: false } }` config
- Master sends 3 broadcast events:
  - `price_tick` — payload: candle object
  - `param_change` — payload: e.g., `{ ticker: 'BTC' }`
  - `sim_control` — payload: `{ action: 'play' | 'pause' | 'resume' | 'end' | 'reset' }` (NOTE: event name is `sim_control`, NOT `control`)
- Students subscribe to the same channel and listen for these 3 events.

### Postgres-changes channel (master only)
- Name: `room_db:${roomId}`
- Subscribes to `postgres_changes` on `participants` and `orders` (filter `room_id=eq.${roomId}`)
- **Used by `master.html`'s waiting-room screen** to refresh the participant list as students join
- The simulation-screen leaderboard does NOT use this channel. It uses a separate `setInterval` (~1-2 sec) calling `RoomManager.getParticipants()` and recomputing equity client-side from `cash + longValue - shortLiability`. See `master.html` `startLeaderboardUpdates()` around line 1157.

### Other tables referenced by code (not in v1 docs)
- **`profiles`** — user profile metadata (display name, avatar). Created at sign-up.
- **`session_metrics`** — final session results (final cash/equity, P&L, trades count, max margin used). Inserted once by `OrderEngine.saveMetrics` at session end.
- **`participants.is_connected`** — boolean flag. Set to `true` only on **reconnect** (the `joinRoom` reconnection branch updates the existing row). It is NOT updated by a heartbeat or presence loop. The master UI labels rows as `CONNECTED`/`OFFLINE` based on this flag.
- **`executions`** — referenced in code paths but populated less consistently than `orders.filled_qty`. Verify in `order-engine.js` before relying on it as a source of truth.

> Recommended: read `room-manager.js` lines 200-280 and `student.html` channel handlers to confirm any field before assuming.

## What the v1 docs got wrong

If you read `docs/02-DATA-MODELS.md`, ignore these:
- ❌ Order side `SHORT` / `COVER` → should be `SHORT_SELL` / `BUY_TO_COVER`
- ❌ Order DB column `type` → should be `order_type`
- ❌ Order DB column `fill_qty` / `fill_price` → should be `filled_qty` / `avg_fill_price`
- ❌ Participants column `student_id` → should be `user_id`
- ❌ Participants column `equity` (it's computed, not stored)
- ❌ Participants column `total_pnl` (computed)
- ❌ Participants column `margin_status` (local state, not stored)
- ❌ Orders column `student_id` → should be `participant_id` + `user_id`

This v2 document is correct. Use it.
