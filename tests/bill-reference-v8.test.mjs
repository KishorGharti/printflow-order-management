import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('V8 uses number input for table text size instead of slider', () => {
  assert.match(app, /Table row text size \(pt\)/);
  assert.match(app, /type:\s*'number',\s*min:\s*6,\s*max:\s*12,\s*step:\s*0?\.5/);
  assert.equal(app.includes("type:'range',min:6,max:12,step:.5,value:config.tableTextSize"), false);
});

test('V8 changes DATE label to Bill Issue Date', () => {
  assert.match(app, /doc\.text\('Bill Issue Date'/);
  assert.match(app, /drawIssueDate\(\)/);
});

test('V8 creates continuation pages after the original 14-row bill limit', () => {
  assert.match(app, /const isMultiPage\s*=\s*items\.length\s*>\s*singlePageCapacity/);
  assert.match(app, /const continuationCapacity\s*=\s*18/);
  assert.match(app, /BILL_MULTIPAGE_FIRST_TEMPLATE_PNG/);
  assert.match(app, /BILL_MULTIPAGE_FINAL_TEMPLATE_PNG/);
  assert.match(app, /items\.slice\(0,\s*multiFirstPageCapacity\)/);
  assert.match(app, /multiFirstPageCapacity\s*\+\s*\(pageIndex\s*-\s*1\)\s*\*\s*continuationCapacity/);
  assert.match(app, /Move to Next Page >>/);
  assert.match(app, /if\s*\(isLast\)\s*drawTotals\(true\)/);
});

test('V8 keeps pickup name conditional and page numbers dynamic', () => {
  assert.match(app, /if\s*\(order\.status\s*===\s*'Pickup'\)/);
  assert.match(app, /Page \$\{pageIndex\s*\+\s*1\} of \$\{pageCount\}/);
});
