'use strict';

const { pool } = require('../config/db');
const { getTenantBusinessId } = require('../middleware/rbac');
const logger = require('../utils/logger');

/**
 * GET /api/stats/financial
 *
 * Returns SQL-aggregated financial totals in a single round-trip.
 * Scoped by business tenant. Cancelled orders are excluded from income figures.
 */
const getFinancialStats = async (req, res, next) => {
  try {
    if (req.user && (req.user.role === 'designer' || req.user.role === 'printer_finishing')) {
      return res.status(403).json({ error: `Forbidden: Financial stats are restricted from role "${req.user.role}".` });
    }
    const businessId = getTenantBusinessId(req);

    const [ordersRes, expensesRes, settingsRes] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status != 'Cancelled' THEN total_amount          ELSE 0 END), 0) AS total_income,
          COALESCE(SUM(CASE WHEN status != 'Cancelled' THEN initial_received_amount ELSE 0 END), 0) AS paid_income_initial
        FROM orders
        WHERE business_id = $1
      `, [businessId]),
      pool.query(`
        SELECT
          COALESCE(SUM(amount),              0) AS total_expenses,
          COALESCE(SUM(paid_amount),         0) AS paid_expenses,
          COALESCE(SUM(outstanding_amount),  0) AS credit_expenses
        FROM expenses
        WHERE business_id = $1
      `, [businessId]),
      pool.query(`SELECT opening_balance FROM settings WHERE key = $1 LIMIT 1`, [businessId]),
    ]);

    const o = ordersRes.rows[0];
    const e = expensesRes.rows[0];

    const openingBalance = Number(settingsRes.rows[0]?.opening_balance || 0);

    const totalIncome    = Number(o.total_income);
    const paidIncome     = Number(o.paid_income_initial);
    const totalExpenses  = Number(e.total_expenses);
    const paidExpenses   = Number(e.paid_expenses);
    const creditExpenses = Number(e.credit_expenses);
    const netBalance     = openingBalance + paidIncome - paidExpenses;

    logger.info(`📊 /api/stats/financial served for business: ${businessId}`);
    res.json({ totalIncome, paidIncome, totalExpenses, paidExpenses, creditExpenses, netBalance, openingBalance });
  } catch (err) {
    next(err);
  }
};

module.exports = { getFinancialStats };
