# 00 — Product Overview

## What this is (read carefully)

Technetos is **NOT** a paper trading simulator. The phrase that captures it best:

> *"It is a controlled laboratory where the professor pauses, accelerates, and rewinds market scenarios so students can experience exactly what an order does in different market conditions."*

The user (a finance professor) was emphatic that this is **NOT**:

- Portfolio management practice (StockTrak does that)
- Strategy backtesting (TradingView does that)
- Algorithmic trading (QuantConnect does that)
- "Compete against classmates to make the most money" (most paper trading does that)

It IS:

- A teaching tool for **how stock orders behave under controlled conditions**
- A platform where the professor demonstrates: *"Watch what happens when I trigger a stop in a flash crash"* / *"See how the trailing stop adjusts as the price climbs"*
- A simulator that uses **real historical data** (transformed) so the chart reactions feel authentic — not synthetic GBM noise

## Why prices are real but anonymized

Real OHLC data has characteristics that GBM cannot reproduce:
- Real volatility clustering, gaps, news shocks, regime changes
- Authentic candle wick distributions, body sizes, volume patterns
- Realistic patterns (double tops, head & shoulders) that emerge from actual market psychology

But the professor doesn't want students saying *"oh that's AAPL in 2022, I'll just remember what happened"*. So the data is:

1. **Scaled** by `target_price / first_close` — moves the price level to e.g. $80–$300 random
2. **Optionally mirrored** (~30% chance) — inverts bull/bear, swapping highs/lows
3. **Renamed** to fictitious names: AAPL → "Quantum Corp (Tech)", BTCUSD → "Cobalt Chain (Crypto)"

The professor knows the mapping (sector hint helps); the student does not.

## 19 series available

Order matches alphabetical ticker keys:

| # | Ticker | Scenario Name (shown to student) | Sector |
|---|--------|----------------------------------|--------|
| 0 | AAPL | Quantum Corp | Tech |
| 1 | AMD | Echo Robotics | Tech |
| 2 | AMZN | Nexus Digital | Consumer |
| 3 | BA | Sterling Motors | Industrial |
| 4 | BAC | Polaris Finance | Banking |
| 5 | BTCUSD | Cobalt Chain | Crypto |
| 6 | CVX | Vertex Energy | Energy |
| 7 | ETHUSD | Meridian Chain | Crypto |
| 8 | GOOGL | NovaTech | Tech |
| 9 | GS | Zenith Capital | Banking |
| 10 | JNJ | Atlas Bio | Healthcare |
| 11 | JPM | Orion Holdings | Banking |
| 12 | KO | Pinnacle Foods | Consumer |
| 13 | MSFT | Apex Industries | Tech |
| 14 | NVDA | Titan Dynamics | Tech |
| 15 | PFE | Crescent Pharma | Healthcare |
| 16 | SPY | Vanguard Index | Index |
| 17 | TSLA | Helix Motors | Volatile |
| 18 | XOM | Sapphire Mining | Energy |

## Hard constraints from the user

These cannot be changed without explicit approval:

1. **Bloomberg Terminal aesthetic** — dark theme, orange accents, monospace fonts, dense data display
2. **Branding:** Technetos | The Best in Town
3. **Interface language:** English (for the UI)
4. **Communication with the user:** Spanish (for chats, commits in EN are OK)
5. **Max 50 students per session**
6. **Email/password auth via Supabase** (no OAuth, no passwordless)
7. **Persistent session history** in Supabase
8. **Leaderboard ranks by Total Equity** (not P&L)
9. **Master controls everything** — students cannot affect each other or the simulation
10. **Real data, not GBM** is the default mode (GBM kept as fallback)

## What the user has explicitly disliked (do not reintroduce)

- ❌ "Pattern injection" (synthetic patterns spliced into GBM) — was unrealistic, removed
- ❌ Pattern dropdown in the simulation toolbar — removed
- ❌ Horizontal price lines for pattern annotations on chart — too noisy
- ❌ Wicks that span impossible ranges (high-low > 5×body)
- ❌ Candles where all greens during bull, all reds during bear (unrealistic)
- ❌ Same pattern repeating infinitely (one shot, then back to natural flow)
- ❌ Master and student dashboards too vertical (preference: horizontal layout)
- ❌ Speeds 5x and 10x (too fast for teaching) — replaced with ⅓x, ⅔x, 1x, 2x

## Future (not yet implemented, discussed)

- **Modo Clase** (demo mode for the professor — auto-narrate what's happening)
- **Mobile version for students**
- **TradingView Charting Library integration** (replace lightweight-charts + ta-engine.js with the full Charting Library — has all 50+ indicators and drawing tools out of the box)

## Where credits/cost matter

The user explicitly asked to optimize credit usage:
- Batch changes into single PRs (not one PR per change)
- Skip browser verification (the user tests directly)
- Minimize web searches
- Group all requested changes before building/pushing
