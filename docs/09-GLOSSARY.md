# 09 — Glossary

Domain terms used throughout the codebase, in alphabetical order.

## Trading & Market Microstructure

**Ask** — Price at which a market participant is willing to SELL. Buyers pay the ask. In our spread model: `ask = close + spread/2`.

**Bid** — Price at which a market participant is willing to BUY. Sellers receive the bid. `bid = close - spread/2`.

**Bid-Ask Spread** — Difference between bid and ask. Measured in basis points (bps). Default in our sim: 10 bps = 0.10% of price.

**bps (basis points)** — 1 bp = 0.01% = 0.0001. So `spread_bps = 10` means `spread = 0.001 * price`.

**Candle / OHLC bar** — Price summary for a time window: open, high, low, close. Optionally with volume.

**Cover** — Closing a short position. The student "covers" by buying back the shares they sold short.

**Day order (DAY)** — Time-in-force: order expires at end of trading day if not filled.

**Equity** — Total account value: `cash + market_value(positions)`. Used for the leaderboard.

**Equity Ratio** — `current_equity / starting_equity`. Used to detect margin call.

**Fill** — Execution of an order. A market order fills immediately; limits/stops fill when conditions are met.

**FOK (Fill-or-Kill)** — TIF that requires complete immediate fill or full cancellation. NOT implemented.

**GBM (Geometric Brownian Motion)** — Stochastic process used in financial modeling. Price evolves as `dS = μS dt + σS dW`. Our fallback price generator.

**GTC (Good-Til-Canceled)** — TIF that keeps the order working until filled or manually cancelled. Default in our sim.

**IOC (Immediate-or-Cancel)** — TIF that fills what it can immediately, cancels the rest. NOT properly implemented (treated as MARKET).

**Leverage** — Ability to control more position value than your cash. `2x leverage` means you can hold $200k in stock with $100k cash.

**Limit Order (LMT)** — Order to buy at a price ≤ limit, or sell at price ≥ limit. May not fill if market doesn't reach the level.

**Liquidation** — Forced closing of a position. Triggered when margin call grace period expires without recovery.

**Long Position** — Owning shares (positive qty). Profits when price goes up.

**Maintenance Margin** — Minimum equity required to hold a leveraged position. Default 25% of position value.

**Margin Call** — When equity falls below maintenance requirement. Triggers grace period; if not resolved, leads to liquidation.

**Margin Used** — Amount of borrowed buying power currently in use. Affects interest charged.

**Mark-to-Market (MTM)** — Updating position value to current market price every tick.

**Market Order (MKT)** — Order to fill immediately at best available price (bid for sell, ask for buy).

**OHLC** — Open, High, Low, Close. The four price points of a candle.

**Order** — An instruction to buy or sell at specified conditions.

**Position** — Current holdings: side (long/short), qty, average entry price.

**P&L (Profit and Loss)** — Difference between current value and cost basis.
- **Realized P&L** — From closed trades. Locked in.
- **Unrealized P&L** — From open positions. Floating, depends on current price.

**Position Sizing** — Choosing qty for an order. Constrained by buying power and leverage.

**Short Position** — Borrowing and selling shares hoping to buy back lower (negative qty conceptually). Profits when price goes down.

**Slippage** — Difference between expected fill price and actual fill price. In our sim, it comes from the bid-ask spread.

**Spread** — Bid-ask spread. See above.

**Stop Order (STP)** — Order that becomes a MARKET when price crosses stop level. Used to cap losses or trigger entries on momentum.

**Stop-Limit Order (S-LMT)** — Order that becomes a LIMIT when price crosses stop level. Has both stop_price and limit_price.

**TIF (Time-in-Force)** — How long an order stays active: GTC, DAY, IOC, FOK.

**Trailing Stop (TRAIL)** — Stop that adjusts as price moves favorably. Locks in profit while letting winners run.

**Volume** — Number of shares traded in a given period. Often shown as histogram bars below price chart.

## Statistics & Indicators

**EMA (Exponential Moving Average)** — Weighted moving average where recent prices have higher weight. `α = 2/(N+1)`.

**SMA (Simple Moving Average)** — Plain average of last N closes.

**RSI (Relative Strength Index)** — Momentum oscillator (0-100). Above 70 = overbought, below 30 = oversold.

**MACD (Moving Average Convergence Divergence)** — Trend/momentum indicator. Three lines: MACD (fast EMA - slow EMA), Signal (EMA of MACD), Histogram.

**Bollinger Bands** — Volatility envelope: middle band (SMA) ± 2 standard deviations.

**Standard Deviation (σ)** — Measure of price variability. Used in volatility calculations and Bollinger Bands.

**Volatility** — Typically annualized standard deviation of returns. Default 25% in our GBM mode.

**Drift (μ)** — Mean return per period. Default 8% annual in GBM.

## Technical & Architecture

**Realtime / Channel** — Supabase Realtime broadcasts. Each room has a channel.

**RLS (Row-Level Security)** — Postgres feature for per-row access control. Used by Supabase to enforce access rules.

**Tick** — One iteration of the simulation loop. Default `tickSpeedMs = 600` (one tick every 600ms).

**Tick Index** — Sequential tick number, starting at 0. Used for grace period countdowns.

**Lightweight Charts** — Open-source charting library from TradingView. We use v5.1.0 with native pane support.

**Bundle (historical bundle)** — The 1.25 MB file containing all 19 ticker series.

**Scenario** — A specific historical series after transformation. The student sees a fictitious name; the professor knows the source ticker via the SCENARIO_NAMES array.

**Mode (price mode)** — `historical` (replays real data) or `gbm` (synthesizes data).

## Education context

**Order mechanics** — How orders work: types, conditions, fills, slippage. The teaching focus of Technetos.

**Paper trading** — Simulated trading with virtual money but real market data. NOT what Technetos is.

**Lab simulation** — Controlled environment where the instructor manipulates conditions to demonstrate specific concepts. THIS is what Technetos is.

**Modo Clase** (future) — Demo mode where the professor narrates events while the system auto-illustrates concepts.
