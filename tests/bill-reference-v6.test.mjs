import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('Current bill geometry keeps Description narrower and Qty/Rate wider with left alignment', () => {
  assert.match(app, /doc\.splitTextToSize\(part,\s*Math\.max\(8,\s*cols\.descRight\s*-\s*cols\.snRight\s*-\s*3\.1\)\)/);
  assert.match(app, /doc\.text\(oneLine\(qtyText,\s*18\.2\),\s*75\.8,\s*centerBase,\s*\{\s*align:\s*'left'\s*\}\)/);
  assert.match(app, /doc\.text\(oneLine\(money\(item\.unitPrice\s*\|\|\s*0\),\s*16\.8\),\s*96\.6,\s*centerBase,\s*\{\s*align:\s*'left'\s*\}\)/);
});

test('Company design supports fit-inside, fit-to-placeholder and manual modes', () => {
  assert.match(app, /companyFit: 'fit'/);
  assert.match(app, /Fit Inside/);
  assert.match(app, /Fit to Placeholder/);
  assert.match(app, /doc\.getImageProperties\(designData\)/);
  assert.match(app, /fitMode\s*===\s*'fill'/);
});

test('WhatsApp status launch preserves the current Print Ghar page', () => {
  assert.equal(app.includes('window.location.href = appUrl'), false);
  assert.match(app, /Manual mode: NEVER navigate the Print Ghar tab during a status transition/);
  assert.match(app, /a\.target\s*=\s*'_blank'/);
});
