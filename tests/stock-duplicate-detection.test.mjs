import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appJs = fs.readFileSync('dist/app.js', 'utf8');
const stockControllerJs = fs.readFileSync('backend/src/controllers/stockController.js', 'utf8');

test('Stock Duplicate: Frontend form checks for duplicates and displays popup alert', () => {
  // Check that duplicateItem is detected in the onSubmit handler
  assert.match(appJs, /const\s+duplicateItem\s*=\s*stock\.find\(/);
  assert.match(appJs, /String\(item\.name \|\| ''\)\.trim\(\)\.toLowerCase\(\) === normalizedName/);

  // Check that setAppAlert is called with 'Product Already Exists' popup
  assert.match(appJs, /title:\s*['"]Product Already Exists['"]/);
  assert.match(appJs, /subtitle:\s*['"]Duplicate Stock Product['"]/);
  assert.match(appJs, /A stock product named "\$\{name\}" already exists in stock\./);
});

test('Stock Duplicate: storageService.saveStockItem guards against duplicate creation', () => {
  assert.match(appJs, /if \(!syncId\) \{[\s\S]*?const normalizedName = clean\.name\.toLowerCase\(\);/);
  assert.match(appJs, /Product "\$\{clean\.name\}" already exists in stock\./);
});

test('Stock Duplicate: Backend stockController returns 409 Conflict for duplicate items', () => {
  assert.match(stockControllerJs, /SELECT id, name FROM stock_items WHERE LOWER\(TRIM\(name\)\) = LOWER\(TRIM\(\$1\)\)/);
  assert.match(stockControllerJs, /res\.status\(409\)\.json\(\{[\s\S]*?error:[\s\S]*?already exists/);
});
