import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('Reference billing keeps the fixed PDF bill designer and removes old free-form systems', () => {
  assert.equal(app.includes('SimpleDocumentDesigner'), false);
  assert.equal(app.includes('DocumentDesignSettings'), false);
  assert.match(app, /Chalan Design/);
  assert.equal(app.includes('createDesignerPdf'), false);
  assert.match(app, /ReferenceBillDesigner/);
  assert.match(app, /Fixed A5 Bill and Chalan layouts based on your supplied PDFs/);
});

test('V5 keeps the original 14-row first-page geometry', () => {
  assert.match(app, /items\.slice\(0,\s*singlePageCapacity\)/);
  assert.match(app, /71\.30,\s*161\.35,\s*singlePageCapacity/);
});

test('V5 supports company artwork upload with resize controls', () => {
  assert.match(app, /companyDesign/);
  assert.match(app, /Width %/);
  assert.match(app, /Height %/);
  assert.match(app, /Horizontal position %/);
  assert.match(app, /Vertical position %/);
  assert.match(app, /Company design must be a JPG or PNG file/);
});

test('V5 fills pickup name only for Pickup orders', () => {
  assert.match(app, /if\s*\(order\.status\s*===\s*'Pickup'\)/);
  assert.match(app, /order\.pickupPersonName\s*\|\|\s*'Self \/ Owner'/);
});

test('V5 live preview and final PDF use the same renderer', () => {
  assert.match(app, /createReferenceBillPdf\(storageService,\s*previewOrder,\s*billConfig\)/);
  assert.match(app, /This preview and final PDF use the same renderer/);
});
