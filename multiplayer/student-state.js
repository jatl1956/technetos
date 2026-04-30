/* =========================================================
   Technetos Multiplayer — Student
   Module: state — globals (portfolio, marginCallState, etc.)
   ========================================================= */

/* =========================================================
   STUDENT CONTROLLER
   ========================================================= */
let authMode = 'signin';
let chart = null;
let candleSeries = null;
let volumeSeries = null;
let currentSide = 'BUY';
let currentOrderType = 'MARKET';
let lastTick = null;
let initialPrice = 185;

// Local portfolio state
let portfolio = {
  cash: 100000,
  shares: 0,
  avgCost: 0,
  shortShares: 0,
  shortAvgCost: 0,
  realizedPnl: 0,
  totalCommissions: 0,
  accruedCashInterest: 0,
  accruedMarginInterest: 0,
  orders: [],     // working orders (local)
  executions: []  // fills (local)
};

// Margin call state
let marginCallState = {
  active: false,
  ticksRemaining: 0,
  totalGraceTicks: 0,
  liquidationExecuted: false
};
