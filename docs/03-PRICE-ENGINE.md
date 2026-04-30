# 03 — Price Engine

The price engine has TWO modes that produce identical-shaped output (a `candle` object with OHLCV + bid/ask), but generate the data very differently.

## Mode 1: HISTORICAL (default)

Replays real OHLC daily data from FMP. The data was downloaded once and bundled into `historical-bundle.js` (19 tickers × ~5 years of daily bars). The engine:

1. **Picks a series** at `prepareSeries(scenarioIndex)`:
   - If `scenarioIndex` is null → random ticker
   - If specified (0–18) → that ticker
   - Random start day within the series (so the same scenario isn't always the same window)
   - Limited to `maxCandles: 500` per session

2. **Transforms it** to be unrecognizable:
   - **Scale**: multiplies all prices by `targetPrice / firstClose`. The student sees prices like $187.45 but if the original was AAPL at $132.85, every value is scaled by ~1.41.
   - **Optional mirror** (~30% chance): inverts price changes around the `firstClose` pivot. A bull run becomes a bear; highs and lows swap. This is done via `mirrored = 2 * pivot - original` formula.

3. **Adds bid/ask spread** at output:
   - `spread = close * (spreadBps / 10000)` (default 10 bps = 0.10%)
   - `bid = close - spread/2`, `ask = close + spread/2`

4. **Returns one candle per call to `nextCandle()`** until exhausted (returns `null`).

## Mode 2: GBM (fallback)

Geometric Brownian Motion. Used when historical mode is disabled or data not loaded.

Step:

```
dt = 1/252                                      // one trading day
z = randn()                                     // Box-Muller
drift_term = (μ - 0.5σ²) * dt
diffusion = σ * √dt * z
new_price = old_price * exp(drift_term + diffusion)
```

Then `_realisticOHLC(basePrice, vol, prevClose)` builds the candle:

```
dayVol = σ / √252
gap_mult = 1 + (rand-0.5) * dayVol * 0.15        // small gap from prev close
open = prevClose * gap_mult
direction = rand < 0.5 ? +1 : -1                 // RANDOM color, not following drift
bodySize = dayVol * (0.2 + rand * 0.6)
close = open * (1 + direction * bodySize)
body = |close - open|
wickFactor = 0.3 + rand * 0.5                    // 30-80% of body
high = max(open, close) + body * wickFactor * rand
low  = min(open, close) - body * wickFactor * rand
```

Key design choice (per user feedback):
- **Candle direction is RANDOM**, not aligned with GBM drift. Otherwise charts looked unnatural ("all green during uptrend, all red during downtrend"). Real markets have green and red candles mixed regardless of trend direction.
- **Wicks are proportional to body**, not extreme. Earlier versions had wicks 5×body which looked impossible.
- **Open anchored to prevClose** with small gap. Earlier versions had random gaps that made the chart look "illiquid".

## Why two modes?

The professor strongly preferred historical mode because:
- Real data has authentic patterns (earnings reactions, news shocks, regime changes)
- GBM noise is noticeably different from real markets, especially for technical analysis
- Students can experience real volatility patterns (e.g., COVID crash, BTC rallies)

GBM is kept as a fallback in case data fails to load or for special teaching scenarios.

## What was REMOVED from the price engine

The engine used to support **synthetic pattern injection** (splicing in a head & shoulders, double top, etc. between GBM ticks). The user disliked this because:
- The patterns looked unnatural
- They repeated infinitely when manually selected
- The transitions were jarring

All pattern code was deleted (PR #21). Current `price-engine.js` is 181 lines vs. the old 479 lines. If patterns are ever wanted again, look at the git history pre-PR #21.

## Bid/Ask spread

Default is 10 bps (`spread_bps: 10`). This is added in BOTH modes:
- Historical: in `HistoricalData.nextCandle()`
- GBM: in `PriceEngine._nextCandleGBM()`

The student's order engine uses `bid` for SELL fills and `ask` for BUY fills. This creates realistic slippage on every trade.

## Time axis

`lightweight-charts` requires ascending UNIX timestamps. The engine uses:
- Historical: `baseTime + i` (one second per tick on the time axis, even though the underlying data is daily — this is a display choice)
- GBM: `_baseTime + tickIndex` (same logic)

This means the time axis labels do not represent real time. They are sequential tick numbers presented as timestamps. The user is fine with this; the focus is on order behavior, not real-clock simulation.

## Key invariants

- `nextCandle()` returns `null` when historical series is exhausted (signals "session over" to the master)
- `tickIndex` is monotonic, never decreases
- `prevClose` always equals the previous tick's `close`
- After `reset()`, all state is fresh
- Candles are pushed to `this.candles[]` for in-memory history (used by indicators and drawings)

## Optimization opportunities

- The historical bundle is loaded as a single 1.25 MB blob. Could be split per-ticker and lazy-loaded.
- `this.candles[]` grows unbounded — could cap at e.g., last 1000 for memory.
- The `mirror` transformation is uniform — could vary per swing for more variety.
- No support for "scenario library" (saving a specific transformed series for repeatable lessons).
