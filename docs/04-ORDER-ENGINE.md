# 04 — Order Engine

The order engine lives in the **student's** browser (one instance per student). The master never runs an order engine — it only generates prices.

Each student has their own:
- Cash balance
- Positions (long, short, or none — only one ticker per session, so position is a single object)
- Working orders (queued, not yet filled)
- Execution history
- Margin status

## Order types supported

| Type | Description | Required fields |
|---|---|---|
| `MARKET` | Fill immediately at next bid (sell) / ask (buy) | qty |
| `LIMIT` | Fill only if price reaches limit (or better) | qty, limit_price |
| `STOP` | Becomes MARKET when price crosses stop level | qty, stop_price |
| `STOP_LIMIT` | Becomes LIMIT when price crosses stop | qty, stop_price, limit_price |
| `TRAILING` | Stop that follows price by a fixed dollar/% offset | qty, trail_amount or trail_pct |

## Order sides

- `BUY` — open or add to long position
- `SELL` — close or reduce long position (cannot go short via SELL)
- `SHORT` — open or add to short position
- `COVER` — close or reduce short position

This 4-way distinction is intentional. A student must explicitly use SHORT to open a short, and COVER to close it. It makes the mechanics explicit (the user is teaching, after all).

## Order lifecycle

```
PLACE → WORKING (in queue) → FILLED (executed) | CANCELLED
                                ↓
                          updates position
                                ↓
                          updates cash
                                ↓
                          updates equity
```

When an order is placed:
1. Validation (sufficient buying power, valid prices, position constraints)
2. If MARKET → fill immediately against current bid/ask
3. If LIMIT/STOP/etc. → push to working orders queue
4. Insert into Supabase `orders` table

Each subsequent tick (`processTick(candle)`) iterates working orders and checks fill conditions.

## Fill logic per type

### MARKET (BUY)
- Fill at `candle.ask`
- Commission = `max(qty * commission_per_share, min_commission)`
- Cash decreases by `qty * ask + commission`
- Position increases by `qty`

### MARKET (SELL)
- Fill at `candle.bid`
- Commission applied
- Cash increases by `qty * bid - commission`
- Position decreases by `qty`
- Realized P&L = `(bid - avg_entry) * qty - commission`

### LIMIT (BUY)
- Fill if `candle.low <= limit_price`
- Fill price = `min(limit_price, candle.open)` (don't fill better than market open)

### LIMIT (SELL)
- Fill if `candle.high >= limit_price`
- Fill price = `max(limit_price, candle.open)`

### STOP (BUY)
- Trigger if `candle.high >= stop_price`
- Becomes MARKET → fills at next ask (or at stop_price if intra-bar)

### STOP (SELL)
- Trigger if `candle.low <= stop_price`
- Becomes MARKET → fills at bid

### STOP_LIMIT
- Trigger same as STOP
- Becomes LIMIT (does not fill if limit not reached)

### TRAILING (SELL — protecting a long)
- Tracks `peak = max(peak, candle.high)`
- Effective stop = `peak - trail_amount` (or `peak * (1 - trail_pct/100)`)
- Triggers when `candle.low <= effective_stop`

### TRAILING (BUY — protecting a short)
- Tracks `trough = min(trough, candle.low)`
- Effective stop = `trough + trail_amount`
- Triggers when `candle.high >= effective_stop`

## Position model

```js
position = {
  side: 'LONG' | 'SHORT' | 'FLAT',
  qty: 100,                // always positive
  avgEntry: 187.45,        // weighted-average entry price
  realizedPnl: 0,
  marketValue: 0,          // qty * close (long) or -qty * close (short)
  unrealizedPnl: 0
}
```

Only ONE position per student per session (single ticker). Adding to a position averages the entry price. Closing partially reduces qty without changing avgEntry.

## Margin & leverage

Each session has parameters set by the professor:
- `max_leverage` (default 2x)
- `maintenance_margin` (default 25%)
- `margin_int_rate` (default 8% annual, charged per tick)
- `cash_int_rate` (default 2% annual, paid on positive cash per tick)

### Buying power

```
buying_power = (cash + position_market_value) * max_leverage
```

Orders that exceed buying power are REJECTED on placement.

### Margin used

```
margin_used = max(0, position_value - cash)   // when long with leverage
            or
            short_proceeds * maintenance_margin  // when short
```

### Maintenance requirement

```
maintenance_required = position_value * maintenance_margin
```

### Equity

```
equity = cash + market_value(positions)
```

For the leaderboard.

## Margin call mechanic

Per tick, after price update:

1. Compute `equity_ratio = current_equity / starting_equity`
2. Compare against thresholds:
   - `equity > maintenance_required` → status `OK`
   - `equity > maintenance_required * 0.95` → status `WARNING`
   - `equity <= maintenance_required` → status `MARGIN_CALL`
3. When `MARGIN_CALL`:
   - Cancel all working orders
   - Block new positions (only COVER/SELL allowed)
   - Start grace countdown: `margin_call_grace_ticks` (default 30)
   - If equity recovers above threshold → status returns to OK/WARNING
   - If grace expires → status `LIQUIDATED`, position auto-closed at market

## Interest accrual

Every tick:
- Positive cash earns: `cash * (cash_int_rate/100) * (1/252) * (tick_speed_ms/86400000) * 252`
  - Simplified: per-tick interest as if each tick = 1 trading day
- Margin debt costs: same formula but with `margin_int_rate` and negative cash component

Note: this is a teaching simplification. Real brokers accrue interest daily, not per tick. The user accepted this trade-off.

## Commissions

```
commission = max(qty * commission_per_share, min_commission)
```

Default: `$0.005/share`, min `$1.00`.

Applied on every fill (both legs of a round-trip).

## Persistence

- Order placement → INSERT into `orders` table
- Order fill/cancel → UPDATE `orders` table
- Equity changes → UPDATE `participants.equity` (every N ticks, for leaderboard)

If a student refreshes:
- Orders table can be queried to rebuild order history
- BUT current positions/cash are not persisted directly — they would need to be reconstructed from the orders log
- Currently, refresh = lost session. This is a known issue.

## Optimization opportunities

- Persist `cash`, `positions` snapshot in `participants` table for refresh recovery
- Add OCO (One-Cancels-Other) order pairs (common in real trading)
- Add bracket orders (entry + take-profit + stop-loss)
- Add IOC and FOK time-in-force handling (currently only GTC works correctly)
- Margin call grace timer should be visible to student with countdown
- `processTick` is O(working_orders × 1) — fine for small sessions, but could batch DB writes
