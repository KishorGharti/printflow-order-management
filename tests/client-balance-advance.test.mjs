import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('Client Statement PDF styles negative running balance as green Adv instead of red debt', () => {
  assert.match(app, /const rowBal = Number\(entry\.runningBalance \|\| 0\);/);
  assert.match(app, /const rowBalColor = rowBal > 0 \? \[220, 38, 38\] : rowBal < 0 \? \[0, 150, 70\] : \[100, 116, 139\];/);
  assert.match(app, /const rowBalText = rowBal > 0 \? `\$\{money\(rowBal\)\} Due` : rowBal < 0 \? `\$\{money\(Math\.abs\(rowBal\)\)\} Adv` : `\$\{money\(0\)\} Settled`;/);
  assert.match(app, /rightText\(rowBalText, 10, rowBalColor\);/);
});

test('Client Ledger UI table formats positive as Due (red) and negative as Adv (green)', () => {
  assert.match(app, /text: `\$\{storageService\.formatCurrency\(num\)\} Due`/);
  assert.match(app, /className: 'text-rose-600 font-bold'/);
  assert.match(app, /text: `\$\{storageService\.formatCurrency\(Math\.abs\(num\)\)\} Adv`/);
  assert.match(app, /className: 'text-emerald-600 font-bold'/);
});

test('Client CSV export labels running balance as Due or Adv', () => {
  assert.match(app, /entry\.runningBalance > 0 \? `\$\{entry\.runningBalance\} Due` : entry\.runningBalance < 0 \? `\$\{Math\.abs\(entry\.runningBalance\)\} Adv` : 0/);
});

test('Custom Price Override modal has stable height and does not collapse with single product', () => {
  assert.match(app, /flex h-\[650px\] max-h-\[88vh\] min-h-\[480px\] w-full max-w-4xl flex-col overflow-hidden rounded-2xl/);
  assert.match(app, /fixed inset-0 z-\[140\] flex items-center justify-center bg-slate-950\/60/);
  assert.match(app, /flex h-\[560px\] max-h-\[85vh\] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl/);
});

test('adding a client override product keeps its current price and waits for explicit Edit', () => {
  assert.match(app, /const currentProductPrice = Number\(product\.defaultPrice \|\| 0\)/);
  assert.match(app, /setCustomerPrice\(selectedCustomer\.id, product\.id, currentProductPrice\)/);
  assert.match(app, /setEditingPriceProductId\(''\)/);
  assert.match(app, /Click Edit when you want to change it/);
  assert.match(app, /'\+ Add'/);
});
