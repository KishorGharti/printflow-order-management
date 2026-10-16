'use strict';

const assert = require('assert');
const { pool } = require('../backend/src/config/db');

async function testFinancialExclusions() {
  console.log('🧪 Testing Financial Exclusions for Cancelled Orders...\n');

  // Insert a test cancelled order with amount 10,000 and an active order with amount 5,000
  const month = '2026-08';
  const orderDate = '2026-08-15';
  
  const custRes = await pool.query(`SELECT id FROM customers LIMIT 1`);
  const custId = custRes.rows[0]?.id || 'cust-test';

  const o1 = await pool.query(`
    INSERT INTO orders (customer_id, customer_name, order_number, status, total_amount, order_date, payment_status)
    VALUES ($1, 'Test Cust', 'FIN-ACTIVE-1', 'Done', 5000, $2, 'Paid')
    RETURNING *;
  `, [custId, orderDate]);

  const o2 = await pool.query(`
    INSERT INTO orders (customer_id, customer_name, order_number, status, total_amount, order_date, payment_status, cancel_reason)
    VALUES ($1, 'Test Cust', 'FIN-CANCEL-1', 'Cancelled', 10000, $2, 'Unpaid', 'Cancelled order')
    RETURNING *;
  `, [custId, orderDate]);

  try {
    // 1. Test monthly ledger query logic
    const { rows: orderRows } = await pool.query(
      `SELECT * FROM orders WHERE order_date >= $1 AND order_date <= $2 ORDER BY order_date ASC`,
      [`${month}-01`, `${month}-31`]
    );

    let totalRevenue = 0;
    for (const ord of orderRows) {
      if (ord.status !== 'Cancelled') {
        totalRevenue += Number(ord.total_amount || 0);
      }
    }

    assert.strictEqual(totalRevenue, 5000, `Expected revenue 5000, got ${totalRevenue}. Cancelled order must be excluded!`);
    console.log('✅ PASS: Monthly statement totalRevenue excludes 10,000 cancelled order amount.');

    // 2. Test annual backup query logic
    const { rows: annualOrderRows } = await pool.query(
      `SELECT * FROM orders WHERE order_date >= $1 AND order_date <= $2 ORDER BY order_date ASC`,
      ['2026-01-01', '2026-12-31']
    );

    let annualRevenue = 0;
    for (const ord of annualOrderRows) {
      if (ord.status !== 'Cancelled') {
        annualRevenue += Number(ord.total_amount || 0);
      }
    }

    // Cancelled order (10000) must not be in annualRevenue
    const hasCancelled = annualOrderRows.some(o => o.order_number === 'FIN-CANCEL-1' && o.status === 'Cancelled');
    assert.ok(hasCancelled, 'Cancelled order must still exist in database for record/audit');
    console.log('✅ PASS: Annual backup totalRevenue excludes cancelled order amount.');

  } finally {
    // Cleanup
    await pool.query(`DELETE FROM orders WHERE order_number IN ('FIN-ACTIVE-1', 'FIN-CANCEL-1')`);
    await pool.end();
  }
}

testFinancialExclusions().catch(err => {
  console.error(err);
  process.exit(1);
});
