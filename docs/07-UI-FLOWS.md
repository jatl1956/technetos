# 07 — UI Flows

## Master flow

### Screen 1: Auth overlay
- Sign In / Sign Up tabs (email + password)
- Calls `Auth.signIn()` / `Auth.signUp()`
- On success → showLobby()

### Screen 2: Lobby
- Top: "Master Dashboard" + email + Sign Out button
- Form sections (3-column grid where possible):
  - **Session Name** (single full-width input)
  - **Data Mode** | **Scenario** (dropdown: Random or specific scenario name)
  - **Ticker (display name)** | **Starting Cash** | **Tick Speed (ms)**
  - **Max Leverage** | **Short Selling** | **Maintenance Margin**
  - **Commission/Share** | **Min Commission** | **Cash Int. Rate %**
  - **Margin Int. Rate %** | **Margin Call Grace (ticks)**
- Big orange button: **CREATE SESSION**
- After creation: shows waiting room with 6-letter code

### Screen 3: Waiting room
- Display the join code prominently (e.g., "T68YTE")
- Live participant list (updated via Supabase real-time on `participants` table changes)
- Two buttons: **CANCEL** (delete room) | **START SESSION**

### Screen 4: Simulation (the main view)
- **Top bar:** Logo | Ticker dropdown | Price + change% | MASTER badge | SIMULATION badge | session code | clock | speed buttons (⅓x ⅔x 1x 2x) | Pause/Play | END
- **Chart area** (left, ~75% width):
  - Chart header with TA toolbar (Indicators + Draw + Active + Clear buttons)
  - Candlestick chart with volume bars at bottom
- **Sidebar** (right, 280px fixed):
  - LIVE DASHBOARD (student count)
  - SESSION (Ticker, Price, Candles, Elapsed)
  - LEADERBOARD (sorted by equity)
  - PRICE DATA (Mode, Scenario name, Remaining candles, Tick Speed)
  - MARGIN & FEES (Leverage, Short, Commission, rates, MC Grace)

### Master controls during simulation
- **Pause/Play** — pauses tick loop, broadcasts to students
- **Speed** — changes `tickSpeedMs` divisor (⅓x = 3× slower, 2x = 2× faster)
- **Ticker dropdown** — picks new random scenario, clears chart, broadcasts reset
- **TA toolbar** — adds indicators or starts drawing tools
- **MODIFY PARAMETERS** — opens a modal to edit tick speed (other params locked)
- **END** — confirm dialog → marks room deleted → returns to lobby

## Student flow

### Screen 1: Auth overlay
- Same as master: Sign In / Sign Up

### Screen 2: Join room
- Single input: 6-letter code
- **JOIN** button
- Lookup room by code, validate status, insert into participants
- On success → simulation view

### Screen 3: Simulation
- **Top bar:** Logo | Ticker | Price | clock | "Student {name}" badge
- **Left sidebar (240px):**
  - ORDER ENTRY:
    - BUY / SELL / SHORT / COVER tabs
    - Bid | Spread | Ask display
    - TYPE buttons: MKT, LMT, STP, S-LMT, TRAIL
    - QTY input with -100 / -10 / 100 / +10 / +100 buttons
    - TIF dropdown: GTC / DAY / IOC
    - EST. VALUE display
    - Big colored button: BUY 100 MKT (or similar based on side+type)
  - ACCOUNT panel:
    - Cash, Buying Power, Long Mkt Val, Short Mkt Val, Total Equity, Margin Used, Realized P&L, Unrealized P&L, Total P&L, Commissions, Interest Earned, Margin Interest
  - MARGIN STATUS box (color-coded: green/yellow/red/dark red):
    - Status: OK | WARNING | MARGIN_CALL | LIQUIDATED
    - Maint. Required, Equity Ratio, Equity Surplus
- **Chart area (center):** same as master — chart + TA toolbar
- **Bottom panel:** tabs for POSITIONS | WORKING ORDERS | EXECUTIONS

### Student order placement
1. Click side tab (BUY/SELL/SHORT/COVER)
2. Select order type (MKT/LMT/STP/etc.)
3. Enter qty (typed or via +/- buttons)
4. If LMT/STP/etc., enter price levels
5. Click the big colored BUY/SELL button
6. OrderEngine validates → places → either fills immediately (MKT) or queues
7. Toast confirms order placed
8. Order appears in WORKING ORDERS tab
9. On fill → moves to EXECUTIONS, position updates, P&L updates

## Visual design system

### Color palette (Bloomberg Terminal style)
- Background primary: `#0a0e16` (near-black)
- Background panel: `#0f1420`
- Text primary: `#e1e5ef`
- Text secondary: `#7d8aa3`
- Text muted: `#4a5568`
- Border: `#1e2836`
- Accent orange: `#ff7a1a` (Bloomberg signature)
- Accent cyan: `#00bcd4`
- Green (price up): `#00c853`
- Red (price down): `#ff3d57`
- Yellow (warning): `#ffcc00`

### Typography
- Body: Inter (system fallback)
- Mono / data: JetBrains Mono, ui-monospace
- Logo: Inter heavy

### Layout primitives
- `--radius-md: 4px`
- `--radius-lg: 8px`
- Section labels: 9-11px, uppercase, letter-spacing
- Panels: bordered, padded, rounded
- Spacing: 4px / 8px / 12px / 16px / 24px

## Key UX decisions

- **No tooltips on hover** — would clutter the dense Bloomberg layout
- **Toast notifications** for actions (top-right corner)
- **Modal overlays** for confirmations (e.g., end session)
- **Inline status indicators** (margin status box, ticker price, etc.)
- **Keyboard shortcuts**: Esc cancels drawing mode (no other shortcuts implemented)
- **Number inputs** without spinner buttons (cleaner look)

## Known UI issues

- Lobby is wide (780px) — can be cut off on small windows; has scroll but layout could be more responsive
- Order entry side panel is dense; on small screens it's hard to read
- TA toolbar buttons are tiny (8-10px font) — intentional but could be hard for some users
- No mobile layout (the user is aware; mobile version is a future feature)
- The "Active studies" modal uses `<button>` with × that could be confused with native browser controls
