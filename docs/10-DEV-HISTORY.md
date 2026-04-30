# 10 — Development History (PR Log)

This is a chronological log of the PRs that built the system, useful for understanding why certain decisions were made.

## Phase 0: Foundation
- Initial single-player Bloomberg-style simulator with GBM price generation
- Basic order types (Market, Limit)

## Phase 1-3: Multiplayer foundation (PRs #1–#7)
- Supabase tables: rooms, participants, orders
- Email/password auth
- Realtime broadcasting (master → students)
- 6-letter join codes
- Leaderboard ranked by Total Equity

## Phase 4: Margin & short selling (PR #8)
- `migrations/001_margin_short_fees.sql`: starting cash, max leverage, short toggle, maintenance margin, commissions, interest rates
- Order side: SHORT, COVER
- Margin call detection
- Block new positions when in MC, force liquidation after grace period

## Phase 4.5: Margin call grace (PR #8 + migration 002)
- `migrations/002_margin_call_grace.sql`: `margin_call_grace_ticks` column
- 30-tick grace before liquidation
- Margin Status box: OK / WARNING / MARGIN_CALL / LIQUIDATED

## Phase 6: Technical Analysis tools (PRs #9–#10)
- Upgraded `lightweight-charts` v4 → v5 (native pane support)
- New `ta-engine.js`: SMA, EMA, Bollinger Bands (overlay) + RSI, MACD, Volume (panes)
- Drawing tools: trend line, horizontal line, channel
- TA toolbar in chart header (both master and student)
- PR #10 hotfix: `ta-engine.js` not inlined in build (was 404 in prod)

## Phase 7: Pattern injection (PRs #11–#15) — LATER REMOVED
- Synthetic patterns spliced into GBM stream
- 12 patterns: H&S, double top/bottom, triangles, flags, wedges, cup&handle
- Multiple iterations to make patterns "look realistic"
- User dissatisfied: patterns looked unnatural, repeated, were boring
- All removed in PR #21

## Phase 8: Real historical data (PR #16)
- Downloaded 19 series of 5-year daily OHLC from FMP API
- Created `historical-data.js` engine (loadBundle, prepareSeries, transform, replay)
- Modified `price-engine.js` to support both `historical` and `gbm` modes
- Lobby gained Data Mode + Scenario selectors
- Sidebar shows Mode, Scenario name, Remaining candles
- Auto-stops when data exhausted

## Phase 9: Volume + crypto (PR #17)
- Default volume bars in chart (TradingView style, 25% opacity)
- BTC and ETH added (some FMP tickers gave 402 errors on Basic plan)
- Scenario names with sector hints: "Cobalt Chain (Crypto)", "Quantum Corp (Tech)"

## Phase 10: UI improvements (PR #19)
- Lobby: 3-column grid, larger labels (11px), wider (780px)
- Session History with CLOSE/DEL buttons (later REMOVED)
- Ticker editable from topbar dropdown
- SCENARIO KEY collapsible table (later REMOVED)
- Speeds: 1/3x, 2/3x, 1x, 2x (replaced 1x, 2x, 5x, 10x — too fast for teaching)

## Phase 11: Cleanup (PRs #20–#22)
- PR #20: Lobby horizontal layout fixes, ticker change restarts series, removed pattern dropdown
- PR #21: Removed ALL pattern code, removed Session History panel (was unreliable)
- PR #22: END button now marks session as deleted (clean lobby return)

## Phase 12: Drawing tools refinement (PR #23)
- Trendline fixed: only draws from p1 forward, auto-extends with new candles
- Channel removed (3-click was clunky)
- Horizontal Ray added (1-click, dashed, extends right)

## Current state (post-PR #23)
- 19 historical series available, 2 of them crypto (BTC, ETH)
- 6 indicators (SMA, EMA, BB, RSI, MACD, Volume)
- 3 drawing tools (Horizontal Line, Trend Line, Horizontal Ray)
- 5 order types (Market, Limit, Stop, Stop-Limit, Trailing)
- 4 sides (Buy, Sell, Short, Cover)
- Margin trading with grace period
- Real OHLC data, transformed to be unrecognizable

## Things removed and never added back

- Pattern injection system
- Session History panel in lobby (CLOSE/DEL buttons)
- Scenario Key equivalence table in lobby
- Pattern dropdown in simulation toolbar
- Channel drawing tool
- Speeds 5x and 10x
- Horizontal price lines for pattern annotations

## Things discussed but not built

- Modo Clase (auto-narrating demo mode for the professor)
- Mobile version for students
- Migration to TradingView Charting Library (would replace lightweight-charts + ta-engine.js)
- Saved scenarios (replayable specific instances)
- Refresh recovery for students
- OCO and bracket orders
