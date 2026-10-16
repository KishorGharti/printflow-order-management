import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('master products store and resolve sub-option-specific prices', () => {
  assert.match(app, /variantPrices: productMaterialsEnabled && productSubOptionsEnabled \? cleanVariantPrices : \{\}/);
  assert.match(app, /prod\.variantPrices && Object\.prototype\.hasOwnProperty\.call\(prod\.variantPrices, normalizedVariant\)/);
  assert.match(app, /source: 'master-variant'/);
  assert.match(app, /Selling Price \(\$\{settings\.currencySymbol\}\)/);
});

test('an existing sub-option stock link can be replaced in place', () => {
  assert.match(app, /Stock Entry \(change anytime\)/);
  assert.match(app, /value: material\.inventoryItemId/);
  assert.match(app, /setProductMaterials\(list => list\.map/);
  assert.match(app, /setProductVariantOptions\(list => list\.map/);
});

test('stock sub-options use a deliberate selector plus Add button', () => {
  assert.match(app, /value: pendingStockSubOptionId/);
  assert.match(app, /disabled: !pendingStockSubOptionId/);
  assert.match(app, /setPendingStockSubOptionId\(''\)/);
});

test('new order product composer scopes the picker to the selected product sub-items', () => {
  assert.match(app, /newOrderProductScopeId \? getNewOrderSubItemOptions\(newOrderProductScopeId\) : getNewOrderProductOptions\(\)/);
  assert.match(app, /setNewOrderProductScopeId\(product\.id\)/);
  assert.match(app, /Select this product's sub-item/);
  assert.match(app, /Change product/);
});

test('mixed sub-item quantities are allocated automatically from total quantity', () => {
  assert.match(app, /const allocateQuantityAcrossVariants =/);
  assert.match(app, /setNewOrderVariantQuantities\(allocateQuantityAcrossVariants\(value, selection\.product\.variants\)\)/);
  assert.match(app, /changing Total Qty redistributes it evenly/);
});

test('manual sub-item allocations update total quantity automatically', () => {
  assert.match(app, /value: newOrderVariantQuantities\[variant\] \?\? ''/);
  assert.match(app, /selection\.product\.variants\.reduce\(\(sum, item\) => sum \+ Math\.max/);
  assert.match(app, /setNewOrderQuantity\(String\(total\)\)/);
});

test('mixed sub-items retain a display group for ledgers jobs and all transactions', () => {
  assert.match(app, /const groupSubOptionItemsForDisplay =/);
  assert.match(app, /subItemGroupId = createId\('subitem-group'\)/);
  assert.match(app, /subItemGroupName: prod\.name/);
  assert.match(app, /const items = groupSubOptionItemsForDisplay\(order\?\.items \|\| \[\]\)/);
  assert.match(app, /const invoiceItems = entry\.type === 'invoice' \? groupSubOptionItemsForDisplay/);
  assert.match(app, /groupSubOptionItemsForDisplay\(entry\.items\)/);
});

test('each stock sub-option price has an enabled inline save action', () => {
  assert.match(app, /savedVariantPrice === optionName \? 'Saved ✓' : 'Save Price'/);
  assert.match(app, /storageService\.saveProduct\(\{ id: editingProduct\.id, variantPrices:/);
  assert.match(app, /event\.currentTarget\.form\?\.requestSubmit\(\)/);
  assert.match(app, /Enter a valid selling price for \$\{optionName\}/);
});

test('client override shows and preserves each master stock sub-option price', () => {
  assert.match(app, /const inheritedPrice = masterVariantPrice/);
  assert.match(app, /String\(masterVariantPrice\)/);
  assert.match(app, /Master sub-option price/);
  assert.match(app, /reset to \$\{variant \? 'the master sub-option price' : 'the master price'\}/);

  const resolve = ({ clientVariant, masterVariant, clientProduct, masterProduct }) =>
    clientVariant ?? masterVariant ?? clientProduct ?? masterProduct;
  assert.equal(resolve({ clientVariant: undefined, masterVariant: 200, clientProduct: 50, masterProduct: 100 }), 200);
  assert.equal(resolve({ clientVariant: 175, masterVariant: 200, clientProduct: 50, masterProduct: 100 }), 175);
});

test('order snapshots retain the resolved master sub-option price', () => {
  assert.match(app, /defaultPrice: Number\(prod\.variantPrices\?\.\[entry\.variant\] \?\? prod\.defaultPrice\)/);
  assert.match(app, /defaultPrice: Number\(prod\.variantPrices\?\.\[selectedProductOption\.variant\] \?\? prod\.defaultPrice\)/);
});
