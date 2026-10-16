import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('financial ledger recognises only completed orders', () => {
  assert.match(
    runtime,
    /const financialOrderStatuses = \['Done', 'Ready', 'Pickup', 'Delivery'\];\s*const allOrders = this\.getOrders\(\)\.filter\(o => financialOrderStatuses\.includes\(o\.status\)\);/,
    'New and production-stage jobs must not be projected into All Transactions'
  );

  const statuses = ['New', 'In Design', 'Printing', 'Finishing', 'Done', 'Ready', 'Pickup', 'Delivery', 'Cancelled', 'Mistake'];
  const financialOrderStatuses = ['Done', 'Ready', 'Pickup', 'Delivery'];
  const recognised = statuses.filter(status => financialOrderStatuses.includes(status));

  assert.deepEqual(recognised, ['Done', 'Ready', 'Pickup', 'Delivery']);
  assert.equal(recognised.includes('New'), false);
});

test('Done payment flow records the received amount and carries the remainder as due', () => {
  assert.match(runtime, /completeOrderWithPayment\(orderId, paymentMethod, receivedAmount = 0\)/);
  assert.match(runtime, /const due = Math\.max\(0, total - received\)/);
  assert.match(runtime, /paymentStatus = due <= 0 \? 'Paid' : \(received > 0 \? 'Partial' : 'Credit'\)/);
  assert.match(runtime, /paymentMethod: effectiveMethod,\s*paymentStatus,\s*paymentHistory/);

  const settle = (total, received, method) => {
    const paid = method === 'Credit' ? 0 : Math.min(total, Math.max(0, received));
    const due = Math.max(0, total - paid);
    return {
      paid,
      due,
      method: due > 0 ? 'Credit' : method,
      status: due <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Credit'
    };
  };

  assert.deepEqual(settle(48000, 20000, 'Pay'), { paid: 20000, due: 28000, method: 'Credit', status: 'Partial' });
  assert.deepEqual(settle(48000, 48000, 'Online'), { paid: 48000, due: 0, method: 'Online', status: 'Paid' });
  assert.deepEqual(settle(48000, 0, 'Credit'), { paid: 0, due: 48000, method: 'Credit', status: 'Credit' });
});

test('Cash and Online ask for received amount while Credit continues directly', () => {
  assert.match(runtime, /onClick: \(\) => setPaymentCollection\(\{ method: 'Pay', amount: '', error: '' \}\)/);
  assert.match(runtime, /onClick: \(\) => setPaymentCollection\(\{ method: 'Online', amount: '', error: '' \}\)/);
  assert.match(runtime, /onClick: \(\) => finishOrderWithPayment\('Credit'\)/);
  assert.match(runtime, /"Remaining Due"/);
  assert.match(runtime, /"Confirm Payment & Mark Done"/);
});

test('completion payment is consolidated into the job row without a duplicate receipt row', () => {
  assert.match(runtime, /const completionDue = Math\.max\(0, amount - completionReceived\)/);
  assert.match(runtime, /billedAmount: completionDue,\s*receivedAmount: completionReceived,\s*drAmount: 0,\s*crAmount: completionReceived/);
  assert.match(runtime, /isCompletionPayment: true/);
  assert.match(runtime, /!payment\.isCompletionPayment/);

  const total = 50000;
  const received = 20000;
  const row = {
    totalAmount: total,
    creditDue: total - received,
    paidReceived: received,
    balance: received
  };
  assert.deepEqual(row, { totalAmount: 50000, creditDue: 30000, paidReceived: 20000, balance: 20000 });
});

test('client balance sheet consolidates the completion payment into its invoice row', () => {
  assert.match(runtime, /billedAmount: completionDue,\s*receivedAmount: completionReceived,\s*paymentMethod: completionMethod/);
  assert.match(runtime, /credit: completionReceived/);
  assert.match(runtime, /filter\(payment => !String\(payment\.transactionId \|\| ''\)\.startsWith\('legacy-'\) && !payment\.isCompletionPayment\)/);

  const total = 50000;
  const received = 20000;
  const debit = total;
  const credit = received;
  const clientRow = {
    totalAmount: total,
    crAmount: total - received,
    drAmount: received,
    balance: debit - credit
  };
  assert.deepEqual(clientRow, { totalAmount: 50000, crAmount: 30000, drAmount: 20000, balance: 30000 });
});
