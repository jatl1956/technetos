import { describe, it, expect, beforeEach } from 'vitest';
const OrderEngine = require('../multiplayer/order-engine.js');

/**
 * Helper: build a fresh portfolio in a known state.
 */
function freshPortfolio(overrides = {}) {
  return {
    cash: 100000,
    shares: 0,
    avgCost: 0,
    shortShares: 0,
    shortAvgCost: 0,
    realizedPnl: 0,
    totalCommissions: 0,
    accruedCashInterest: 0,
    accruedMarginInterest: 0,
    orders: [],
    executions: [],
    ...overrides
  };
}

/**
 * Helper: minimal session params.
 */
function setSessionParams(overrides = {}) {
  OrderEngine.sessionParams = {
    maxLeverage: 2.0,
    commissionPerShare: 0.005,
    minCommission: 1.00,
    cashInterestRate: 0.02,
    marginInterestRate: 0.08,
    shortSellingEnabled: true,
    maintenanceMargin: 0.25,
    startingCash: 100000,
    marginCallGraceTicks: 30,
    ...overrides
  };
}

beforeEach(() => {
  setSessionParams();
});

// ====================================================================
// initParams
// ====================================================================

describe('initParams', () => {
  it('reads room config into sessionParams with parseFloat/parseInt', () => {
    OrderEngine.initParams({
      max_leverage: '4.0',
      commission_per_share: '0.01',
      min_commission: '2.50',
      cash_interest_rate: '0.03',
      margin_interest_rate: '0.10',
      short_selling_enabled: false,
      maintenance_margin: '0.30',
      starting_cash: '50000',
      margin_call_grace_ticks: '15'
    });
    expect(OrderEngine.sessionParams.maxLeverage).toBe(4.0);
    expect(OrderEngine.sessionParams.commissionPerShare).toBe(0.01);
    expect(OrderEngine.sessionParams.minCommission).toBe(2.50);
    expect(OrderEngine.sessionParams.shortSellingEnabled).toBe(false);
    expect(OrderEngine.sessionParams.maintenanceMargin).toBe(0.30);
    expect(OrderEngine.sessionParams.startingCash).toBe(50000);
    expect(OrderEngine.sessionParams.marginCallGraceTicks).toBe(15);
  });

  it('uses sensible defaults when a field is missing', () => {
    OrderEngine.initParams({});
    expect(OrderEngine.sessionParams.maxLeverage).toBe(2.0);
    expect(OrderEngine.sessionParams.maintenanceMargin).toBe(0.25);
    expect(OrderEngine.sessionParams.marginCallGraceTicks).toBe(30);
  });

  it('treats short_selling_enabled missing as enabled (=== false check)', () => {
    OrderEngine.initParams({});
    expect(OrderEngine.sessionParams.shortSellingEnabled).toBe(true);
  });

  it('treats short_selling_enabled=false correctly', () => {
    OrderEngine.initParams({ short_selling_enabled: false });
    expect(OrderEngine.sessionParams.shortSellingEnabled).toBe(false);
  });
});

// ====================================================================
// isOpeningOrder (added in Fase A)
// ====================================================================

describe('isOpeningOrder', () => {
  it('BUY opens a long', () => {
    expect(OrderEngine.isOpeningOrder('BUY')).toBe(true);
  });
  it('SHORT_SELL opens a short', () => {
    expect(OrderEngine.isOpeningOrder('SHORT_SELL')).toBe(true);
  });
  it('SELL closes a long, not opening', () => {
    expect(OrderEngine.isOpeningOrder('SELL')).toBe(false);
  });
  it('BUY_TO_COVER closes a short, not opening', () => {
    expect(OrderEngine.isOpeningOrder('BUY_TO_COVER')).toBe(false);
  });
  it('unknown side returns false (defensive)', () => {
    expect(OrderEngine.isOpeningOrder('FOO')).toBe(false);
    expect(OrderEngine.isOpeningOrder(undefined)).toBe(false);
    expect(OrderEngine.isOpeningOrder(null)).toBe(false);
  });
});

// ====================================================================
// generateLiquidationOrders (added in Fase A)
// ====================================================================

describe('generateLiquidationOrders', () => {
  it('returns empty when portfolio is flat', () => {
    const p = freshPortfolio();
    expect(OrderEngine.generateLiquidationOrders(p, 100)).toEqual([]);
  });

  it('generates SELL for long-only', () => {
    const p = freshPortfolio({ shares: 50, avgCost: 90 });
    const orders = OrderEngine.generateLiquidationOrders(p, 100);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toEqual({ side: 'SELL', qty: 50 });
  });

  it('generates BUY_TO_COVER for short-only', () => {
    const p = freshPortfolio({ shortShares: 30, shortAvgCost: 110 });
    const orders = OrderEngine.generateLiquidationOrders(p, 100);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toEqual({ side: 'BUY_TO_COVER', qty: 30 });
  });

  it('generates both when long and short exist together', () => {
    const p = freshPortfolio({ shares: 25, shortShares: 40 });
    const orders = OrderEngine.generateLiquidationOrders(p, 100);
    expect(orders).toHaveLength(2);
    expect(orders.find(o => o.side === 'SELL').qty).toBe(25);
    expect(orders.find(o => o.side === 'BUY_TO_COVER').qty).toBe(40);
  });

  it('does not include zero-qty orders', () => {
    const p = freshPortfolio({ shares: 0, shortShares: 0 });
    expect(OrderEngine.generateLiquidationOrders(p, 100)).toEqual([]);
  });
});

// ====================================================================
// calcCommission
// ====================================================================

describe('calcCommission', () => {
  it('uses min commission for very small qty', () => {
    setSessionParams({ commissionPerShare: 0.005, minCommission: 1.00 });
    expect(OrderEngine.calcCommission(10)).toBe(1.00); // 10 * 0.005 = 0.05 < 1
  });

  it('uses per-share for large qty', () => {
    setSessionParams({ commissionPerShare: 0.005, minCommission: 1.00 });
    expect(OrderEngine.calcCommission(1000)).toBe(5.00); // 1000 * 0.005 = 5
  });

  it('boundary: exactly at the min', () => {
    setSessionParams({ commissionPerShare: 0.005, minCommission: 1.00 });
    // 200 * 0.005 = 1.00 exactly
    expect(OrderEngine.calcCommission(200)).toBe(1.00);
  });

  it('respects custom commission rates', () => {
    setSessionParams({ commissionPerShare: 0.01, minCommission: 2.00 });
    expect(OrderEngine.calcCommission(100)).toBe(2.00);   // 1.00 < 2.00 → min
    expect(OrderEngine.calcCommission(500)).toBe(5.00);   // 5.00 > 2.00 → per-share
  });
});

// ====================================================================
// calcEquity
// ====================================================================

describe('calcEquity', () => {
  it('cash-only portfolio = cash', () => {
    const p = freshPortfolio({ cash: 50000 });
    expect(OrderEngine.calcEquity(p, 100)).toBe(50000);
  });

  it('long position adds market value at current price', () => {
    const p = freshPortfolio({ cash: 50000, shares: 100, avgCost: 90 });
    // equity = 50000 + 100*100 = 60000 (regardless of entry price)
    expect(OrderEngine.calcEquity(p, 100)).toBe(60000);
  });

  it('short position subtracts liability at current price', () => {
    const p = freshPortfolio({ cash: 110000, shortShares: 100, shortAvgCost: 110 });
    // After SHORT_SELL of 100 @ 110, cash is +110000 (proceeds), shortShares=100.
    // If price is 100, liability = 100*100 = 10000
    // equity = 110000 + 0 (no longs) - 10000 = 100000 (back to start)
    expect(OrderEngine.calcEquity(p, 100)).toBe(100000);
  });

  it('mixed long + short', () => {
    const p = freshPortfolio({
      cash: 50000,
      shares: 50,        // long  50 @ ?
      shortShares: 30    // short 30 @ ?
    });
    // equity = 50000 + 50*100 - 30*100 = 50000 + 5000 - 3000 = 52000
    expect(OrderEngine.calcEquity(p, 100)).toBe(52000);
  });
});

// ====================================================================
// isMarginCall
// ====================================================================

describe('isMarginCall', () => {
  it('flat portfolio is never in margin call', () => {
    const p = freshPortfolio();
    expect(OrderEngine.isMarginCall(p, 100)).toBe(false);
  });

  it('long position with healthy equity is OK', () => {
    setSessionParams({ maintenanceMargin: 0.25 });
    const p = freshPortfolio({ cash: 50000, shares: 100 });
    // equity = 50000 + 100*100 = 60000
    // total position value = 10000
    // maint required = 10000 * 0.25 = 2500
    // 60000 > 2500 → OK
    expect(OrderEngine.isMarginCall(p, 100)).toBe(false);
  });

  it('crash scenario triggers margin call for over-leveraged long', () => {
    setSessionParams({ maintenanceMargin: 0.25 });
    // Bought $200k of stock with $100k cash (using margin)
    // cash after BUY 2000 @ 100 = 100000 - 200000 - commission ≈ -100000
    const p = freshPortfolio({ cash: -100000, shares: 2000, avgCost: 100 });
    // At price 50: equity = -100000 + 2000*50 = 0
    // Total position value = 100000
    // Maint required = 100000 * 0.25 = 25000
    // 0 < 25000 → MARGIN_CALL
    expect(OrderEngine.isMarginCall(p, 50)).toBe(true);
  });

  it('short position spike triggers margin call', () => {
    setSessionParams({ maintenanceMargin: 0.25 });
    // Shorted 1000 @ 50, cash credited proceeds
    // cash after SHORT 1000 @ 50 ≈ 100000 + 50000 = 150000
    // shortShares = 1000
    const p = freshPortfolio({ cash: 150000, shortShares: 1000, shortAvgCost: 50 });
    // If price spikes to 200: equity = 150000 - 1000*200 = -50000
    // Total position value = 200000
    // Maint required = 200000 * 0.25 = 50000
    // -50000 < 50000 → MARGIN_CALL
    expect(OrderEngine.isMarginCall(p, 200)).toBe(true);
  });
});

// ====================================================================
// applyFill
// ====================================================================

describe('applyFill', () => {
  it('BUY opens a long position', () => {
    const p = freshPortfolio();
    OrderEngine.applyFill({
      side: 'BUY', qty: 100, fillPrice: 50, value: 5000, commission: 1
    }, p);
    expect(p.shares).toBe(100);
    expect(p.avgCost).toBe(50);
    expect(p.cash).toBe(100000 - 5000 - 1);
  });

  it('BUY adds to long, weighted-average cost', () => {
    const p = freshPortfolio({ shares: 100, avgCost: 50, cash: 95000 });
    OrderEngine.applyFill({
      side: 'BUY', qty: 100, fillPrice: 60, value: 6000, commission: 1
    }, p);
    // New avgCost = (100*50 + 100*60) / 200 = 55
    expect(p.shares).toBe(200);
    expect(p.avgCost).toBe(55);
  });

  it('SELL closes long, books GROSS realized P&L (commission tracked separately)', () => {
    const p = freshPortfolio({ shares: 100, avgCost: 50, cash: 95000 });
    OrderEngine.applyFill({
      side: 'SELL', qty: 100, fillPrice: 60, value: 6000, commission: 1
    }, p);
    expect(p.shares).toBe(0);
    // realizedPnl is GROSS: (60-50)*100 = 1000. Commission goes into totalCommissions.
    expect(p.realizedPnl).toBeCloseTo(1000, 2);
    expect(p.totalCommissions).toBeCloseTo(1, 2);
    expect(p.cash).toBeCloseTo(95000 + 6000 - 1, 2);
  });

  it('SHORT_SELL opens a short position, credits cash', () => {
    const p = freshPortfolio();
    OrderEngine.applyFill({
      side: 'SHORT_SELL', qty: 100, fillPrice: 50, value: 5000, commission: 1
    }, p);
    expect(p.shortShares).toBe(100);
    expect(p.shortAvgCost).toBe(50);
    expect(p.cash).toBe(100000 + 5000 - 1);
  });

  it('BUY_TO_COVER closes short, books GROSS realized P&L', () => {
    // Shorted 100 @ 50, now cover at 40 (profit)
    const p = freshPortfolio({ shortShares: 100, shortAvgCost: 50, cash: 105000 });
    OrderEngine.applyFill({
      side: 'BUY_TO_COVER', qty: 100, fillPrice: 40, value: 4000, commission: 1
    }, p);
    expect(p.shortShares).toBe(0);
    // GROSS realized = (50-40)*100 = 1000
    expect(p.realizedPnl).toBeCloseTo(1000, 2);
    expect(p.totalCommissions).toBeCloseTo(1, 2);
    expect(p.cash).toBeCloseTo(105000 - 4000 - 1, 2);
  });

  it('partial SELL reduces qty, keeps avgCost, books partial GROSS P&L', () => {
    const p = freshPortfolio({ shares: 100, avgCost: 50, cash: 95000 });
    OrderEngine.applyFill({
      side: 'SELL', qty: 40, fillPrice: 60, value: 2400, commission: 1
    }, p);
    expect(p.shares).toBe(60);
    expect(p.avgCost).toBe(50); // unchanged
    // GROSS: (60-50)*40 = 400
    expect(p.realizedPnl).toBeCloseTo(400, 2);
  });

  it('totalCommissions accumulates', () => {
    const p = freshPortfolio();
    OrderEngine.applyFill({ side: 'BUY', qty: 10, fillPrice: 50, value: 500, commission: 1.5 }, p);
    OrderEngine.applyFill({ side: 'SELL', qty: 10, fillPrice: 55, value: 550, commission: 1.5 }, p);
    expect(p.totalCommissions).toBeCloseTo(3, 2);
  });
});

// ====================================================================
// calcBuyingPower
// ====================================================================

describe('calcBuyingPower', () => {
  it('flat portfolio: cash * leverage', () => {
    setSessionParams({ maxLeverage: 2.0 });
    const p = freshPortfolio({ cash: 50000 });
    expect(OrderEngine.calcBuyingPower(p, 100)).toBe(100000);
  });

  it('scales with leverage', () => {
    setSessionParams({ maxLeverage: 4.0 });
    const p = freshPortfolio({ cash: 50000 });
    expect(OrderEngine.calcBuyingPower(p, 100)).toBe(200000);
  });

  it('long position is included in equity base', () => {
    setSessionParams({ maxLeverage: 2.0 });
    const p = freshPortfolio({ cash: 50000, shares: 100 });
    // equity = 50000 + 10000 = 60000
    // BP = 60000 * 2 = 120000
    expect(OrderEngine.calcBuyingPower(p, 100)).toBe(120000);
  });
});
