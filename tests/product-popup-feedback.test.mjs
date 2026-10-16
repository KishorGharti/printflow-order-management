import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appJs = fs.readFileSync('dist/app.js', 'utf8');
const productControllerJs = fs.readFileSync('backend/src/controllers/productController.js', 'utf8');

test('Master Product: Edit and Create forms display popup message on save', () => {
  // Checks that duplicate product name check is performed before saving
  assert.match(appJs, /const\s+duplicate\s*=\s*masterProducts\.find\(/);
  assert.match(appJs, /title:\s*['"]Product Already Exists['"]/);

  // Checks that on save, setAppAlert popup displays for created and updated products
  assert.match(appJs, /title:\s*isEdit \? ['"]Product Updated['"] : ['"]Product Created['"]/);
  assert.match(appJs, /Product "\$\{name\}" has been updated successfully\./);
  assert.match(appJs, /Master product "\$\{name\}" has been created successfully\./);
});

test('Master Product: Delete action triggers confirmation popup and deletion success popup', () => {
  // Checks that card delete button triggers confirmation setAppAlert popup
  assert.match(appJs, /title:\s*['"]Delete Master Product['"]/);
  assert.match(appJs, /subtitle:\s*['"]Confirm Deletion['"]/);
  assert.match(appJs, /label:\s*['"]Delete Product['"],\s*tone:\s*['"]danger['"]/);

  // Checks that deletion success popup is triggered
  assert.match(appJs, /title:\s*['"]Product Deleted['"]/);
  assert.match(appJs, /Product "\$\{p\.name\}" has been deleted successfully\./);
});

test('Master Product: Edit modal includes Delete Product button with confirmation popup', () => {
  assert.match(appJs, /editingProduct \? h\(['"]button['"],\s*\{[\s\S]*?className:\s*['"][^'"]*text-rose-600[\s\S]*?Delete Product/);
  assert.match(appJs, /Product "\$\{editingProduct\.name\}" has been deleted successfully\./);
});

test('Master Product: Backend productController prevents duplicate products with 409 Conflict', () => {
  assert.match(productControllerJs, /SELECT id FROM products WHERE LOWER\(TRIM\(name\)\) = LOWER\(TRIM\(\$1\)\)/);
  assert.match(productControllerJs, /res\.status\(409\)\.json\(\{\s*error:\s*`Master product "\$\{name\}" already exists\.`\s*\}\)/);
});
