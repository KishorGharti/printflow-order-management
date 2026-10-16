import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('V11 company artwork renderer uses the actual design data for bill and chalan', () => {
  const billStart = app.indexOf('const createReferenceBillPdf');
  const chalanStart = app.indexOf('const createReferenceChalanPdf');
  const bill = app.slice(billStart, chalanStart);
  const chalan = app.slice(chalanStart, app.indexOf('const storageService', chalanStart));
  assert.match(bill, /const designData\s*=\s*config\.companyDesign/);
  assert.match(bill, /doc\.getImageProperties\(designData\)/);
  assert.match(bill, /doc\.addImage\(designData/);
  assert.match(chalan, /const designData\s*=\s*config\.companyDesign\s*\|\|\s*\(inherited\s*\?\s*billCompany\.companyDesign\s*:\s*''\)/);
  assert.match(chalan, /doc\.getImageProperties\(designData\)/);
  assert.match(chalan, /doc\.addImage\(designData/);
});

test('V11 keeps 14 rows for single page but uses 16 on multipage first page', () => {
  assert.match(app, /const singlePageCapacity\s*=\s*14/);
  assert.match(app, /const multiFirstPageCapacity\s*=\s*16/);
  assert.match(app, /const isMultiPage\s*=\s*items\.length\s*>\s*singlePageCapacity/);
  assert.match(app, /items\.slice\(0,\s*multiFirstPageCapacity\)/);
  assert.match(app, /const start\s*=\s*multiFirstPageCapacity\s*\+\s*\(pageIndex\s*-\s*1\)\s*\*\s*continuationCapacity/);
});

test('V11 moves Bill Issue Date close to the date value and fixes chalan meta overlap', () => {
  assert.match(app, /doc\.text\('Bill Issue Date',\s*134\.7,\s*59\.25/);
  assert.match(app, /doc\.rect\(105\.5,\s*51\.2,\s*30\.3,\s*13\.2,\s*'F'\)/);
  assert.match(app, /doc\.text\('Bill Issue Date',\s*135\.0,\s*59\.2/);
  assert.match(app, /doc\.text\(oneLine\(issueDate,\s*32\),\s*135\.0,\s*63\.2/);
});
