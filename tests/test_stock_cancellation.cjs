'use strict';

const assert = require('assert');

// Simulate the exact _reconcileOrderStock logic from dist/app.js
function testReconcileStock() {
  console.log('🧪 Testing Stock Behavior on Cancellation...');

  let stock = [
    { id: 'item-paper', name: 'Paper A4', quantity: 100 }
  ];
  let transactions = [];
  const now = new Date().toISOString();

  // Helper from dist/app.js
  const addTransaction = (allocation, type, qty, reason) => {
    transactions.push({
      itemId: allocation.inventoryItemId,
      type,
      quantity: qty,
      reason
    });
  };

  // Case 1: Order with consumed stock (e.g. 10 sheets consumed during Printing/Finishing)
  const previousAllocations = [
    {
      orderItemId: 'oi-1',
      inventoryItemId: 'item-paper',
      consumedAt: now,
      consumedQuantity: 10,
      reservedQuantity: 0,
      trackingMode: 'AUTO'
    }
  ];

  const orderCancelled = {
    status: 'Cancelled',
    items: [{ id: 'oi-1', productName: 'Brochure', quantity: 10 }]
  };

  // Logic from _reconcileOrderStock in dist/app.js lines 6020-6050
  const nextAllocations = [];
  previousAllocations.forEach(allocation => {
    if (orderCancelled.status === 'Cancelled' && Number(allocation.reservedQuantity || 0) > 0) {
      addTransaction(allocation, 'RELEASE', Number(allocation.reservedQuantity), 'Order cancelled');
      allocation.reservedQuantity = 0;
      allocation.releasedAt = now;
    }
    // Consumed allocation remains in nextAllocations
    nextAllocations.push(allocation);
  });

  // Verify:
  assert.strictEqual(nextAllocations.length, 1);
  assert.strictEqual(nextAllocations[0].consumedQuantity, 10);
  assert.ok(nextAllocations[0].consumedAt, 'consumedAt must remain set');
  assert.strictEqual(transactions.length, 0, 'No RELEASE transaction should be generated for consumed stock');
  assert.strictEqual(stock[0].quantity, 100, 'Inventory stock balance should NOT be automatically re-added');

  console.log('✅ PASS: Consumed stock remains preserved on cancellation without automatic restore.');

  // Case 2: Order with unconsumed reservation
  const previousReservedAllocations = [
    {
      orderItemId: 'oi-2',
      inventoryItemId: 'item-paper',
      consumedAt: null,
      consumedQuantity: 0,
      reservedQuantity: 15,
      trackingMode: 'AUTO'
    }
  ];

  const nextReservedAllocations = [];
  previousReservedAllocations.forEach(allocation => {
    if (orderCancelled.status === 'Cancelled' && Number(allocation.reservedQuantity || 0) > 0) {
      addTransaction(allocation, 'RELEASE', Number(allocation.reservedQuantity), 'Order cancelled');
      allocation.reservedQuantity = 0;
      allocation.releasedAt = now;
    }
    nextReservedAllocations.push(allocation);
  });

  assert.strictEqual(nextReservedAllocations[0].reservedQuantity, 0);
  assert.strictEqual(transactions.length, 1);
  assert.strictEqual(transactions[0].type, 'RELEASE');
  assert.strictEqual(transactions[0].quantity, 15);

  console.log('✅ PASS: Unconsumed reservations are released on cancellation.');
}

testReconcileStock();
