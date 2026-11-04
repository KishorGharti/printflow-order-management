import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Builds the real bill and delivery chalan PDFs from dist/app.js with a stand-in jsPDF that records
// every text written, then checks each item row shows its order's original job number.
const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
const start = app.indexOf('  const normalizeFileBreakdown = ');
const end = app.indexOf('  const storageService = {');
assert.ok(start > 0 && end > start, 'PDF builders found in dist/app.js');

function loadBuilders() {
  const written = [];
  class FakePdf {
    constructor() { this.size = 8; }
    setFont() {} setFontSize(s) { this.size = s; } setTextColor() {} setFillColor() {} setDrawColor() {} setLineWidth() {}
    rect() {} line() {} addImage() {} addPage() {} getImageProperties() { return { width: 1, height: 1 }; }
    getTextWidth(s) { return String(s).length * this.size * 0.18; }
    splitTextToSize(s, w) {
      const words = String(s).split(' '); const lines = []; let cur = '';
      for (const word of words) { const next = cur ? `${cur} ${word}` : word; if (this.getTextWidth(next) > w && cur) { lines.push(cur); cur = word; } else cur = next; }
      lines.push(cur); return lines;
    }
    text(value) { written.push(Array.isArray(value) ? value.join(' ') : String(value)); }
    output() { return 'blob'; }
  }
  const context = {
    window: { jspdf: { jsPDF: FakePdf } },
    normalizeBillReferenceConfig: () => ({}), normalizeChalanReferenceConfig: () => ({}),
    getKathmanduDateKey: () => '2083-07-10', PROFILE_CLIENT_ID: 'profile-client',
    BILL_REFERENCE_TEMPLATE_PNG: '', BILL_MULTIPAGE_FIRST_TEMPLATE_PNG: '', BILL_MULTIPAGE_FINAL_TEMPLATE_PNG: '', CHALAN_REFERENCE_TEMPLATE_PNG: '',
    Image: undefined,
  };
  vm.runInNewContext(`${app.slice(start, end)}\nthis.bill = createReferenceBillPdf; this.chalan = createReferenceChalanPdf;`, context);
  return { ...context, written };
}

const storage = {
  getSettings: () => ({}), getCustomerById: () => ({ name: 'Himalayan Creative Studio', phone: '9841234567' }),
  generateNextInvoiceNumber: () => 'SHOULD-NOT-BE-USED', displayDate: (d) => d, formatCurrency: (v) => `Rs.${v}`, amountInWords: () => 'words',
};
const item = (id, name, extra = {}) => ({ id, productName: name, quantity: 10, unit: 'pcs', unitPrice: 5, lineTotal: 50, ...extra });

test('a single-order bill and chalan show the order job number beside every item', () => {
  const order = { id: 'o1', orderNumber: 'JOB-1042', invoiceNumber: '51', customerId: 'c1', items: [item('i1', 'Premium Business Cards'), item('i2', 'Vinyl Banner')] };
  for (const kind of ['bill', 'chalan']) {
    const b = loadBuilders();
    b[kind](storage, order);
    assert.ok(b.written.includes('Premium Business Cards [JOB-1042]'), `${kind}: ${b.written.join(' | ')}`);
    assert.ok(b.written.includes('Vinyl Banner [JOB-1042]'), kind);
  }
});

test('a combined bill shows each item with its own original job number', () => {
  const combined = {
    id: 'o1', orderNumber: 'JOB-1042, JOB-1043', invoiceNumber: '52', customerId: 'c1',
    billingJobNumbers: ['JOB-1042', 'JOB-1043'],
    items: [item('i1', 'Premium Business Cards', { billingJobNumber: 'JOB-1042' }), item('i2', 'Sticker Sheet', { billingJobNumber: 'JOB-1043' })],
  };
  for (const kind of ['bill', 'chalan']) {
    const b = loadBuilders();
    b[kind](storage, combined);
    assert.ok(b.written.includes('Premium Business Cards [JOB-1042]'), kind);
    assert.ok(b.written.includes('Sticker Sheet [JOB-1043]'), kind);
    assert.equal(b.written.some((t) => t.includes('[JOB-1042, JOB-1043]')), false, `${kind}: never the joined list`);
  }
});

test('grouped (per design) rows keep their order job number; no number is invented', () => {
  const order = {
    id: 'o1', orderNumber: 'JOB-1050', invoiceNumber: '53', customerId: 'c1',
    items: [item('i1', 'Flyer', { fileBreakdown: [{ id: 'f1', name: 'Design A', quantity: 4 }, { id: 'f2', name: 'Design B', quantity: 6 }] })],
  };
  const b = loadBuilders();
  b.bill(storage, order);
  assert.ok(b.written.includes('Design A (Flyer) [JOB-1050]'));
  assert.ok(b.written.includes('Design B (Flyer) [JOB-1050]'));

  // Combined order whose item has no tag: show nothing rather than a wrong or made-up number.
  const untagged = { id: 'o2', orderNumber: 'JOB-1, JOB-2', billingJobNumbers: ['JOB-1', 'JOB-2'], invoiceNumber: '54', customerId: 'c1', items: [item('i1', 'Poster')] };
  const c = loadBuilders();
  c.bill(storage, untagged);
  assert.ok(c.written.includes('Poster'));
  assert.equal(c.written.some((t) => /Poster \[/.test(t)), false);
});

test('numbering logic is untouched: invoice number comes from the order', () => {
  const b = loadBuilders();
  b.bill(storage, { id: 'o1', orderNumber: 'JOB-1042', invoiceNumber: '51', customerId: 'c1', items: [item('i1', 'Card')] });
  assert.ok(b.written.includes('51'));
  assert.equal(b.written.some((t) => t.includes('SHOULD-NOT-BE-USED')), false);
});
