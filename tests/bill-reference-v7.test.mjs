import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('V7 Qty includes unit and Qty/Rate rows are left aligned with revised geometry', () => {
  assert.match(app, /`\$\{item\.quantity\s*\|\|\s*0\} \$\{item\.unit\s*\|\|\s*'pcs'\}`/);
  assert.match(app, /,\s*75\.8,\s*centerBase,\s*\{\s*align:\s*'left'\s*\}\)/);
  assert.match(app, /,\s*96\.6,\s*centerBase,\s*\{\s*align:\s*'left'\s*\}\)/);
  assert.match(app, /doc\.text\(metric\.lines,\s*26\.23,\s*descBase/);
});

test('V7 exposes table row text size control', () => {
  assert.match(app, /tableTextSize: 8\.5/);
  assert.match(app, /Table row text size/);
  assert.match(app, /Math\.max\(6,\s*Math\.min\(12,\s*Number\(config\.tableTextSize\)\s*\|\|\s*8\.5\)\)/);
});

test('V7 company design offers fit to placeholder and defaults to fit inside', () => {
  assert.match(app, /companyFit: 'fit'/);
  assert.match(app, /Fit to Placeholder/);
  assert.match(app, /doc\.getImageProperties\(designData\)/);
  assert.match(app, /fitMode\s*===\s*'fill'/);
});

test('V7 status WhatsApp flow never navigates or embeds external protocol in app page', () => {
  assert.match(app, /https:\/\/wa\.me\/\$\{cleanPhone\}\?text=/);
  assert.match(app, /Status changed successfully; WhatsApp notification was skipped/);
  assert.equal(app.includes("frame.src = appUrl"), false);
  assert.equal(app.includes("window.location.href = `whatsapp://send"), false);
});
