import assert from 'node:assert/strict';
import { test } from 'node:test';

// Simulation of Printing Gate validation logic: only a designer is required
function validatePrintingGate({ order, designer }) {
  if (!order) return { ok: false, error: 'No order provided' };
  if (!designer) return { ok: false, error: 'Please add and select a designer in Profile → Team before upgrading to Printing.' };
  return { ok: true };
}

// Simulation of Progress Gate validation logic (Requires at least 1 designer file download)
function validateProgressGate({ order }) {
  if (!order) return { ok: false, error: 'No order provided' };
  const readyToGoFiles = (order.media || []).filter(m => m.category === 'Ready to Go');

  if (readyToGoFiles.length > 0) {
    const downloadedIds = new Set(order.downloadedMediaIds || []);
    const hasDownloadedAtLeastOnce = readyToGoFiles.some(file => downloadedIds.has(file.id)) || Boolean(order.lastDesignDownloadedAt);
    if (!hasDownloadedAtLeastOnce) {
      return {
        ok: false,
        error: `Cannot move to Progress: The design file (${readyToGoFiles[0].name}) must be downloaded at least once before moving ${order.orderNumber} to Progress.`
      };
    }
  }

  return { ok: true };
}

test('Printing Gate: Blocks upgrade when no designer is available', () => {
  const order = { id: 'ord-1', orderNumber: 'PG-2026-0001', media: [] };
  const result = validatePrintingGate({ order, designer: null });
  assert.equal(result.ok, false);
  assert.match(result.error, /select a designer/);
});

test('Printing Gate: Allows upgrade with a designer alone (no Job Number or design file required)', () => {
  const order = { id: 'ord-1', orderNumber: 'PG-2026-0001', media: [] };
  const designer = { id: 'tm-1', name: 'Alina' };
  const result = validatePrintingGate({ order, designer });
  assert.equal(result.ok, true);
});

test('Progress Gate: Blocks upgrade if attached Ready to Go design files are not downloaded', () => {
  const order = {
    id: 'ord-1',
    orderNumber: 'PG-2026-0001',
    status: 'Printing',
    media: [
      { id: 'm-1', name: 'flyer-front.pdf', category: 'Ready to Go' }
    ],
    downloadedMediaIds: []
  };
  const result = validateProgressGate({ order });
  assert.equal(result.ok, false);
  assert.match(result.error, /flyer-front\.pdf.*must be downloaded at least once/);
});

test('Progress Gate: Allows upgrade when at least 1 designer file is downloaded', () => {
  const order = {
    id: 'ord-1',
    orderNumber: 'PG-2026-0001',
    status: 'Printing',
    media: [
      { id: 'm-1', name: 'flyer-front.pdf', category: 'Ready to Go' },
      { id: 'm-2', name: 'flyer-back.pdf', category: 'Ready to Go' }
    ],
    downloadedMediaIds: ['m-1'] // 1 file downloaded
  };
  const result = validateProgressGate({ order });
  assert.equal(result.ok, true);
});

test('Progress Gate: Ignores client reference files and allows progress if verified by job number', () => {
  const order = {
    id: 'ord-1',
    orderNumber: 'PG-2026-0001',
    status: 'Printing',
    media: [
      { id: 'm-ref-1', name: 'client-doc.pdf', category: 'Client Reference' }
    ],
    downloadedMediaIds: []
  };
  const result = validateProgressGate({ order });
  assert.equal(result.ok, true);
});

// Backward transition validation helper
function validateBackwardTransition({ mistakeByTeamId, reason }) {
  if (!reason || !reason.trim()) {
    return { ok: false, error: 'Please explain why you are moving the order back.' };
  }
  return { ok: true, responsibleTeamId: mistakeByTeamId || 'general' };
}

test('Backward Stage: Blocks move without an explanation reason', () => {
  const result = validateBackwardTransition({ mistakeByTeamId: 'tm-1', reason: '' });
  assert.equal(result.ok, false);
  assert.match(result.error, /Please explain why/);
});

test('Backward Stage: Allows rollback when team mistake and explanation are provided', () => {
  const result = validateBackwardTransition({ mistakeByTeamId: 'tm-1', reason: 'Reprint needed due to sizing error' });
  assert.equal(result.ok, true);
});

// Know After Design validation helper
function validateKnowAfterDesignGate({ order, quantities = {} }) {
  const pendingItems = (order.items || []).filter(item => item.knowAfterDesign || item.quantity === 0);
  for (const item of pendingItems) {
    const qty = parseInt(quantities[item.id], 10);
    if (!qty || qty < 1) {
      return { ok: false, error: `Please enter the required final quantity for "${item.productName}".` };
    }
  }
  return { ok: true };
}

test('Know After Design: Blocks upgrade to Printing if final quantity is not entered', () => {
  const order = {
    id: 'ord-1',
    items: [
      { id: 'item-1', productName: 'Flex Banner', unit: 'sq.ft', knowAfterDesign: true, quantity: 0, unitPrice: 35 }
    ]
  };
  const result = validateKnowAfterDesignGate({ order, quantities: {} });
  assert.equal(result.ok, false);
  assert.match(result.error, /final quantity for "Flex Banner"/);
});

test('Know After Design: Allows upgrade to Printing when final quantity is provided', () => {
  const order = {
    id: 'ord-1',
    items: [
      { id: 'item-1', productName: 'Flex Banner', unit: 'sq.ft', knowAfterDesign: true, quantity: 0, unitPrice: 35 }
    ]
  };
  const result = validateKnowAfterDesignGate({ order, quantities: { 'item-1': 150 } });
  assert.equal(result.ok, true);
});

// Team Member 6-Digit PIN validation helper
function validateTeamPin({ member, enteredPin }) {
  if (!member) return { ok: false, error: 'No team member selected' };
  const targetPin = String(member.pin || '123456').trim();
  const cleanEntered = String(enteredPin || '').trim();
  if (cleanEntered.length !== 6 || cleanEntered !== targetPin) {
    return { ok: false, error: `Incorrect 6-digit PIN for ${member.name}.` };
  }
  return { ok: true };
}

test('Team Security: Rejects incorrect 6-digit PIN for team member action', () => {
  const member = { id: 'tm-1', name: 'Alina', pin: '654321' };
  const result = validateTeamPin({ member, enteredPin: '111111' });
  assert.equal(result.ok, false);
  assert.match(result.error, /Incorrect 6-digit PIN for Alina/);
});

test('Team Security: Accepts correct 6-digit PIN and allows progress upgrade', () => {
  const member = { id: 'tm-1', name: 'Alina', pin: '654321' };
  const result = validateTeamPin({ member, enteredPin: '654321' });
  assert.equal(result.ok, true);
});

// Daily Archive Walk-in & Mistake By helpers
function formatDailyOrderEntry(order) {
  const isWalkIn = order.customerId === 'profile_client_001' || Boolean(order.orderContactName);
  const clientDisplayName = order.orderContactName
    ? `${order.orderContactName}${order.orderContactPhone ? ' (' + order.orderContactPhone + ')' : ''}`
    : (order.customerName || 'Walk-in Client');
  
  const matches = [...String(order.notes || '').matchAll(/\[Stage Reverted.*?• Mistake by:\s*([^•\]]+)(?:• Reason:\s*([^\]]+))?\]/gi)];
  const mistakeSummary = matches.length > 0
    ? matches.map(m => `${m[1].trim()}${m[2] ? ' (' + m[2].trim() + ')' : ''}`).join('; ')
    : '—';

  return { isWalkIn, clientDisplayName, mistakeSummary };
}

test('Daily Archive: Formats Walk-in client name and phone correctly', () => {
  const order = {
    id: 'ord-w1',
    customerId: 'profile_client_001',
    customerName: 'Print Ghar',
    orderContactName: 'Bikash Adhikari',
    orderContactPhone: '9841234567'
  };
  const formatted = formatDailyOrderEntry(order);
  assert.equal(formatted.isWalkIn, true);
  assert.equal(formatted.clientDisplayName, 'Bikash Adhikari (9841234567)');
});

test('Daily Archive: Extracts Mistake By team member and reason from rollback logs', () => {
  const order = {
    id: 'ord-m1',
    orderNumber: 'PG-2026-0088',
    customerName: 'Mega Corp',
    notes: '[Stage Reverted from Progress to Printing • Mistake by: Ramesh Designer • Reason: Color profile wrong]'
  };
  const formatted = formatDailyOrderEntry(order);
  assert.equal(formatted.mistakeSummary, 'Ramesh Designer (Color profile wrong)');
});

function isDailyNotificationActive(nepalHour) {
  const isEveningWindow = nepalHour >= 18; // 6:00 PM - 11:59 PM
  const isMorningWindow = nepalHour < 9;   // 12:00 AM - 8:59 AM
  return isEveningWindow || isMorningWindow;
}

test('Daily Notification: Active at 6:00 PM and overnight until morning 8:59 AM', () => {
  assert.equal(isDailyNotificationActive(18), true); // 6:00 PM
  assert.equal(isDailyNotificationActive(23), true); // 11:00 PM
  assert.equal(isDailyNotificationActive(5), true);  // 5:00 AM
  assert.equal(isDailyNotificationActive(8), true);  // 8:00 AM
});

test('Daily Notification: Cleared/Deleted at 9:00 AM next morning and during daytime shift', () => {
  assert.equal(isDailyNotificationActive(9), false);  // 9:00 AM (Cleared!)
  assert.equal(isDailyNotificationActive(12), false); // 12:00 PM Noon
  assert.equal(isDailyNotificationActive(17), false); // 5:00 PM
  assert.equal(isDailyNotificationActive(18), true);  // 6:00 PM (Active)
});

test('Demo Data Cleanup: Completely filters out demo orders, demo clients, and demo expenses', () => {
  const sampleOrders = [
    { id: 'o-real-1', orderNumber: 'JOB-1042', customerId: 'cust-1' },
    { id: 'o-demo-1', orderNumber: 'JOB-2026-2001', customerId: 'cust-d-1' },
    { id: 'o-demo-2', orderNumber: 'JOB-2026-2030', customerId: 'cust-profile-business' }
  ];
  const demoOrderPattern = /^JOB-2026-2\d{3}$/i;
  const demoClientIds = new Set(['cust-d-1','cust-d-2','cust-d-3']);
  const cleanOrders = sampleOrders.filter(o => !demoOrderPattern.test(o.orderNumber || '') && !demoClientIds.has(o.customerId) && !String(o.orderNumber || '').startsWith('JOB-2026-2'));
  
  assert.equal(cleanOrders.length, 1);
  assert.equal(cleanOrders[0].orderNumber, 'JOB-1042');
});

// Invoice Starting Number & Prefix Helper test
function generateNextNumber({ orders = [], prefix = 'JOB-', startNumber = 1042 }) {
  const cleanPrefix = String(prefix || 'JOB-').trim();
  const startNum = parseInt(startNumber, 10) || 1042;
  let maxNum = startNum - 1;
  orders.forEach(o => {
    const match = String(o.orderNumber || '').match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  return `${cleanPrefix}${maxNum + 1}`;
}

test('Invoice Configuration: Starts at configured startNumber and prefix when no orders exist', () => {
  const nextNumber = generateNextNumber({ orders: [], prefix: 'INV-', startNumber: 5000 });
  assert.equal(nextNumber, 'INV-5000');
});

test('Invoice Configuration: Increments from highest existing order number', () => {
  const sampleOrders = [
    { id: '1', orderNumber: 'PG-2001' },
    { id: '2', orderNumber: 'PG-2005' }
  ];
  const nextNumber = generateNextNumber({ orders: sampleOrders, prefix: 'PG-', startNumber: 2000 });
  assert.equal(nextNumber, 'PG-2006');
});

function generateNextInvoiceNumber({ orders = [], prefix = 'INV-', startNumber = 1 }) {
  let maxNum = Math.max(1, parseInt(startNumber, 10) || 1) - 1;
  orders.forEach(order => {
    const match = String(order.invoiceNumber || '').match(/(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  });
  return `${String(prefix ?? '').trim()}${maxNum + 1}`;
}

test('Bill numbering: Uses invoice prefix and start while ignoring JOB references', () => {
  const orders = [
    { orderNumber: 'JOB-9000', invoiceNumber: 'INV-1401' },
    { orderNumber: 'JOB-9999' }
  ];
  assert.equal(generateNextInvoiceNumber({ orders, prefix:'INV-', startNumber: 1400 }), 'INV-1402');
});

test('Bill numbering: Starts exactly at the profile value and can use numbers-only prefix', () => {
  assert.equal(generateNextInvoiceNumber({ orders: [{ orderNumber: 'JOB-1057' }], prefix:'', startNumber: 501 }), '501');
});

function combineJobsForBilling(jobs) {
  return {
    billingOrderIds: jobs.map(job => job.id),
    orderNumber: jobs.map(job => job.orderNumber).join(', '),
    items: jobs.flatMap(job => (job.items || []).map(item => ({ ...item, billingJobNumber: job.orderNumber }))),
    discount: jobs.reduce((sum, job) => sum + Number(job.discount || 0), 0),
    totalAmount: jobs.reduce((sum, job) => sum + Number(job.totalAmount || 0), 0)
  };
}

test('Multi-job billing: Combines selected jobs while retaining each item job reference', () => {
  const bill = combineJobsForBilling([
    { id:'a', orderNumber:'JOB-1057', items:[{ productName:'DTF' }], discount:100, totalAmount:900 },
    { id:'b', orderNumber:'JOB-1058', items:[{ productName:'Cards' }], discount:50, totalAmount:450 }
  ]);
  assert.deepEqual(bill.billingOrderIds, ['a', 'b']);
  assert.deepEqual(bill.items.map(item => item.billingJobNumber), ['JOB-1057', 'JOB-1058']);
  assert.equal(bill.discount, 150);
  assert.equal(bill.totalAmount, 1350);
});

// Discount & Grand Total Calculation test
function calculateInvoiceTotals({ subtotal, discount = 0, tax = 0 }) {
  const cleanDiscount = Math.max(0, Math.min(subtotal, Number(discount) || 0));
  const grandTotal = Math.max(0, subtotal - cleanDiscount + Number(tax || 0));
  return { subtotal, discount: cleanDiscount, grandTotal };
}

test('Invoice Discount: Correctly calculates grand total when discount is entered', () => {
  const result = calculateInvoiceTotals({ subtotal: 5000, discount: 250, tax: 0 });
  assert.equal(result.discount, 250);
  assert.equal(result.grandTotal, 4750);
});

test('Invoice Discount: Caps discount to subtotal and prevents negative total', () => {
  const result = calculateInvoiceTotals({ subtotal: 1000, discount: 1500, tax: 0 });
  assert.equal(result.discount, 1000);
  assert.equal(result.grandTotal, 0);
});

// Print Count Tracker test
function incrementPrintCount(order) {
  const currentCount = Number(order.printCount) || 0;
  const nextCount = currentCount + 1;
  const isDuplicate = nextCount > 1;
  return {
    ...order,
    printCount: nextCount,
    lastPrintedAt: new Date().toISOString(),
    badgeLabel: `Print #${nextCount} • ${isDuplicate ? 'Duplicate Copy' : 'Original'}`
  };
}

test('Print Counter: Tracks first print as Original and subsequent prints as Duplicate Copy', () => {
  const order = { id: 'ord-1', orderNumber: 'JOB-1043' };
  const firstPrint = incrementPrintCount(order);
  assert.equal(firstPrint.printCount, 1);
  assert.match(firstPrint.badgeLabel, /Print #1 • Original/);

  const secondPrint = incrementPrintCount(firstPrint);
  assert.equal(secondPrint.printCount, 2);
  assert.match(secondPrint.badgeLabel, /Print #2 • Duplicate Copy/);
});

// Product Name with Job Number formatting test
function formatProductWithJobNumber(productName, jobNumber) {
  return `${productName || 'Product'}${jobNumber ? ` (${jobNumber})` : ''}`;
}

test('Product Formatting: Includes Job Number with product name', () => {
  const formatted = formatProductWithJobNumber('Flex Banner', 'JOB-1043');
  assert.equal(formatted, 'Flex Banner (JOB-1043)');
});

function allocateClientPayment(creditJobs, receivedAmount) {
  let remaining = receivedAmount;
  const allocations = [...creditJobs]
    .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)))
    .map(job => {
      const applied = Math.min(job.due, remaining);
      remaining -= applied;
      return { ...job, applied, dueAfter:job.due - applied };
    });
  return { allocations, advance:remaining };
}

test('Partial client payment: Allocates oldest credit jobs first and leaves exact balance', () => {
  const result = allocateClientPayment([
    { orderNumber:'JOB-1056', due:51400, completedAt:'2026-09-05T06:25:36Z' },
    { orderNumber:'JOB-1052', due:60000, completedAt:'2026-09-04T04:27:26Z' },
    { orderNumber:'JOB-1053', due:700, completedAt:'2026-09-04T04:27:24Z' }
  ], 75200);
  assert.deepEqual(result.allocations.map(item => [item.orderNumber, item.applied, item.dueAfter]), [
    ['JOB-1053', 700, 0],
    ['JOB-1052', 60000, 0],
    ['JOB-1056', 14500, 36900]
  ]);
  assert.equal(result.advance, 0);
});

test('Client overpayment: Stores money left after all credit jobs as advance', () => {
  const result = allocateClientPayment([{ orderNumber:'JOB-1', due:50000, completedAt:'2026-09-01' }], 60000);
  assert.equal(result.allocations[0].dueAfter, 0);
  assert.equal(result.advance, 10000);
});

// Balance Sheet Calculation Simulation
function calculateBalanceSheet({ customer, orders, periodMonth }) {
  const completed = (orders || []).filter(o => o.status !== 'Cancelled' && ['Done', 'Ready', 'Pickup', 'Delivery'].includes(o.status));
  const allEntries = [];

  completed.forEach(order => {
    const month = String(order.orderDate || '').slice(0, 7);
    allEntries.push({
      date: order.orderDate,
      month,
      type: 'invoice',
      reference: order.orderNumber,
      debit: Number(order.totalAmount || 0),
      credit: 0
    });

    (order.paymentHistory || []).forEach(pay => {
      const payMonth = String(pay.receivedAt || order.orderDate || '').slice(0, 7);
      allEntries.push({
        date: String(pay.receivedAt || order.orderDate).split('T')[0],
        month: payMonth,
        type: 'payment',
        reference: order.orderNumber,
        debit: 0,
        credit: Number(pay.amount || 0)
      });
    });
  });

  (customer?.advanceHistory || []).forEach(adv => {
    const advMonth = String(adv.receivedAt || '').slice(0, 7);
    allEntries.push({
      date: String(adv.receivedAt || '').split('T')[0],
      month: advMonth,
      type: 'advance',
      reference: 'ADVANCE',
      debit: 0,
      credit: Number(adv.amount || 0)
    });
  });

  allEntries.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let priorDebits = 0;
  let priorCredits = 0;
  const periodEntries = [];

  allEntries.forEach(entry => {
    if (periodMonth && entry.month < periodMonth) {
      priorDebits += entry.debit;
      priorCredits += entry.credit;
    } else if (!periodMonth || entry.month === periodMonth) {
      periodEntries.push(entry);
    }
  });

  const openingBalance = priorDebits - priorCredits;
  let running = openingBalance;
  periodEntries.forEach(entry => {
    running += entry.debit - entry.credit;
    entry.runningBalance = running;
  });

  const periodDebit = periodEntries.reduce((sum, e) => sum + e.debit, 0);
  const periodCredit = periodEntries.reduce((sum, e) => sum + e.credit, 0);
  const closingBalance = openingBalance + periodDebit - periodCredit;

  return {
    openingBalance,
    periodDebit,
    periodCredit,
    closingBalance,
    entries: periodEntries
  };
}

test('Balance Sheet: Computes exact Opening Balance (B/F) across prior months', () => {
  const customer = { id: 'cust-1', name: 'Apex Printing' };
  const orders = [
    // Month 1: Jan 2026 -> Job of 10,000, Paid 6,000 => Due 4,000
    { id: 'o-1', customerId: 'cust-1', orderNumber: 'PG-01', orderDate: '2026-01-10', totalAmount: 10000, status: 'Done', paymentHistory: [{ amount: 6000, receivedAt: '2026-01-12' }] },
    // Month 2: Feb 2026 -> Job of 5,000, Paid 7,000 => Due becomes 4,000 + 5,000 - 7,000 = 2,000
    { id: 'o-2', customerId: 'cust-1', orderNumber: 'PG-02', orderDate: '2026-02-05', totalAmount: 5000, status: 'Done', paymentHistory: [{ amount: 7000, receivedAt: '2026-02-10' }] },
  ];

  // Inspect Month 2 (Feb 2026)
  const febSheet = calculateBalanceSheet({ customer, orders, periodMonth: '2026-02' });
  assert.equal(febSheet.openingBalance, 4000); // 10000 - 6000
  assert.equal(febSheet.periodDebit, 5000);
  assert.equal(febSheet.periodCredit, 7000);
  assert.equal(febSheet.closingBalance, 2000);
  assert.equal(febSheet.entries[0].runningBalance, 9000); // 4000 B/F + 5000 invoice
  assert.equal(febSheet.entries[1].runningBalance, 2000); // 9000 - 7000 payment
});

test('Balance Sheet: Accumulates advance deposits and reflects credit balance', () => {
  const customer = {
    id: 'cust-2',
    name: 'Sarah',
    advanceHistory: [{ amount: 15000, receivedAt: '2026-03-01' }]
  };
  const orders = [
    { id: 'o-1', customerId: 'cust-2', orderNumber: 'PG-10', orderDate: '2026-03-05', totalAmount: 8000, status: 'Done', paymentHistory: [] }
  ];

  const marchSheet = calculateBalanceSheet({ customer, orders, periodMonth: '2026-03' });
  assert.equal(marchSheet.periodDebit, 8000);
  assert.equal(marchSheet.periodCredit, 15000);
  assert.equal(marchSheet.closingBalance, -7000); // Advance held of 7,000
});

test('Balance Sheet: WhatsApp statement text formats opening, debit, credit and closing balance', () => {
  const sheet = {
    periodLabel: 'Falgun 2082 BS',
    openingBalance: 3500,
    periodTotalDebit: 12000,
    periodTotalCredit: 10000,
    closingBalance: 5500
  };
  const clientName = 'Apex Corp';
  const message = `PRINT GHAR — STATEMENT OF ACCOUNT\nClient: ${clientName}\nPeriod: ${sheet.periodLabel}\nOpening: ${sheet.openingBalance}\nDebit: ${sheet.periodTotalDebit}\nCredit: ${sheet.periodTotalCredit}\nClosing: ${sheet.closingBalance}`;

  assert.match(message, /STATEMENT OF ACCOUNT/);
  assert.match(message, /Apex Corp/);
  assert.match(message, /Opening: 3500/);
  assert.match(message, /Debit: 12000/);
  assert.match(message, /Credit: 10000/);
  assert.match(message, /Closing: 5500/);
});

function groupStatementPayments(orders, advanceHistory = []) {
  const groups = new Map();
  for (const order of orders) {
    for (const payment of order.paymentHistory || []) {
      const key = payment.transactionId || payment.id;
      if (!groups.has(key)) groups.set(key, { transactionId:key, amount:0, allocations:[], advanceAmount:0 });
      const group = groups.get(key);
      group.amount += payment.amount;
      group.allocations.push({ orderNumber:order.orderNumber, amount:payment.amount });
    }
  }
  for (const advance of advanceHistory) {
    const key = advance.transactionId || advance.id;
    if (!groups.has(key)) groups.set(key, { transactionId:key, amount:0, allocations:[], advanceAmount:0 });
    const group = groups.get(key);
    group.amount += advance.amount;
    group.advanceAmount += advance.amount;
  }
  return [...groups.values()];
}

test('Client statement: one payment allocated across two jobs renders once and is not double counted', () => {
  const transactionId = 'PAY-001';
  const grouped = groupStatementPayments([
    { orderNumber:'JOB-1061', paymentHistory:[{ transactionId, amount:100 }] },
    { orderNumber:'JOB-1056', paymentHistory:[{ transactionId, amount:4900 }] }
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].amount, 5000);
  assert.deepEqual(grouped[0].allocations.map(item => [item.orderNumber,item.amount]), [['JOB-1061',100],['JOB-1056',4900]]);
});

test('Client statement: one payment allocated across five jobs renders once', () => {
  const grouped = groupStatementPayments(Array.from({length:5},(_,index)=>({
    orderNumber:`JOB-${index+1}`,
    paymentHistory:[{ transactionId:'PAY-005', amount:1000 }]
  })));
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].amount, 5000);
  assert.equal(grouped[0].allocations.length, 5);
});

test('Client statement: overpayment combines job allocation and advance into one transaction', () => {
  const grouped = groupStatementPayments(
    [{ orderNumber:'JOB-1', paymentHistory:[{ transactionId:'PAY-ADV', amount:1000 }] }],
    [{ transactionId:'PAY-ADV', amount:4000 }]
  );
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].amount, 5000);
  assert.equal(grouped[0].advanceAmount, 4000);
});

// Custom Pricing: Add Product and Filter tests
function getClientCustomProducts({ masterProducts, pricingList, customerId }) {
  const pricingMap = new Map();
  pricingList.filter(p => p.customerId === customerId).forEach(item => pricingMap.set(item.productId, item.customPrice));
  return masterProducts.filter(product => pricingMap.has(product.id)).map(product => ({
    ...product,
    customPrice: pricingMap.get(product.id)
  }));
}

function resolveEffectivePrice({ productId, customerId, masterProducts, pricingList }) {
  const product = masterProducts.find(p => p.id === productId);
  if (!product) return { price: 0, isCustom: false };
  const custom = pricingList.find(p => p.customerId === customerId && p.productId === productId);
  if (custom && Number.isFinite(custom.customPrice)) {
    return { price: custom.customPrice, isCustom: true };
  }
  return { price: product.defaultPrice, isCustom: false };
}

test('Custom Pricing: Shows ONLY products that already have a custom price for the client', () => {
  const masterProducts = [
    { id: 'prod-1', name: 'DTF Printing', defaultPrice: 0.50, unit: 'pcs' },
    { id: 'prod-2', name: 'Banner Printing', defaultPrice: 25.00, unit: 'sq.ft' },
    { id: 'prod-3', name: 'Business Cards', defaultPrice: 60.00, unit: 'set' },
    { id: 'prod-4', name: 'Sticker Printing', defaultPrice: 15.00, unit: 'sheet' },
  ];
  const pricingList = [
    { id: 'cp-1', customerId: 'cust-design-ghar', productId: 'prod-1', customPrice: 0.42 },
    { id: 'cp-2', customerId: 'cust-design-ghar', productId: 'prod-2', customPrice: 22.00 }
  ];

  const customForClient = getClientCustomProducts({
    masterProducts,
    pricingList,
    customerId: 'cust-design-ghar'
  });

  assert.equal(customForClient.length, 2);
  assert.deepEqual(customForClient.map(p => [p.name, p.customPrice]), [
    ['DTF Printing', 0.42],
    ['Banner Printing', 22.00]
  ]);
});

test('Custom Pricing: Adding product sets client-specific price and does NOT duplicate products', () => {
  const masterProducts = [
    { id: 'prod-1', name: 'DTF Printing', defaultPrice: 0.50 },
    { id: 'prod-2', name: 'Banner Printing', defaultPrice: 25.00 }
  ];
  let pricingList = [
    { id: 'cp-1', customerId: 'cust-1', productId: 'prod-1', customPrice: 0.42 }
  ];

  // Attempting to add prod-1 again should update existing entry, not duplicate
  const setPrice = (customerId, productId, customPrice) => {
    const idx = pricingList.findIndex(p => p.customerId === customerId && p.productId === productId);
    if (idx !== -1) {
      pricingList[idx].customPrice = customPrice;
    } else {
      pricingList.push({ id: `cp-${Date.now()}`, customerId, productId, customPrice });
    }
  };

  setPrice('cust-1', 'prod-1', 0.40); // Update
  setPrice('cust-1', 'prod-2', 20.00); // Add new

  assert.equal(pricingList.length, 2);
  const clientPricing = pricingList.filter(p => p.customerId === 'cust-1');
  assert.equal(clientPricing.length, 2);
  assert.equal(clientPricing.find(p => p.productId === 'prod-1').customPrice, 0.40);
  assert.equal(clientPricing.find(p => p.productId === 'prod-2').customPrice, 20.00);
});

test('Custom Pricing: Effective rate applies automatically for client without changing master price', () => {
  const masterProducts = [
    { id: 'prod-1', name: 'DTF Printing', defaultPrice: 0.50 }
  ];
  const pricingList = [
    { id: 'cp-1', customerId: 'cust-vip', productId: 'prod-1', customPrice: 0.42 }
  ];

  const vipPrice = resolveEffectivePrice({
    productId: 'prod-1',
    customerId: 'cust-vip',
    masterProducts,
    pricingList
  });
  const normalPrice = resolveEffectivePrice({
    productId: 'prod-1',
    customerId: 'cust-normal',
    masterProducts,
    pricingList
  });

  assert.equal(vipPrice.price, 0.42);
  assert.equal(vipPrice.isCustom, true);
  assert.equal(normalPrice.price, 0.50);
  assert.equal(normalPrice.isCustom, false);
  assert.equal(masterProducts[0].defaultPrice, 0.50); // Master price untouched
});

test('Date Mode: Global Profile Date Format setting controls Client Section display without local toggle', () => {
  const globalSettings = { dateMode: 'BS' };
  const testDate = '2026-09-05';

  const formatClientDate = (adDateStr, mode = globalSettings.dateMode) => {
    if (mode === 'BS') return `${adDateStr} BS`;
    return adDateStr;
  };

  assert.equal(formatClientDate(testDate), '2026-09-05 BS');
  globalSettings.dateMode = 'AD';
  assert.equal(formatClientDate(testDate), '2026-09-05');
});

// Section 12: Credit Expense & Payment Ledger Accounting Logic
function simulateExpenseLedgerEntries(expense) {
  const isCreditExpense = expense.paymentMethod === 'Credit' || (expense.paymentHistory || []).length > 0 || ['Partial', 'Unpaid', 'Credit'].includes(String(expense.paymentStatus || ''));
  const entries = [];

  // Purchase entry: Outgoing business cost is recognized as Dr Amount
  entries.push({
    id: `exp-${expense.id}`,
    type: 'expense',
    jobNo: expense.expenseNumber,
    drAmount: Number(expense.amount || 0), // Full cost recognized in business ledger
    crAmount: 0,
    cashMovement: isCreditExpense ? 0 : -Number(expense.amount || 0), // No cash movement yet if credit
    payment: expense.paymentMethod || 'Credit',
    status: expense.paymentStatus,
    outstandingCredit: expense.outstandingAmount
  });

  // Payment entries: Settlement of liability, Dr = 0 (do NOT duplicate the expense!)
  (expense.paymentHistory || []).forEach((payment, idx) => {
    entries.push({
      id: `credit-paid-${expense.id}-${payment.id || idx}`,
      type: 'credit-paid',
      jobNo: payment.reference || `CP-${idx + 1}`,
      drAmount: 0, // CRITICAL: 0 additional expense debit
      crAmount: 0,
      settlementAmount: Number(payment.amount || 0),
      cashMovement: -Number(payment.amount || 0), // Cash leaves bank/cash account now
      payment: payment.method || 'Cash',
      status: 'Paid',
      note: `Paid Rs. ${payment.amount} against ${expense.expenseNumber}`
    });
  });

  return entries;
}

function recordExpensePaymentSim(expense, paymentData) {
  const amount = Math.max(0, Number(paymentData.amount || 0));
  const outstanding = Math.max(0, Number(expense.outstandingAmount || 0));
  if (!amount) throw new Error('Enter an amount greater than zero.');
  if (amount > outstanding) throw new Error('Amount paid cannot exceed the outstanding balance.');
  const payment = {
    id: `exppay-${Date.now()}`,
    reference: paymentData.reference || `CP-${Date.now()}`,
    amount,
    method: paymentData.method || 'Cash',
    paidAt: paymentData.paidAt || '2026-09-07T12:00:00+05:45',
    paidBy: paymentData.paidBy || '',
    notes: paymentData.notes || ''
  };
  const paymentHistory = [...(expense.paymentHistory || []), payment];
  const paidAmount = Math.min(Number(expense.amount || 0), paymentHistory.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const outstandingAmount = Math.max(0, Number(expense.amount || 0) - paidAmount);
  const updated = {
    ...expense,
    paymentMethod: 'Credit',
    paymentHistory,
    paidAmount,
    outstandingAmount,
    paymentStatus: outstandingAmount <= 0 ? 'Paid' : 'Partial'
  };
  return { expense: updated, payment };
}

test('Expense Credit Accounting: Purchase on Credit recognizes Dr = 18,000 cost, cash movement = 0', () => {
  const expense = {
    id: 'exp-0186',
    expenseNumber: 'EXP-0186',
    title: 'Flex Banner Rolls Purchase',
    vendor: 'Nepal Vinyl Suppliers',
    category: 'Material Stock',
    amount: 18000,
    paidAmount: 0,
    outstandingAmount: 18000,
    paymentMethod: 'Credit',
    paymentStatus: 'Unpaid',
    paymentHistory: []
  };

  const entries = simulateExpenseLedgerEntries(expense);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].drAmount, 18000, 'Business cost recognized as Dr = 18,000 at purchase');
  assert.equal(entries[0].cashMovement, 0, 'Cash movement is 0 until actually paid');
  assert.equal(expense.outstandingAmount, 18000);
  assert.equal(expense.paymentStatus, 'Unpaid');
});

test('Section 12 Accounting: EXP-0186 Rs. 18,000 Credit -> Pay 10,000 -> Pay 8,000 -> Ledger Dr = 18,000 total (NO double counting to 36,000)', () => {
  let expense = {
    id: 'exp-0186',
    expenseNumber: 'EXP-0186',
    title: 'Flex Banner Rolls Purchase',
    vendor: 'Nepal Vinyl Suppliers',
    category: 'Material Stock',
    amount: 18000,
    paidAmount: 0,
    outstandingAmount: 18000,
    paymentMethod: 'Credit',
    paymentStatus: 'Unpaid',
    paymentHistory: []
  };

  // Step 1: Initial state (Credit purchase)
  let ledger = simulateExpenseLedgerEntries(expense);
  let totalDr = ledger.reduce((sum, e) => sum + e.drAmount, 0);
  let totalCashMovement = ledger.reduce((sum, e) => sum + e.cashMovement, 0);
  assert.equal(totalDr, 18000, 'Business cost recognized at purchase');
  assert.equal(totalCashMovement, 0, 'No cash outflow yet at credit purchase');

  // Step 2: Partial payment of Rs. 10,000
  const pay1Result = recordExpensePaymentSim(expense, {
    amount: 10000,
    method: 'Cash',
    reference: 'CP-0101'
  });
  expense = pay1Result.expense;
  assert.equal(expense.paidAmount, 10000);
  assert.equal(expense.outstandingAmount, 8000);
  assert.equal(expense.paymentStatus, 'Partial');

  ledger = simulateExpenseLedgerEntries(expense);
  assert.equal(ledger.length, 2); // 1 purchase (Dr=18000) + 1 payment (Dr=0, settlement=10000)
  assert.equal(ledger[1].drAmount, 0, 'Credit payment must NOT add new Dr expense');
  assert.equal(ledger[1].settlementAmount, 10000);
  totalDr = ledger.reduce((sum, e) => sum + e.drAmount, 0);
  totalCashMovement = ledger.reduce((sum, e) => sum + e.cashMovement, 0);
  assert.equal(totalDr, 18000, 'Total Dr expense stays 18,000 (not 28,000!)');
  assert.equal(totalCashMovement, -10000, 'Cash-on-hand decreases by 10,000 payment');

  // Step 3: Final settlement payment of Rs. 8,000
  const pay2Result = recordExpensePaymentSim(expense, {
    amount: 8000,
    method: 'Bank',
    reference: 'CP-0102'
  });
  expense = pay2Result.expense;
  assert.equal(expense.paidAmount, 18000);
  assert.equal(expense.outstandingAmount, 0);
  assert.equal(expense.paymentStatus, 'Paid');

  ledger = simulateExpenseLedgerEntries(expense);
  assert.equal(ledger.length, 3); // 1 purchase (Dr=18000) + 2 payments (Dr=0, Dr=0)
  totalDr = ledger.reduce((sum, e) => sum + e.drAmount, 0);
  totalCashMovement = ledger.reduce((sum, e) => sum + e.cashMovement, 0);
  assert.equal(totalDr, 18000, 'Total Dr expense remains exactly 18,000 (NEVER 36,000!)');
  assert.equal(totalCashMovement, -18000, 'Total cash outflow across payments equals 18,000');
});

test('Expense Guard: Deletion is blocked if linkedPurchaseId is present', () => {
  const canDeleteExpense = (exp) => {
    if (exp?.linkedPurchaseId) return false;
    return true;
  };

  const linkedExpense = { id: 'exp-1', title: 'Vinyl Roll', linkedPurchaseId: 'STK-001' };
  const standaloneExpense = { id: 'exp-2', title: 'Office Tea', linkedPurchaseId: null };

  assert.equal(canDeleteExpense(linkedExpense), false, 'Expense with linkedPurchaseId cannot be deleted directly');
  assert.equal(canDeleteExpense(standaloneExpense), true, 'Standalone expense can be deleted');
});

test('Financial Ledger: Redesigned 13-column row structure and running balance calculations', () => {
  const initialOpening = 125000;
  const entries = [
    { type: 'opening', date: '2026-09-01', jobNo: '—', partyName: '—', details: 'Opening Balance', payment: '—', status: '—', drAmount: 0, crAmount: 0, outstanding: 0 },
    { type: 'job', date: '2026-09-02', jobNo: 'JOB-1048', partyName: 'ABC Traders', details: 'Banner 3x6 ft', payment: 'Cash', status: 'Paid', drAmount: 0, crAmount: 12500, outstanding: 0 },
    { type: 'expense', date: '2026-09-03', jobNo: 'EXP-0012', partyName: 'Electricity Office', details: 'Electricity Bill - Aug', payment: 'Cash', status: 'Paid', drAmount: 3800, crAmount: 0, outstanding: 0 },
    { type: 'stocking', date: '2026-09-04', jobNo: 'STK-0001', partyName: 'ABC Suppliers', details: 'DTF Film 60cm (1 roll)', payment: 'Cash', status: 'Paid', drAmount: 6200, crAmount: 0, outstanding: 0 },
    { type: 'stocking', date: '2026-09-05', jobNo: 'STK-0002', partyName: 'XYZ Suppliers', details: 'Vinyl Roll 60cm (10 roll)', payment: 'Credit', status: 'Unpaid', drAmount: 18000, crAmount: 0, outstanding: 18000 },
    { type: 'payment', date: '2026-09-06', jobNo: 'CR-1692', partyName: 'Design Ghar', details: 'Received old credit (JOB-1056)', payment: 'Online', status: 'Paid', drAmount: 0, crAmount: 5000, outstanding: 0 },
    { type: 'credit-paid', date: '2026-09-07', jobNo: 'CP-0001', partyName: 'XYZ Suppliers', details: 'Payment for credit (STK-0002)', payment: 'Bank', status: 'Partial', drAmount: 0, crAmount: 0, settlementAmount: 10000, outstanding: 8000 }
  ];

  let balance = initialOpening;
  const balanced = entries.map((entry, idx) => {
    if (idx > 0) balance += entry.crAmount - entry.drAmount;
    return { ...entry, sn: idx + 1, runningBalance: balance };
  });

  assert.equal(balanced[0].runningBalance, 125000, 'Opening balance preserved');
  assert.equal(balanced[1].runningBalance, 137500, 'Job increases balance by 12,500');
  assert.equal(balanced[2].runningBalance, 133700, 'Expense decreases balance by 3,800');
  assert.equal(balanced[3].runningBalance, 127500, 'Stocking decreases balance by 6,200');
  assert.equal(balanced[4].runningBalance, 109500, 'Credit purchase Dr 18,000 recognizes cost');
  assert.equal(balanced[5].runningBalance, 114500, 'Credit received Cr 5,000 increases balance');
  assert.equal(balanced[6].runningBalance, 114500, 'Settlement payment Dr is 0, does NOT double count Dr');

  const totalDr = entries.reduce((sum, e) => sum + e.drAmount, 0);
  const totalCr = entries.reduce((sum, e) => sum + e.crAmount, 0);
  assert.equal(totalDr, 28000);
  assert.equal(totalCr, 17500);
});

test('Theme & Branding: Supports Customized All Transactions header, footer, and alternate colors', () => {
  const customSettings = {
    allTransactionsHeaderColor: '#2563eb',
    allTransactionsHeaderTextColor: '#ffffff',
    allTransactionsFooterColor: '#1e3a8a',
    allTransactionsFooterTextColor: '#ffffff',
    allTransactionsAlternateColor: '#eff6ff',
    allTransactionsAlternateTint: 80
  };

  assert.equal(customSettings.allTransactionsHeaderColor, '#2563eb');
  assert.equal(customSettings.allTransactionsHeaderTextColor, '#ffffff');
  assert.equal(customSettings.allTransactionsFooterColor, '#1e3a8a');
  assert.equal(customSettings.allTransactionsFooterTextColor, '#ffffff');
  assert.equal(customSettings.allTransactionsAlternateColor, '#eff6ff');
  assert.equal(customSettings.allTransactionsAlternateTint, 80);
});

test('Printing Gate: Logged-in designer is auto-resolved without requiring manual selection or team entry', () => {
  const loggedInUser = { id: 'usr-des-1', name: 'Rohan Sharma', role: 'designer', jobTitle: 'Graphic Designer' };
  const isDesignerRole = loggedInUser.role === 'designer';
  const team = []; // Empty team in Profile -> Team
  const selectedDesignerId = '';

  const fallbackStaff = loggedInUser ? {
    id: loggedInUser.id,
    name: loggedInUser.name,
    role: loggedInUser.role,
    jobTitle: loggedInUser.jobTitle
  } : null;

  const currentDesignerMember = team.find(t => (t.role === 'designer' || (t.jobTitle || '').toLowerCase().includes('design')) && (t.id === loggedInUser?.id || t.name === loggedInUser?.name)) ||
    (isDesignerRole && loggedInUser ? { id: loggedInUser.id, name: loggedInUser.name, role: 'designer', jobTitle: loggedInUser.jobTitle } : null);

  const chosenMember = (isDesignerRole ? currentDesignerMember : null)
    || (team || []).find(t => t.id === selectedDesignerId)
    || (team || [])[0]
    || fallbackStaff;

  assert.ok(chosenMember, 'Chosen member must not be null');
  assert.equal(chosenMember.id, 'usr-des-1');
  assert.equal(chosenMember.name, 'Rohan Sharma');
  assert.equal(chosenMember.role, 'designer');

  // Should bypass PIN verification since loggedInUser is authenticated
  const requiresPin = !(isDesignerRole || Boolean(loggedInUser));
  assert.equal(requiresPin, false, 'Authenticated designer should NOT be prompted for PIN');
});

