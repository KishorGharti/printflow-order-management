'use strict';

const assert = require('assert');
const { pool } = require('../backend/src/config/db');

const BASE_URL = 'http://localhost:3001/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runDeadOrderTests() {
  console.log('🧪 Starting Dead Order & Financial Settings Test Suite...\n');

  let testCustomerId = 'cust-test-cancel';
  const custRes = await pool.query(`SELECT id FROM customers LIMIT 1`);
  if (custRes.rows.length) {
    testCustomerId = custRes.rows[0].id;
  }

  const timestamp = Date.now();
  const orderNum = `DEAD-TEST-${timestamp}`;

  // 1. Create and cancel order
  const createRes = await request('/orders', {
    method: 'POST',
    body: JSON.stringify({
      customerId: testCustomerId,
      customerName: 'Dead Order Client',
      orderNumber: orderNum,
      status: 'Printing',
      items: [{ productName: 'Brochure', quantity: 100, unitPrice: 20, amount: 2000 }],
      totalAmount: 2000,
      paymentStatus: 'Unpaid'
    })
  });
  assert.strictEqual(createRes.status, 201);
  const orderId = createRes.data._id || createRes.data.id;

  const cancelRes = await request(`/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'Cancelled',
      cancelReason: 'Client called to cancel production',
      cancelledBy: 'Admin'
    })
  });
  assert.strictEqual(cancelRes.status, 200);
  assert.strictEqual(cancelRes.data.status, 'Cancelled');
  console.log('✅ PASS: Order successfully cancelled.');

  // 2. Dead Order: Attempt to move to 'Finishing' (Progress) -> Must fail with 400
  const tryProgressRes = await request(`/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Finishing' })
  });
  assert.strictEqual(tryProgressRes.status, 400);
  assert.ok(tryProgressRes.data.error.includes('cancelled and dead'), `Unexpected error: ${tryProgressRes.data.error}`);
  console.log('✅ PASS: Progressing a cancelled order is rejected with "cancelled and dead".');

  // 3. Dead Order: Attempt to move to 'Done' -> Must fail with 400
  const tryDoneRes = await request(`/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Done' })
  });
  assert.strictEqual(tryDoneRes.status, 400);
  assert.ok(tryDoneRes.data.error.includes('cancelled and dead'));
  console.log('✅ PASS: Moving cancelled order to Done is rejected.');

  // 4. Dead Order: Attempt to modify items -> Must fail with 400
  const tryEditItemsRes = await request(`/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify({
      items: [{ productName: 'New Product', quantity: 50, amount: 500 }]
    })
  });
  assert.strictEqual(tryEditItemsRes.status, 400);
  assert.ok(tryEditItemsRes.data.error.includes('cancelled and dead'));
  console.log('✅ PASS: Modifying items on a cancelled order is rejected.');

  // 5. Verify dist/app.js contains the Cancelled Orders tab in Financial Settings
  const fs = require('fs');
  const appJs = fs.readFileSync('dist/app.js', 'utf8');
  assert.ok(appJs.includes("id: 'cancelled', typeVal: 'CANCELLED_ORDERS', label: '✕ Cancelled Orders'"), 'Financial Settings must have Cancelled Orders tab beside Credit Payments');
  assert.ok(appJs.includes("financialSubTab === 'cancelled'"), 'Financial Settings must render Cancelled Orders Register');
  assert.ok(appJs.includes("Cancelled (Dead)"), 'ActionStatusSelector must render Cancelled (Dead) locked badge');
  console.log('✅ PASS: Financial Settings tab and Cancelled (Dead) badge verified in dist/app.js.');

  // Clean up
  await pool.query(`DELETE FROM orders WHERE order_number = $1`, [orderNum]);
  await pool.end();

  console.log('\n========================================');
  console.log('All Dead Order & Financial Settings Tests Passed!');
  console.log('========================================\n');
}

runDeadOrderTests().catch(err => {
  console.error(err);
  process.exit(1);
});
