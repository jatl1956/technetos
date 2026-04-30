/**
 * Fase D — Persistence tests.
 *
 * These tests verify that the SHAPE of data persisted to and read from
 * the participants table matches what the application code expects.
 *
 * Since we can't talk to a real Supabase here, we test the mapping logic
 * (DB row → portfolio, portfolio → DB row) in isolation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
const OrderEngine = require('../multiplayer/order-engine.js');

/**
 * Helper: simulate the DB row shape that joinRoom returns.
 */
function makeParticipantRow(overrides = {}) {
  return {
    id: 'participant-uuid-123',
    room_id: 'room-uuid-456',
    user_id: 'user-uuid-789',
    display_name: 'Alice',
    cash: '105000.50',                    // numeric → string from PG
    shares: 0,
    avg_cost: '0',
    short_shares: 0,
    short_avg_cost: '0',
    realized_pnl: '0',
    total_commissions: '0',
    accrued_interest: '0',
    accrued_margin_interest: '0',         // Fase D: new column
    last_seen_tick: 0,                    // Fase D: new column
    is_connected: true,
    joined_at: '2026-04-30T14:00:00Z',
    ...overrides
  };
}

/**
 * Helper: hydration logic extracted from student.html startStudentSim.
 * Mirrors what the live code does but as a pure function so we can test it.
 */
function hydratePortfolioFromRow(row) {
  return {
    cash: parseFloat(row.cash),
    shares: row.shares || 0,
    avgCost: parseFloat(row.avg_cost) || 0,
    shortShares: row.short_shares || 0,
    shortAvgCost: parseFloat(row.short_avg_cost) || 0,
    realizedPnl: parseFloat(row.realized_pnl) || 0,
    totalCommissions: parseFloat(row.total_commissions) || 0,
    accruedCashInterest: parseFloat(row.accrued_interest) || 0,
    accruedMarginInterest: parseFloat(row.accrued_margin_interest) || 0,
    orders: [],
    executions: []
  };
}

/**
 * Helper: build the DB update payload from a portfolio (mirror of student.html).
 */
function buildSyncPayload(portfolio, lastTick) {
  return {
    cash: portfolio.cash,
    shares: portfolio.shares,
    avg_cost: portfolio.avgCost,
    short_shares: portfolio.shortShares,
    short_avg_cost: portfolio.shortAvgCost,
    realized_pnl: portfolio.realizedPnl,
    total_commissions: portfolio.totalCommissions,
    accrued_interest: portfolio.accruedCashInterest,
    accrued_margin_interest: portfolio.accruedMarginInterest,
    last_seen_tick: lastTick ? lastTick.tickIndex || 0 : 0
  };
}

// ====================================================================
// Hydration: DB row → portfolio
// ====================================================================

describe('hydration from participant row', () => {
  it('parses numeric strings from PG to numbers', () => {
    const row = makeParticipantRow({
      cash: '95234.78',
      avg_cost: '187.45',
      realized_pnl: '-1250.30'
    });
    const p = hydratePortfolioFromRow(row);
    expect(p.cash).toBe(95234.78);
    expect(p.avgCost).toBe(187.45);
    expect(p.realizedPnl).toBe(-1250.30);
  });

  it('handles null/missing numeric fields gracefully (defaults to 0)', () => {
    const row = makeParticipantRow({
      avg_cost: null,
      short_avg_cost: undefined,
      realized_pnl: '0',
      total_commissions: null,
      accrued_interest: null,
      accrued_margin_interest: null
    });
    const p = hydratePortfolioFromRow(row);
    expect(p.avgCost).toBe(0);
    expect(p.shortAvgCost).toBe(0);
    expect(p.totalCommissions).toBe(0);
    expect(p.accruedCashInterest).toBe(0);
    expect(p.accruedMarginInterest).toBe(0);
  });

  it('preserves integer share counts as numbers', () => {
    const row = makeParticipantRow({ shares: 100, short_shares: 50 });
    const p = hydratePortfolioFromRow(row);
    expect(p.shares).toBe(100);
    expect(p.shortShares).toBe(50);
  });

  it('Fase D: hydrates accrued_margin_interest (new column)', () => {
    const row = makeParticipantRow({ accrued_margin_interest: '12.45' });
    const p = hydratePortfolioFromRow(row);
    expect(p.accruedMarginInterest).toBe(12.45);
  });

  it('round-trip: hydrate then sync produces equivalent values', () => {
    const original = makeParticipantRow({
      cash: '90000',
      shares: 50,
      avg_cost: '100',
      short_shares: 0,
      short_avg_cost: '0',
      realized_pnl: '500',
      total_commissions: '15.50',
      accrued_interest: '2.10',
      accrued_margin_interest: '5.25'
    });
    const portfolio = hydratePortfolioFromRow(original);
    const payload = buildSyncPayload(portfolio, { tickIndex: 50 });

    expect(payload.cash).toBe(90000);
    expect(payload.shares).toBe(50);
    expect(payload.avg_cost).toBe(100);
    expect(payload.realized_pnl).toBe(500);
    expect(payload.total_commissions).toBe(15.50);
    expect(payload.accrued_interest).toBe(2.10);
    expect(payload.accrued_margin_interest).toBe(5.25);
    expect(payload.last_seen_tick).toBe(50);
  });
});

// ====================================================================
// Sync payload: portfolio → DB
// ====================================================================

describe('sync payload to DB', () => {
  it('includes all Fase D fields', () => {
    const portfolio = {
      cash: 100000,
      shares: 0,
      avgCost: 0,
      shortShares: 0,
      shortAvgCost: 0,
      realizedPnl: 0,
      totalCommissions: 0,
      accruedCashInterest: 0,
      accruedMarginInterest: 7.5
    };
    const payload = buildSyncPayload(portfolio, { tickIndex: 100 });
    expect(payload).toHaveProperty('accrued_margin_interest', 7.5);
    expect(payload).toHaveProperty('last_seen_tick', 100);
  });

  it('handles missing lastTick gracefully', () => {
    const portfolio = {
      cash: 100000, shares: 0, avgCost: 0, shortShares: 0, shortAvgCost: 0,
      realizedPnl: 0, totalCommissions: 0, accruedCashInterest: 0,
      accruedMarginInterest: 0
    };
    expect(buildSyncPayload(portfolio, null).last_seen_tick).toBe(0);
    expect(buildSyncPayload(portfolio, undefined).last_seen_tick).toBe(0);
  });

  it('handles tickIndex=0 correctly (first tick)', () => {
    const portfolio = {
      cash: 100000, shares: 0, avgCost: 0, shortShares: 0, shortAvgCost: 0,
      realizedPnl: 0, totalCommissions: 0, accruedCashInterest: 0,
      accruedMarginInterest: 0
    };
    expect(buildSyncPayload(portfolio, { tickIndex: 0 }).last_seen_tick).toBe(0);
  });
});

// ====================================================================
// Working orders restoration: DB rows → portfolio.orders
// ====================================================================

/**
 * Mirror of the working-orders restore logic in student.html startStudentSim.
 */
function restoreWorkingOrders(dbOrders) {
  return (dbOrders || []).map(o => ({
    id: o.id,
    side: o.side,
    orderType: o.order_type,
    qty: o.qty,
    limitPrice: o.limit_price != null ? parseFloat(o.limit_price) : null,
    stopPrice: o.stop_price != null ? parseFloat(o.stop_price) : null,
    trailAmount: o.trail_amount != null ? parseFloat(o.trail_amount) : null,
    tif: o.tif || 'GTC',
    status: 'WORKING',
    createdAt: o.created_at,
    _trailPeak: null,
    _trailTrough: null
  }));
}

describe('working orders restoration', () => {
  it('empty list stays empty', () => {
    expect(restoreWorkingOrders([])).toEqual([]);
    expect(restoreWorkingOrders(null)).toEqual([]);
    expect(restoreWorkingOrders(undefined)).toEqual([]);
  });

  it('maps order_type → orderType', () => {
    const orders = restoreWorkingOrders([{
      id: 'o1', side: 'BUY', order_type: 'LIMIT', qty: 100,
      limit_price: '180.50', tif: 'GTC', created_at: '2026-04-30T14:00:00Z'
    }]);
    expect(orders[0].orderType).toBe('LIMIT');
    expect(orders[0].limitPrice).toBe(180.50);
  });

  it('parses numeric strings to floats', () => {
    const orders = restoreWorkingOrders([{
      id: 'o1', side: 'SELL', order_type: 'STOP', qty: 50,
      stop_price: '195.25', tif: 'GTC'
    }]);
    expect(orders[0].stopPrice).toBe(195.25);
  });

  it('null limit/stop/trail prices stay null', () => {
    const orders = restoreWorkingOrders([{
      id: 'o1', side: 'BUY', order_type: 'MARKET', qty: 100,
      limit_price: null, stop_price: null, trail_amount: null
    }]);
    expect(orders[0].limitPrice).toBeNull();
    expect(orders[0].stopPrice).toBeNull();
    expect(orders[0].trailAmount).toBeNull();
  });

  it('TRAILING order preserves trail_amount + resets _trailPeak/_trailTrough', () => {
    const orders = restoreWorkingOrders([{
      id: 'o1', side: 'SELL', order_type: 'TRAILING', qty: 100,
      trail_amount: '2.50'
    }]);
    expect(orders[0].trailAmount).toBe(2.50);
    expect(orders[0]._trailPeak).toBeNull();
    expect(orders[0]._trailTrough).toBeNull();
  });

  it('defaults TIF to GTC when missing', () => {
    const orders = restoreWorkingOrders([{
      id: 'o1', side: 'BUY', order_type: 'LIMIT', qty: 100, limit_price: '100'
    }]);
    expect(orders[0].tif).toBe('GTC');
  });

  it('all 4 sides are preserved', () => {
    const orders = restoreWorkingOrders([
      { id: '1', side: 'BUY', order_type: 'MARKET', qty: 100 },
      { id: '2', side: 'SELL', order_type: 'MARKET', qty: 100 },
      { id: '3', side: 'SHORT_SELL', order_type: 'MARKET', qty: 100 },
      { id: '4', side: 'BUY_TO_COVER', order_type: 'MARKET', qty: 100 }
    ]);
    expect(orders.map(o => o.side)).toEqual(['BUY', 'SELL', 'SHORT_SELL', 'BUY_TO_COVER']);
  });
});

// ====================================================================
// initParams reads accrued_margin_interest if present (it doesn't yet,
// but this guards against the params shape changing)
// ====================================================================

describe('OrderEngine.initParams (Fase D context)', () => {
  it('does not blow up on a complete room object', () => {
    OrderEngine.initParams({
      max_leverage: '2',
      commission_per_share: '0.005',
      min_commission: '1',
      cash_interest_rate: '0.02',
      margin_interest_rate: '0.08',
      short_selling_enabled: true,
      maintenance_margin: '0.25',
      starting_cash: '100000',
      margin_call_grace_ticks: '30'
    });
    expect(OrderEngine.sessionParams.marginCallGraceTicks).toBe(30);
  });
});
