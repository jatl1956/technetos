# 08 — Known Issues / Optimization Opportunities

This is a curated list of things to focus on during review. Items are roughly ordered by impact.

## High priority

### 1. `master.html` is monolithic (1500+ lines of inlined JS)

The `<script>` block at the bottom has:
- Auth flow handlers
- Lobby + history logic
- Room creation
- Simulation tick loop
- Speed control
- Pause/play/end
- Ticker change → reset logic
- TA toolbar handlers
- Volume series logic
- Settings modal

Splitting into modules would help maintainability. Suggested split:
- `master-controller.js` — main session logic
- `master-ui.js` — DOM updates, toasts, modals
- `master-chart.js` — chart init, volume, candles update
- `master-ta-handlers.js` — toolbar functions

### 2. Same applies to `student.html` (1700+ LOC)

Even worse because it also has order entry logic. Suggested split:
- `student-controller.js`
- `student-order-entry.js` (UI)
- `student-chart.js`
- `student-account.js` (account display logic)

### 3. No tests

Zero. The price engine, order engine, and TA engine all have non-trivial logic that should have unit tests:

- PriceEngine.nextCandle in both modes
- HistoricalData.prepareSeries (scale, mirror correctness)
- OrderEngine.processTick for each order type
- OrderEngine margin calculations
- TA indicator math (SMA, EMA, RSI, MACD, BB)

Recommendation: add a `test/` directory with vitest or jest. Even smoke tests would catch regressions.

### 4. Order engine: short selling P&L edge cases

The current implementation has several places where short positions use `qty * -1` or special branching. Worth a focused review:
- Margin calculation when long + short coexist (currently disallowed but the check isn't airtight)
- Realized P&L for SHORT → COVER: should be `(entry - exit) * qty - commission`
- Trailing buy stop for shorts: the trough tracking has worked in testing but isn't unit-tested

### 5. Student state not persisted across refresh

If a student refreshes, they lose:
- Cash balance (rebuilt from `participants.cash`)
- Position (NOT rebuilt — orders log would need to be replayed)
- Working orders (lost — they aren't replayed from the orders table)
- Realized P&L history (lost)

Fix: on join, query `orders` table for this student, replay them in order, OR store `cash` + `position` snapshot in `participants` table on every fill.

## Medium priority

### 6. CSS duplicated between master.html and student.html

Hundreds of lines of identical CSS in both. Should be moved to a shared `style.css` and inlined by build-inline.js.

### 7. Build process is fragile

`build-inline.js` does string replacement on `<script src="./X.js"></script>`. If someone adds a script tag with attributes (e.g., `defer`), it breaks silently.

The user must also manually copy `dist/multiplayer/master.html` to root `master.html` before pushing. Could be automated.

### 8. No error boundaries

Many `try/catch` blocks just `showToast(e.message)`. Some don't even catch — async errors disappear silently.

Specific places that need attention:
- `RoomManager.createRoom` — if Supabase fails, no rollback
- `OrderEngine.placeOrder` — DB insert can fail after local state updated
- Realtime subscribe failures aren't surfaced to the UI

### 9. RLS policies not in repo

The Supabase RLS policies that govern `rooms`, `participants`, `orders` access are configured in the Supabase dashboard, NOT in `migrations/`. Should be exported as SQL migrations for reproducibility.

### 10. Historical bundle bloats master.html

`historical-bundle.js` is 1.25 MB. Inlining it makes `master.html` 1.4 MB. Slow first load.

Options:
- Keep it as a separate `.js` file, load with `<script src>` (saves first-load time of master.html)
- Lazy-load: only fetch the selected ticker's data when needed
- Move to CDN with cache headers

### 11. No analytics/observability

Nothing logs:
- Who created which sessions
- How long sessions ran
- How many orders students placed
- Error rates

Could add Supabase Edge Function logging or PostHog, but not urgent.

## Low priority / nice-to-have

### 12. Toolbar button labels use HTML entities (`&#x270F;`)

Looks ugly in source. Should use proper SVG icons or Unicode characters directly.

### 13. Number inputs lack validation

Negative qty, zero qty, fractional shares — all allowed. Should have explicit validation.

### 14. Hardcoded values throughout

- Spread color hex codes
- Pane heights (85% / 15% volume)
- Tick speed defaults
- Margin call thresholds

These should be in a `constants.js`.

### 15. Tick interval drifts

`setTimeout(tick, baseSpeed / speedMultiplier)` doesn't compensate for processing time. Over a long session, the actual tick rate drifts. Use `setInterval` or a self-correcting timer.

### 16. No replay/save of sessions

Once a session ends, all the candles are gone. Could save the candle log to allow replay/post-mortem.

### 17. Leaderboard updates are not subscription-based

Master polls `participants` table every N seconds. Could use Supabase Realtime to subscribe to changes. (Was likely chosen for simplicity.)

### 18. Speed button styling

Active button has `class="active"` but the styling differs slightly between master and student. Should be unified.

### 19. Ticker dropdown in topbar loses dropdown styling on focus

When the master clicks the ticker select to change it, the OS-default dropdown appears (browser-styled, not Bloomberg-styled). Custom dropdown component would help.

### 20. No keyboard accessibility

Tab order is poor; many buttons aren't reachable without mouse. ARIA labels missing.

## Documentation gaps

- No `CONTRIBUTING.md`
- No setup instructions for a new developer
- Supabase setup (RLS, tables, auth providers) is undocumented
- The data download script (`download-historical.py`) is in workspace but not in repo

## Performance

- Master with 50 students at 600ms tick speed = 50 broadcasts/600ms = 83/sec — fine
- Each student does 5+ DOM updates per tick — fine for modern browsers
- TA indicator recompute is O(N) per tick — fine for N ≤ 500 candles
- No noticeable lag in testing with 1-2 students; not stress-tested with 50

## Security

- Supabase anon key is exposed in client code (intentional, that's how Supabase works)
- RLS policies must be correct (not in repo, can't audit)
- Auth is email/password only — no rate limiting visible
- No CSP headers (Vercel default)

## Summary recommendation for review

1. Start with `price-engine.js` and `order-engine.js` — these are the core domain logic, most worth solidifying with tests
2. Move on to splitting `master.html` and `student.html` into modules
3. Add persistence for student state (refresh recovery)
4. Address security (auth rate limit, CSP)
5. Add tests as part of any change
