import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appJs = fs.readFileSync('dist/app.js', 'utf8');

test('storageService defines formatWhatsAppTemplate and supports all dynamic tags', () => {
  assert.match(appJs, /formatWhatsAppTemplate\s*\(/);

  // Extract the function body from app.js to test directly
  const fnMatch = appJs.match(/formatWhatsAppTemplate\(template,\s*order,\s*status\)\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(fnMatch, 'formatWhatsAppTemplate should be present on storageService');

  // Create mock storageService context
  const mockStorageService = {
    getCustomerById: (id) => ({ id, businessName: 'Himalayan Enterprises', phone: '9841000000' }),
    formatCurrency: (val) => `Rs. ${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    getSettings: () => ({ shopName: 'Print Ghar Nepal', shopPhone: '9851000000', whatsappTemplate: '' }),
    formatWhatsAppTemplate: new Function('template', 'order', 'status', fnMatch[1])
  };

  const sampleOrder = {
    id: 'ord-1',
    orderNumber: 'JOB-2045',
    customerId: 'cust-1',
    orderContactName: 'Himalayan Enterprises',
    totalAmount: 4500,
    advancePaid: 1000,
    balanceAmount: 3500,
    status: 'Printing',
    items: [
      { productName: 'Brochure Printing' },
      { productName: 'Lamination' }
    ]
  };

  // Test single brace tags
  const template1 = 'Namaste {customerName}, your job {orderNumber} ({productName}) is now {status}. Total: {totalAmount}, Paid: {paidAmount}, Due: {dueAmount}. - {shopName}';
  const res1 = mockStorageService.formatWhatsAppTemplate(template1, sampleOrder, 'Printing');

  assert.match(res1, /Namaste Himalayan Enterprises/);
  assert.match(res1, /JOB-2045/);
  assert.match(res1, /Brochure Printing, Lamination/);
  assert.match(res1, /Printing/);
  assert.match(res1, /Total: Rs\. 4,500\.00/);
  assert.match(res1, /Paid: Rs\. 1,000\.00/);
  assert.match(res1, /Due: Rs\. 3,500\.00/);
  assert.match(res1, /- Print Ghar Nepal/);

  // Test double brace tags with underscores
  const template2 = 'Hello {{company_name}}! Status of {{job_no}}: {{status}} | Due: {{due_amount}}';
  const res2 = mockStorageService.formatWhatsAppTemplate(template2, sampleOrder, 'In Design');

  assert.equal(res2, 'Hello Himalayan Enterprises! Status of JOB-2045: In Design | Due: Rs. 3,500.00');
});

test('sendWhatsAppStatusUpdate checks custom template before using built-in messages', () => {
  assert.match(appJs, /const customTemplate = String\(waSettings\.whatsappTemplate/);
  assert.match(appJs, /if \(customTemplate && !isLegacyBoilerplate\)\s*\{\s*message = this\.formatWhatsAppTemplate\(customTemplate/);
});

test('UI templates have clear tag guidance for custom status updates', () => {
  assert.match(appJs, /Tags: \{customerName\}, \{orderNumber\}, \{productName\}, \{status\}, \{totalAmount\}/);
});
