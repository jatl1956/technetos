# Tests

Vitest unit tests for the Technetos engines.

## Run

```bash
npm install
npm test           # run once
npm run test:watch # watch mode
```

## Coverage

| Engine | Tests | What's covered |
|---|---|---|
| **OrderEngine** | 36 | `initParams`, `isOpeningOrder`, `generateLiquidationOrders`, `calcCommission`, `calcEquity`, `isMarginCall`, `applyFill` (BUY/SELL/SHORT_SELL/BUY_TO_COVER + partial), `calcBuyingPower` |
| **PriceEngine** | 16 | `reset`, `nextCandle` (GBM + historical), OHLC consistency, bid/ask spread, time monotonicity, NaN/Infinity guards, `getScenarioInfo` |
| **HistoricalData** | 19 | `loadBundle`, `prepareSeries`, scale + mirror transformations, OHLC consistency post-transform, `nextCandle`, `remaining`, `reset`, scenario name alignment |
| **Total** | **71** | |

## What's intentionally not tested

- DOM-dependent code (chart updates, toolbar handlers) — would need browser mocks
- Supabase calls (`recordFill`, `updateParticipant`, `saveMetrics`) — would need network mocks
- TAEngine (depends on `lightweight-charts` chart instance)

## Engine import in Node

Each engine has a guarded CJS export at the bottom:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OrderEngine;
}
```

This is a no-op in the browser (no `module` global) and lets Node `require` it for tests.

## Notable findings

While writing tests, three observations:

1. **`realizedPnl` is GROSS, not net.** Commission is accumulated separately in `totalCommissions` and deducted from `cash`. This is a documented design choice; tests reflect it.

2. **`isMarginCall` correctly handles both long-overleverage and short-spike** crash scenarios. Verified mathematically.

3. **`applyFill` correctly handles partial fills.** Reducing qty does NOT change `avgCost`, only the qty and realized P&L.
