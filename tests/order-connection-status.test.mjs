import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

// Runs the real connectionMonitor code from dist/app.js with a fake network.
function loadMonitor({ onLine = true, fetchImpl }) {
  const start = app.indexOf('  // Connection status for the Print Ghar server.');
  const end = app.indexOf('\n  };\n', start);
  assert.ok(start > -1 && end > start, 'connectionMonitor block found');
  const ctx = { navigator: { onLine }, fetch: fetchImpl, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(app.slice(start, end + 5) + '\nthis.connectionMonitor = connectionMonitor; this.SYSTEM_OFFLINE_MESSAGE = SYSTEM_OFFLINE_MESSAGE;', ctx);
  return ctx;
}
const healthy = async () => ({ ok: true, json: async () => ({ status: 'ok', db: 'connected' }) });

test('reachable when the backend health check reports the server and database are up', async () => {
  const calls = [];
  const { connectionMonitor } = loadMonitor({ fetchImpl: async (url, opts) => { calls.push([url, opts.cache]); return healthy(); } });
  assert.equal(await connectionMonitor.check(), true);
  assert.deepEqual(calls, [['/health', 'no-store']]);
});

test('unreachable when the device has no network', async () => {
  const { connectionMonitor } = loadMonitor({ onLine: false, fetchImpl: healthy });
  assert.equal(await connectionMonitor.check(), false);
});

test('unreachable when the internet works but the backend is down or unhealthy', async () => {
  for (const fetchImpl of [
    async () => { throw new TypeError('Failed to fetch'); },
    async () => ({ ok: false, status: 503, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => ({ status: 'ok', db: 'connecting_or_error' }) }),
  ]) {
    const { connectionMonitor } = loadMonitor({ fetchImpl });
    assert.equal(await connectionMonitor.check(), false);
  }
});

test('a hanging backend counts as unreachable after the timeout', async () => {
  const { connectionMonitor } = loadMonitor({
    fetchImpl: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
  });
  assert.equal(await connectionMonitor.check(), false);
});

test('listeners are told only about changes, so the popup is not reopened every check', async () => {
  let up = false;
  const { connectionMonitor } = loadMonitor({ fetchImpl: async () => (up ? healthy() : Promise.reject(new TypeError('down'))) });
  const seen = [];
  connectionMonitor.subscribe((v) => seen.push(v));
  for (let i = 0; i < 4; i++) await connectionMonitor.check(); // still offline: one notification
  up = true;
  for (let i = 0; i < 3; i++) await connectionMonitor.check(); // back online: one notification
  assert.deepEqual(seen, [false, true]);
});

test('the popup message is exactly as specified', () => {
  const { SYSTEM_OFFLINE_MESSAGE } = loadMonitor({ fetchImpl: healthy });
  assert.equal(SYSTEM_OFFLINE_MESSAGE, 'System is completely offline. Please check your internet connection or contact the administrator.');
});

test('the popup opens on an outage, cannot be dismissed, and closes itself on recovery', () => {
  assert.match(app, /connectionMonitor\.subscribe\(isOnline => setSystemOfflinePopup\(!isOnline\)\)/);
  assert.match(app, /systemOfflinePopup && h\("div", \{ key: "system-offline", className: "fixed inset-0 [^"]*backdrop-blur-md"/, 'the app behind the popup is blurred');
  assert.match(app, /role: "dialog", "aria-modal": "true", "aria-labelledby": "system-offline-title"/);
  // Only the connection monitor changes it: no Close button, no other place sets it.
  assert.equal((app.match(/setSystemOfflinePopup\(/g) || []).length, 1);
  const popupStart = app.indexOf('systemOfflinePopup && h("div", { key: "system-offline"');
  const popupMarkup = app.slice(popupStart, app.indexOf('appAlert && h("div"', popupStart));
  assert.equal(/h\("button"/.test(popupMarkup), false, 'no buttons in the popup');
  assert.match(popupMarkup, /Reconnecting automatically\. This message will close once the connection is restored\./);
  assert.match(app, /window\.addEventListener\('online', \(\) => this\.check\(\)\);/);
  assert.match(app, /setTimeout\(\(\) => this\.check\(\)\.finally\(loop\), this\.online \? 20000 : 5000\)/);
});

test('the previous offline banner and order restrictions are gone', () => {
  for (const removed of ["You're Offline", 'Back Online', 'connectionState', 'OFFLINE_ORDER_MESSAGE', 'checkBackendConnection',
    'TEMP_ORDER_NUMBER_PREFIX', 'createTemporaryOrderNumber', 'printflow_pending_orders_v1', 'retryPendingOrders']) {
    assert.equal(app.includes(removed), false, `${removed} should be gone`);
  }
  assert.match(app, /h\("button", \{ type: "submit", disabled: isSavingOrder, className:/);
  // openNewOrder is back to its original first check (the role restriction only).
  assert.match(app, /const openNewOrder = \(customerId = ''\) => \{\n\s+if \(isProductionOrDesignRole\) \{/);
});

test('order creation itself is unchanged: server-first, nothing stored locally on failure', () => {
  const start = app.indexOf('    async createOrder(data) {');
  const body = app.slice(start, app.indexOf('\n    },\n', start));
  assert.ok(start > -1);
  assert.match(body, /fetch\('\/api\/orders', \{\s*method: 'POST'/);
  assert.equal(body.includes('localStorage'), false);
  assert.ok(body.indexOf("fetch('/api/orders'") < body.indexOf('this.saveOrder(this.normalizeOrder(body), { localOnly: true })'));
});
