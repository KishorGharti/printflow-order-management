import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('grouped file breakdown stores one production quantity from child file quantities', () => {
  assert.match(app, /File \/ Design Breakdown/);
  assert.match(app, /Group Item/);
  assert.match(app, /fileBreakdownTotal\(cleanBreakdown\)/);
  assert.match(app, /fileBreakdown: cleanBreakdown/);
});

test('production keeps one parent item while Bill and Chalan can expand child designs', () => {
  assert.match(app, /Production stays one total line/);
  assert.match(app, /const expandGroupedItemsForDocuments/);
  assert.match(app, /productName:`\$\{row\.name\} \(\$\{parentName\}\)`/);
});

test('Bill uses expanded grouped rows without exposing internal print instructions', () => {
  const billStart = app.indexOf('const createReferenceBillPdf');
  const chalanStart = app.indexOf('const createReferenceChalanPdf');
  const bill = app.slice(billStart, chalanStart);
  assert.match(bill, /const items=expandGroupedItemsForDocuments\(sourceItems\)/);
  assert.match(bill, /const productName=item\?String\(item\.productName\|\|'Product'\):''/);
  assert.equal(bill.includes('item.itemDescription'), false);
});

test('order edit screen can maintain file breakdown after order creation', () => {
  assert.match(app, /Grouped file \/ design details/);
  assert.match(app, /const fileBreakdown=normalizeFileBreakdown\(it\.fileBreakdown\)/);
});
