import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
const billStart = app.indexOf('const createReferenceBillPdf');
const billEnd = app.indexOf('const createReferenceChalanPdf', billStart);
const bill = app.slice(billStart, billEnd);

test('V12 wraps long descriptions and uses adaptive row heights instead of ellipsis truncation', () => {
  assert.match(bill, /descriptionParts\.forEach\(part\s*=>\s*lines\.push\(\.\.\.doc\.splitTextToSize\(part/);
  assert.match(bill, /const drawRows\s*=\s*\(pageItems,\s*startIndex,\s*bodyTop,\s*bodyBottom,\s*capacity\)/);
  assert.match(bill, /desired\s*=\s*item\s*\?\s*Math\.max/);
  assert.match(bill, /rowY\s*\+=\s*rowH/);
  assert.match(bill, /doc\.text\(metric\.lines,\s*26\.23,\s*descBase/);
  assert.equal(/oneLine\(`\$\{item\.productName/.test(bill), false);
});

test('V12 Invoice To fields collapse upward when address PAN or phone is missing', () => {
  assert.match(bill, /const clientDetails\s*=\s*\[\]/);
  assert.match(bill, /if\s*\(String\(clientAddress\s*\|\|\s*''\)\.trim\(\)\)\s*clientDetails\.push/);
  assert.match(bill, /if\s*\(String\(clientPan\s*\|\|\s*''\)\.trim\(\)\)\s*clientDetails\.push/);
  assert.match(bill, /if\s*\(String\(clientPhone\s*\|\|\s*''\)\.trim\(\)\)\s*clientDetails\.push/);
  assert.match(bill, /clientDetails\.forEach\(\(value,\s*index\)\s*=>\s*doc\.text\(oneLine\(value,\s*62\),\s*13\.019,\s*54\.55\s*\+\s*\(index\s*\*\s*3\.9\)\)\)/);
});

test('V12 draws the date cleanup before the invoice number so digits are not clipped', () => {
  const drawClientStart = bill.indexOf('const drawClientInvoice');
  const drawClientEnd = bill.indexOf('const tableTextSize', drawClientStart);
  const drawClient = bill.slice(drawClientStart, drawClientEnd);
  assert.ok(drawClient.indexOf('drawIssueDate();') < drawClient.indexOf("doc.text(oneLine(invoiceNo"));
});

test('V12 keeps fixed page footprints while adapting single and multipage table rows', () => {
  assert.match(bill, /71\.30,\s*161\.35,\s*singlePageCapacity/);
  assert.match(bill, /71\.30,\s*174\.15,\s*multiFirstPageCapacity/);
  assert.match(bill, /46\.30,\s*161\.85,\s*continuationCapacity/);
});
