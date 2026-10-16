import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('Bill and Chalan PDFs exclude Description / Print Instruction; Bill may add client file breakdown', () => {
  const billStart = app.indexOf('const createReferenceBillPdf');
  const chalanStart = app.indexOf('const createReferenceChalanPdf');
  const bill = app.slice(billStart, chalanStart);
  const chalan = app.slice(chalanStart, app.indexOf('const storageService', chalanStart));
  assert.match(bill, /const items=expandGroupedItemsForDocuments\(sourceItems\)/);
  assert.match(bill, /const productName=item\?String\(item\.productName\|\|'Product'\):''/);
  assert.match(app, /const expandGroupedItemsForDocuments =/);
  assert.equal(bill.includes('item.itemDescription'), false);
  assert.match(chalan, /const description\s*=\s*item\s*\?\s*String\(item\.productName\s*\|\|\s*'Product'\)\s*:\s*''/);
  assert.equal(chalan.includes('item.itemDescription'), false);
});

test('Chalan client details dynamically stack when fields are missing', () => {
  assert.match(app, /const clientDetails\s*=\s*\[\]/);
  assert.match(app, /clientDetails\.push\(String\(clientAddress\)\.trim\(\)\)/);
  assert.match(app, /clientDetails\.push\(`PAN:/);
  assert.match(app, /clientDetails\.push\(`Phone:/);
  assert.match(app, /clientDetails\.forEach\(value\s*=>/);
});

test('Chalan long product names wrap with adaptive row height', () => {
  assert.match(app, /CHALAN_TABLE_COLUMNS/);
  assert.match(app, /doc\.splitTextToSize\(description/);
  assert.match(app, /const lineCount\s*=\s*Math\.max\(descLines\.length,\s*remarkLines\.length,\s*1\)/);
  assert.match(app, /rowH\s*=\s*heights\[index\]/);
});

test('Default Chalan remarks are identical for every item row', () => {
  assert.match(app, /const defaultRemark\s*=\s*String\(config\.defaultRemarks\s*\|\|\s*''\)\.trim\(\)/);
  assert.match(app, /const remarks\s*=\s*item\s*\?\s*defaultRemark\s*:\s*''/);
  assert.match(app, /Default remarks for all rows/);
  assert.match(app, /Same remarks used for every Chalan item row/);
});

test('Client profile create/edit includes PAN number', () => {
  assert.match(app, /name: "cPan"/);
  assert.match(app, /pan: e\.target\.cPan\.value\.trim\(\)/);
  assert.match(app, /panNumber: e\.target\.cPan\.value\.trim\(\)/);
  assert.match(app, /PAN Number/);
});

test('Order workflow is rendered as a compact collapsible dropdown', () => {
  assert.match(app, /Collapsible Workflow dropdown/);
  assert.match(app, /workflowDropdownOpen/);
  assert.match(app, /grid grid-cols-2 gap-1\.5/);
  assert.match(app, /Pickup/);
  assert.match(app, /Delivery/);
  assert.match(app, /! Mistake/);
});
