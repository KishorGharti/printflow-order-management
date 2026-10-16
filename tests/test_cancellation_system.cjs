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

async function runTests() {
  console.log('🧪 Starting PrintFlow Order Cancellation System Test Suite...\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err.message || err);
      failed++;
    }
  }

  // Helper to create test customer if needed
  let testCustomerId = 'cust-test-cancel';
  const custRes = await pool.query(`SELECT id FROM customers LIMIT 1`);
  if (custRes.rows.length) {
    testCustomerId = custRes.rows[0].id;
  }

  const timestamp = Date.now();

  // Test 1: New order -> Cancel -> should work
  await test('1. New order can be cancelled via API', async () => {
    const orderNum = `TEST-NEW-${timestamp}`;
    const createRes = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        customerName: 'Test Client',
        orderNumber: orderNum,
        status: 'New',
        items: [{ productName: 'Banner', quantity: 2, unitPrice: 500, amount: 1000 }],
        totalAmount: 1000,
        paymentStatus: 'Unpaid'
      })
    });
    assert.strictEqual(createRes.status, 201, `Failed to create order: ${JSON.stringify(createRes.data)}`);
    const orderId = createRes.data._id || createRes.data.id;

    const cancelRes = await request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'Cancelled',
        cancelReason: 'Customer changed mind',
        cancelledBy: 'Staff Member'
      })
    });
    assert.strictEqual(cancelRes.status, 200, `Expected 200, got ${cancelRes.status}: ${JSON.stringify(cancelRes.data)}`);
    assert.strictEqual(cancelRes.data.status, 'Cancelled');
    assert.strictEqual(cancelRes.data.previousStatus, 'New');
    assert.ok(cancelRes.data.cancelledAt, 'cancelledAt must be recorded');
    assert.strictEqual(cancelRes.data.cancelReason, 'Customer changed mind');
  });

  // Test 2: Progress (Finishing) order -> Cancel -> should work
  await test('2. Progress (Finishing) order can be cancelled via API', async () => {
    const orderNum = `TEST-PROG-${timestamp}`;
    const createRes = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        customerName: 'Test Client',
        orderNumber: orderNum,
        status: 'Finishing',
        items: [{ productName: 'Sticker', quantity: 100, unitPrice: 10, amount: 1000 }],
        totalAmount: 1000,
        paymentStatus: 'Unpaid'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const orderId = createRes.data._id || createRes.data.id;

    const cancelRes = await request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'Cancelled',
        cancelReason: 'Defective raw sheet',
        cancelledBy: 'Operator'
      })
    });
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.data.status, 'Cancelled');
    assert.strictEqual(cancelRes.data.previousStatus, 'Finishing');
  });

  // Test 3: Done order -> Cancel -> backend must reject with HTTP 400
  await test('3. Done order cannot be cancelled (HTTP 400)', async () => {
    const orderNum = `TEST-DONE-${timestamp}`;
    const createRes = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        customerName: 'Test Client',
        orderNumber: orderNum,
        status: 'Done',
        items: [{ productName: 'Card', quantity: 500, unitPrice: 2, amount: 1000 }],
        totalAmount: 1000,
        paymentStatus: 'Unpaid'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const orderId = createRes.data._id || createRes.data.id;

    const cancelRes = await request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Cancelled' })
    });
    assert.strictEqual(cancelRes.status, 400, `Expected 400, got ${cancelRes.status}`);
    assert.ok(cancelRes.data.error.includes('Cannot cancel order in "Done" stage'), `Unexpected error msg: ${cancelRes.data.error}`);
  });

  // Test 4: Ready order -> Cancel -> backend must reject with HTTP 400
  await test('4. Ready order cannot be cancelled (HTTP 400)', async () => {
    const orderNum = `TEST-READY-${timestamp}`;
    const createRes = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        customerName: 'Test Client',
        orderNumber: orderNum,
        status: 'Ready',
        items: [{ productName: 'Brochure', quantity: 100, unitPrice: 15, amount: 1500 }],
        totalAmount: 1500,
        paymentStatus: 'Unpaid'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const orderId = createRes.data._id || createRes.data.id;

    const cancelRes = await request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Cancelled' })
    });
    assert.strictEqual(cancelRes.status, 400);
    assert.ok(cancelRes.data.error.includes('Cannot cancel order in "Ready" stage'));
  });

  // Test 5: Delivery order -> Cancel -> backend must reject with HTTP 400
  await test('5. Delivery order cannot be cancelled (HTTP 400)', async () => {
    const orderNum = `TEST-DELIVERY-${timestamp}`;
    const createRes = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        customerName: 'Test Client',
        orderNumber: orderNum,
        status: 'Delivery',
        items: [{ productName: 'Flyer', quantity: 200, unitPrice: 5, amount: 1000 }],
        totalAmount: 1000,
        paymentStatus: 'Unpaid'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const orderId = createRes.data._id || createRes.data.id;

    const cancelRes = await request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Cancelled' })
    });
    assert.strictEqual(cancelRes.status, 400);
    assert.ok(cancelRes.data.error.includes('Cannot cancel order in "Delivery" stage'));
  });

  // Test 6: Paid order -> Cancel -> backend must reject with HTTP 400
  await test('6. Paid order cannot be cancelled even if New stage (HTTP 400)', async () => {
    const orderNum = `TEST-PAID-${timestamp}`;
    const createRes = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        customerName: 'Test Client',
        orderNumber: orderNum,
        status: 'New',
        items: [{ productName: 'Booklet', quantity: 50, unitPrice: 100, amount: 5000 }],
        totalAmount: 5000,
        paymentStatus: 'Paid'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const orderId = createRes.data._id || createRes.data.id;

    const cancelRes = await request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Cancelled' })
    });
    assert.strictEqual(cancelRes.status, 400);
    assert.ok(cancelRes.data.error.includes('payment has already been completed'));
  });

  // Test 7: Cancelled order -> Cancel again -> backend must reject with HTTP 400
  await test('7. Already cancelled order cannot be cancelled again (HTTP 400)', async () => {
    const orderNum = `TEST-RECAN-${timestamp}`;
    const createRes = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        customerName: 'Test Client',
        orderNumber: orderNum,
        status: 'New',
        items: [{ productName: 'Booklet', quantity: 10, unitPrice: 100, amount: 1000 }],
        totalAmount: 1000,
        paymentStatus: 'Unpaid'
      })
    });
    const orderId = createRes.data._id || createRes.data.id;

    await request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Cancelled' })
    });

    const secondCancelRes = await request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Cancelled' })
    });
    assert.strictEqual(secondCancelRes.status, 400);
    assert.ok(secondCancelRes.data.error.includes('already cancelled'));
  });

  // Test 8: Hard DELETE /api/orders/:id is disabled (HTTP 403)
  await test('8. DELETE /api/orders/:id returns 403 Forbidden', async () => {
    const orderNum = `TEST-DEL-${timestamp}`;
    const createRes = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        customerName: 'Test Client',
        orderNumber: orderNum,
        status: 'New',
        items: [{ productName: 'Booklet', quantity: 10, unitPrice: 100, amount: 1000 }],
        totalAmount: 1000,
        paymentStatus: 'Unpaid'
      })
    });
    const orderId = createRes.data._id || createRes.data.id;

    const delRes = await request(`/orders/${orderId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(delRes.status, 403, `Expected 403, got ${delRes.status}`);
    assert.ok(delRes.data.error.includes('Permanent order deletion is disabled'));

    // Verify order was NOT deleted from database
    const verifyRes = await request(`/orders/${orderId}`);
    assert.strictEqual(verifyRes.status, 200, 'Order must still exist in DB');
  });

  // Test 9: Cancelled order remains visible in list and has status Cancelled
  await test('9. Cancelled order remains visible in GET /api/orders', async () => {
    const orderNum = `TEST-LIST-${timestamp}`;
    const createRes = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerId: testCustomerId,
        customerName: 'Test Client',
        orderNumber: orderNum,
        status: 'Printing',
        items: [{ productName: 'Envelope', quantity: 500, unitPrice: 4, amount: 2000 }],
        totalAmount: 2000,
        paymentStatus: 'Unpaid'
      })
    });
    const orderId = createRes.data._id || createRes.data.id;
    await request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Cancelled', cancelReason: 'Wrong paper' })
    });

    const listRes = await request(`/orders?search=${orderNum}`);
    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.data.orders.length > 0, 'Cancelled order must appear in search/list');
    assert.strictEqual(listRes.data.orders[0].status, 'Cancelled');
  });

  // Clean up test orders from database
  await pool.query(`DELETE FROM orders WHERE order_number LIKE 'TEST-%'`);

  console.log(`\n========================================`);
  console.log(`Tests Completed: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  await pool.end();
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
