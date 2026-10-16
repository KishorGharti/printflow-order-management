import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('Chalan reference system is based on the supplied A5 PDF', () => {
  assert.match(app, /CHALAN_REFERENCE_TEMPLATE_PNG/);
  assert.match(app, /createReferenceChalanPdf/);
  assert.match(app, /Delivery Chalan/);
  assert.match(app, /CHALAN_REFERENCE_CONFIG_DEFAULTS/);
  assert.match(app, /chalanNo/);
  assert.match(app, /issueDate/);
});

test('Chalan maps the supplied table columns and fixed 14-row page', () => {
  assert.match(app, /const rowsPerPage\s*=\s*14/);
  assert.match(app, /Remarks/);
  assert.match(app, /const defaultRemark\s*=\s*String\(config\.defaultRemarks\s*\|\|\s*''\)\.trim\(\)/);
  assert.match(app, /S\.N\., Description, Qty and Remarks/);
});

test('Chalan dispatch placeholders follow Pickup and Delivery data', () => {
  assert.match(app, /if\s*\(status\s*===\s*'Pickup'\)/);
  assert.match(app, /order\.pickupPersonName\s*\|\|\s*'Self \/ Owner'/);
  assert.match(app, /else if\s*\(status\s*===\s*'Delivery'\)/);
  assert.match(app, /order\.deliveryPersonName\s*\|\|\s*order\.deliveryPersonJobTitle/);
});

test('Chalan settings include company artwork fitting, terms and footer', () => {
  assert.match(app, /normalizeChalanReferenceConfig/);
  assert.match(app, /chalanReferenceConfig/);
  assert.match(app, /Fit to Placeholder/);
  assert.match(app, /Terms and conditions/);
  assert.match(app, /Default remarks/);
  assert.match(app, /Chalan Design/);
});

test('Operational chalan print uses the new reference renderer', () => {
  assert.match(app, /createDeliveryChalanPdf\(order = \{\}\) \{\s*return createReferenceChalanPdf\(this, order\);/);
});

test('Chalan designer supports copying design from bill via Use Bill design checkbox', () => {
  assert.match(app, /Use Bill design/);
  assert.match(app, /onToggleUseBillDesign/);
});


