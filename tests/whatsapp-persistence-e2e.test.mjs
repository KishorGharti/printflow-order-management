import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appJs = fs.readFileSync('dist/app.js', 'utf8');
const settingsControllerJs = fs.readFileSync('backend/src/controllers/settingsController.js', 'utf8');

test('WhatsApp Settings: PostgreSQL is the authoritative source of truth and localStorage is only a cache', () => {
  // loadSettingsFromServer must fetch from /api/settings and NOT do a blind legacy PUT that overwrites PostgreSQL
  assert.match(appJs, /async\s+loadSettingsFromServer\s*\(\)\s*\{/);
  assert.doesNotMatch(appJs, /const bulkRes = await fetch\('\/api\/settings', \{\s*method: 'PUT'/);

  // loadSettingsFromServer must cache the fetched server settings in localStorage
  assert.match(appJs, /localStorage\.setItem\(STORAGE_KEYS\.SETTINGS,\s*JSON\.stringify\(this\._settingsCache\)\)/);

  // saveSettings must save to /api/settings via PUT and cache in localStorage
  assert.match(appJs, /saveSettings\(st\)\s*\{[\s\S]*?localStorage\.setItem\(STORAGE_KEYS\.SETTINGS,\s*JSON\.stringify\(merged\)\)[\s\S]*?fetch\('\/api\/settings',\s*\{\s*method:\s*'PUT'/);
});

test('WhatsApp Settings: WhatsApp form renders with dynamic key and persists all fields to storageService', () => {
  // Key ensures form re-mounts with fresh PostgreSQL values on load/refresh
  assert.match(appJs, /key:\s*`whatsapp-settings-\$\{settings\.whatsappSenderNumber/);

  // Form saves notificationsEnabled, senderNumber, and whatsappTemplate
  assert.match(appJs, /whatsappNotificationsEnabled:\s*f\.notificationsEnabled\.checked/);
  assert.match(appJs, /whatsappSenderNumber:\s*f\.senderNumber\.value/);
  assert.match(appJs, /whatsappTemplate:\s*f\.whatsappTemplate\.value\.trim\(\)/);
});

test('WhatsApp Settings: Multi-tenant business_id isolation is supported in settingsController', () => {
  // getBusinessKey resolves the tenant from the authenticated user, never from raw request headers/query
  assert.match(settingsControllerJs, /function\s+getBusinessKey\s*\(req\)\s*\{\s*return\s+getTenantBusinessId\(req\);/);
  assert.doesNotMatch(settingsControllerJs, /req\.headers\??\.?\[['"]x-business-id['"]\]/);
  assert.doesNotMatch(settingsControllerJs, /req\.query\??\.business_id/);

  // getSettings and updateSettings use the isolated business key
  assert.match(settingsControllerJs, /const\s+key\s*=\s*getBusinessKey\(req\);[\s\S]*?SELECT \* FROM settings WHERE key = \$1/);
  assert.match(settingsControllerJs, /UPDATE settings SET \$\{setClause\} WHERE key = \$\$\{nextIdx\} RETURNING \*/);
});
