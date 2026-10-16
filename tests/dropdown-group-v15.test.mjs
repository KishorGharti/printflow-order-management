import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('V15 dropdown policy uses segmented controls for two obvious options and searchable long lists', () => {
  assert.match(app, /Dropdown UX policy: 2 choices use segmented controls/);
  assert.match(app, /const SegmentedChoice/);
  assert.match(app, /name:\s*'pProductionType'/);
  assert.match(app, /name:\s*'dateMode'/);
  assert.match(app, /placeholder:\s*'Search unit\.\.\.'/);
  assert.match(app, /placeholder:\s*'Search designer\.\.\.'/);
  assert.match(app, /placeholder:\s*'Search team member\.\.\.'/);
});

test('V15 searchable selection supports disabled invalid options', () => {
  assert.match(app, /if \(opt\?\.disabled\) return/);
  assert.match(app, /aria-disabled/);
  assert.match(app, /cursor-not-allowed/);
});

test('V15 Group Item checkbox lives beside Product Composer and conditionally reveals breakdown', () => {
  assert.match(app, /Product Composer/);
  assert.match(app, /"Group Item"/);
  assert.match(app, /newOrderFileBreakdownEnabled && h\("div", \{ className:"rounded-2xl border border-sky-200/);
  assert.match(app, /if\(enabled\)setIsKnowAfterDesign\(false\)/);
});

test('grouped document billing expands each design into its own row', () => {
  assert.match(app, /const expandGroupedItemsForDocuments/);
  assert.match(app, /productName:`\$\{row\.name\} \(\$\{parentName\}\)`/);
  const billStart = app.indexOf('const createReferenceBillPdf');
  const chalanStart = app.indexOf('const createReferenceChalanPdf');
  const bill = app.slice(billStart, chalanStart);
  const chalan = app.slice(chalanStart, app.indexOf('const storageService', chalanStart));
  assert.match(bill, /expandGroupedItemsForDocuments\(sourceItems\)/);
  assert.match(chalan, /expandGroupedItemsForDocuments\(sourceItems\)/);
});

test('order workflow uses a collapsible dropdown with production audit details', () => {
  assert.match(app, /Collapsible Workflow dropdown/);
  const start=app.indexOf('// Collapsible Workflow dropdown');
  const end=app.indexOf('// MAIN CONTENT COLUMN',start);
  const section=app.slice(start,end);
  assert.equal(section.includes('h("details"'), false);
  assert.equal(section.includes('h("select"'), false);
  assert.match(section, /setWorkflowDropdownOpen/);
  assert.match(section, /Design Print & Download Activity/);
});
