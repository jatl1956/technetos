# 06 — Multiplayer (Supabase Realtime)

## Channel model

Each room has a Supabase Realtime channel: `room:{room_code}` (e.g., `room:T68YTE`).

The master is the SOLE broadcaster. Students are listeners.

```
master.broadcast('price_tick', candle)
       ↓
Supabase Realtime relay (wss://...)
       ↓
all subscribed students receive
```

## Message types

### `price_tick`

Sent on every PriceEngine tick.

```js
master:
  channel.send({
    type: 'broadcast',
    event: 'price_tick',
    payload: candle  // see candle format in 02-DATA-MODELS
  });

student:
  channel.on('broadcast', { event: 'price_tick' }, ({ payload }) => {
    onTick(payload);
  });
```

### `control`

Sent on play/pause/end/reset.

```js
master:
  channel.send({
    type: 'broadcast',
    event: 'control',
    payload: { action: 'pause' | 'resume' | 'end' | 'reset' }
  });

student:
  channel.on('broadcast', { event: 'control' }, ({ payload }) => {
    if (payload.action === 'end') leaveSession();
    if (payload.action === 'reset') clearChartAndOrders();
    // ...
  });
```

### `param_change`

Sent when professor changes parameters (currently: ticker change).

```js
master:
  channel.send({
    type: 'broadcast',
    event: 'param_change',
    payload: { ticker: 'BTC' }
  });

student:
  channel.on('broadcast', { event: 'param_change' }, ({ payload }) => {
    if (payload.ticker) updateTickerLabel(payload.ticker);
  });
```

## Lifecycle

### Master creates a room

```
1. Master logs in
2. Master fills lobby form, clicks CREATE SESSION
3. RoomManager.createRoom(params)
   - INSERT into rooms table
   - Generate 6-letter unique code (retry on collision)
   - Subscribe to channel room:{code}
4. Show waiting room with code displayed
5. Master clicks START SESSION
6. PriceEngine.reset() + start tick loop
7. Each tick → broadcast price_tick
```

### Student joins

```
1. Student logs in
2. Student enters 6-letter code, clicks JOIN
3. RoomManager.joinRoom(code)
   - Lookup room by code, verify status='active'
   - INSERT into participants (cash, equity initialized)
   - Subscribe to channel room:{code}
4. Student waits for first price_tick
5. Once received, chart starts populating
```

### Master pauses

```
1. Master clicks pause
2. broadcast('control', { action: 'pause' })
3. Tick loop stops on master
4. Students keep their UI as-is (chart frozen)
5. Working orders remain in queue (no fills while paused)
```

### Master ends

```
1. Master clicks END
2. confirm() dialog
3. broadcast('control', { action: 'end' })
4. UPDATE rooms SET status='deleted' (soft delete)
5. RoomManager.unsubscribeAll()
6. Master returns to lobby
7. Students disconnect, see "session ended" message
```

### Master changes ticker

```
1. Master picks new ticker from topbar dropdown
2. changeTicker(newValue):
   - Update display name in UI
   - PriceEngine.reset() with new random scenario
   - candleSeries.setData([])  // clear chart
   - volumeSeries.setData([])
   - TAEngine.clearAll()
3. broadcast('param_change', { ticker })
4. broadcast('control', { action: 'reset' })
5. Students clear their charts, prepare for new ticks
6. Tick loop continues with new scenario
```

## Reconnection

Supabase Realtime auto-reconnects on network drop. The student sees a brief gap in price ticks but the chart and orders persist.

If the master refreshes mid-session:
- Tick loop dies
- Channel disconnects
- Students stop receiving ticks but their UI is intact
- The room is still `active` in DB
- Students cannot proceed; they need the master to come back

This is acceptable for classroom use (professor is present). A future improvement could persist session state (current candle, tick index, scenario) so the master can resume.

## Concurrency notes

- Only the master writes to `rooms` (via UPDATE)
- Students each write to `participants` (their own row, via UPDATE) and `orders` (INSERT/UPDATE their own)
- RLS policies enforce: students can only modify their own participant row and their own orders
- No cross-student communication (one student's actions don't directly affect another)

## Channel cleanup

When the master ends:
- `channel.unsubscribe()` is called
- Supabase auto-cleans channels with no subscribers after a TTL

When a student leaves:
- Their channel subscription drops
- Their participant row remains in DB (for history)

## Latency

- Master → student: typically 100-200ms via Supabase Realtime
- This is fine for educational sessions
- For production trading this would NOT be acceptable

## Scaling limit

- Max 50 students per session (user-defined hard cap)
- Each student broadcasts nothing — only the master broadcasts
- Supabase free tier supports this easily
- Single channel with 50 listeners is well within limits

## Failure modes

| Scenario | Current behavior | Acceptable? |
|---|---|---|
| Master refreshes | All in-memory state lost; students freeze | Yes (classroom context) |
| Student refreshes | Local order/position state lost; needs to re-join; orders persist in DB | No — should be fixable |
| Network drop on master | Tick pause; auto-resume on reconnect | Yes |
| Network drop on student | Brief gap in ticks; auto-resume | Yes |
| Master logs out | Session orphaned | Acceptable; can be cleaned up by status='active' query |
| Two masters create rooms with same code | Code collision detection retries | Yes |
| Student joins after session ended | RoomManager.joinRoom rejects (status check) | Yes |

## What to optimize

1. **Persist student state** so refresh doesn't lose positions/cash
2. **Persist master state** so refresh can resume the session
3. **Add reconnect indicator** to UI so students know if they're disconnected
4. **Add per-channel rate limit** in case master sends too fast (currently no throttling)
5. **Add "presence"** to show which students are actively connected (Supabase Realtime supports this)
