import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Hermetic: pool.query is replaced by a small in-memory fake, so no database is touched.
const { pool } = require('../backend/src/config/db');
const settingsController = require('../backend/src/controllers/settingsController.js');
const developerController = require('../backend/src/controllers/developerController.js');

const BIZ = 'biz-lock-test';
const CLIENT_ID = '88888888-8888-4888-8888-888888888888';
const UNLINKED_ID = '99999999-9999-4999-8999-999999999999';
let state;

beforeEach(() => {
  state = {
    settings: { id: 's1', key: BIZ, business_id: BIZ, shop_name: 'Lock Test Shop', job_prefix: 'JOB-', job_start_number: 1042, invoice_start_number: 1 },
    dev: {},
    updates: 0,
  };
});

pool.query = async (sql, params = []) => {
  if (sql.startsWith('INSERT INTO settings')) return { rows: [state.settings] };
  if (sql.includes('SELECT job_prefix, job_start_number FROM settings')) return { rows: [state.settings] };
  if (sql.includes('FROM developer_settings WHERE business_id = $1 AND key = $2')) {
    const v = state.dev[`${params[0]}|${params[1]}`];
    return { rows: v ? [{ value: v }] : [] };
  }
  if (sql.includes('INSERT INTO developer_settings')) {
    state.dev[`${params[0]}|${params[1]}`] = JSON.parse(params[2]);
    return { rows: [] };
  }
  if (sql.includes("FROM developer_settings WHERE key IN ('job_numbering', 'invoice_numbering')")) {
    return { rows: Object.entries(state.dev).map(([k, value]) => ({ business_id: k.split('|')[0], key: k.split('|')[1], value })) };
  }
  // Developer client list (getClients)
  if (sql.includes('SELECT COUNT(*)::int AS total FROM saas_clients c')) return { rows: [{ total: 1 }] };
  if (sql.includes('FROM saas_clients c')) return { rows: [{ id: CLIENT_ID, name: 'Lock Test Owner', email: 'lock@example.test', status: 'active', business_id: BIZ, created_at: new Date() }] };
  if (sql.includes('FROM settings WHERE key = ANY')) return { rows: params[0].includes(BIZ) ? [state.settings] : [] };
  if (sql.includes('FROM orders WHERE business_id = ANY')) return { rows: [{ business_id: BIZ, job_used: 1050, invoice_used: 12 }] };
  if (sql.includes('FROM number_counters WHERE business_id = ANY')) return { rows: [] };
  if (sql.startsWith('UPDATE settings SET')) {
    state.updates++;
    const setPart = sql.slice('UPDATE settings SET '.length, sql.indexOf(' WHERE '));
    for (const [, col, idx] of setPart.matchAll(/(\w+) = \$(\d+)/g)) state.settings[col] = params[Number(idx) - 1];
    return { rows: [{ ...state.settings }] };
  }
  if (sql.includes('FROM settings WHERE key = $1')) return { rows: [state.settings] };
  if (sql.includes('FROM saas_clients WHERE id = $1')) {
    if (params[0] === CLIENT_ID) return { rows: [{ id: CLIENT_ID, name: 'Lock Test Owner', email: 'lock@example.test', business_id: BIZ }] };
    if (params[0] === UNLINKED_ID) return { rows: [{ id: UNLINKED_ID, name: 'Unlinked', email: 'unlinked@example.test', business_id: 'global_settings' }] };
    return { rows: [] };
  }
  if (sql.includes("FROM businesses WHERE business_id = 'global_settings'")) return { rows: [{ email: 'main@example.test' }] };
  return { rows: [] };
};
after(async () => { await pool.end(); });

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const ownerReq = (body) => ({ user: { id: 'u1', role: 'owner', businessId: BIZ, isActive: true }, headers: {}, query: {}, params: {}, body });
async function save(body) {
  const res = mockRes();
  await settingsController.updateSettings(ownerReq(body), res, (err) => { throw err; });
  return res;
}
const locked = () => state.dev[`${BIZ}|job_numbering`]?.locked === true;
const invoiceLocked = () => state.dev[`${BIZ}|invoice_numbering`]?.locked === true;
const devReq = (id = CLIENT_ID) => ({ params: { id }, headers: {}, body: {}, query: {}, user: { name: 'Dev', role: 'developer' } });

test('first save from the numbering form sets the values and locks them', async () => {
  const res = await save({ jobPrefix: 'PG-', jobStartNumber: 500, lockJobNumbering: true });
  assert.equal(res.statusCode, 200);
  assert.equal(state.settings.job_prefix, 'PG-');
  assert.equal(Number(state.settings.job_start_number), 500);
  assert.equal(locked(), true);
  assert.equal(res.body.jobNumberingLocked, true);
});

test('saving numbering once with unchanged default values still locks', async () => {
  await save({ jobPrefix: 'JOB-', jobStartNumber: 1042, lockJobNumbering: true });
  assert.equal(locked(), true);
});

test('once locked, changing the job prefix or starting number is refused and nothing is written', async () => {
  await save({ jobPrefix: 'PG-', jobStartNumber: 500, lockJobNumbering: true });
  const writesBefore = state.updates;
  for (const body of [{ jobPrefix: 'NEW-' }, { jobStartNumber: 9000 }, { jobPrefix: 'NEW-', jobStartNumber: 9000, lockJobNumbering: true }]) {
    const res = await save(body);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'JOB_NUMBERING_LOCKED');
  }
  assert.equal(state.updates, writesBefore);
  assert.equal(state.settings.job_prefix, 'PG-');
});

test('once locked, other settings and the invoice starting number still save', async () => {
  await save({ jobPrefix: 'PG-', jobStartNumber: 500, lockJobNumbering: true });
  const res = await save({ shopName: 'Renamed Shop', jobPrefix: 'PG-', jobStartNumber: 500, invoiceStartNumber: 25 });
  assert.equal(res.statusCode, 200);
  assert.equal(state.settings.shop_name, 'Renamed Shop');
  assert.equal(Number(state.settings.invoice_start_number), 25);
});

test('an ordinary settings save with unchanged job values does not lock', async () => {
  const res = await save({ shopName: 'Another Name', jobPrefix: 'JOB-', jobStartNumber: 1042 });
  assert.equal(res.statusCode, 200);
  assert.equal(locked(), false);
});

test('the bulk settings endpoint follows the same rule', async () => {
  await save({ jobPrefix: 'PG-', lockJobNumbering: true });
  const res = mockRes();
  await settingsController.bulkUpsert(ownerReq({ settings: { jobPrefix: 'BULK-' } }), res, (err) => { throw err; });
  assert.equal(res.statusCode, 403);
  assert.equal(state.settings.job_prefix, 'PG-');
});

test('GET settings reports the lock state; shops cannot set the lock field themselves', async () => {
  let res = mockRes();
  await settingsController.getSettings(ownerReq({}), res, (err) => { throw err; });
  assert.equal(res.body.jobNumberingLocked, false);
  await save({ jobNumberingLocked: false, jobPrefix: 'PG-', lockJobNumbering: true });
  res = mockRes();
  await settingsController.getSettings(ownerReq({}), res, (err) => { throw err; });
  assert.equal(res.body.jobNumberingLocked, true);
});

test('developer unlock allows exactly one more change, then it locks again', async () => {
  await save({ jobPrefix: 'PG-', jobStartNumber: 500, lockJobNumbering: true });
  const res = mockRes();
  await developerController.unlockClientJobNumbering({ params: { id: CLIENT_ID }, headers: {}, body: {}, user: { name: 'Dev', role: 'developer' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.businessId, BIZ);
  assert.equal(locked(), false);

  assert.equal((await save({ jobPrefix: 'SHOP-', jobStartNumber: 2000, lockJobNumbering: true })).statusCode, 200);
  assert.equal(state.settings.job_prefix, 'SHOP-');
  assert.equal(locked(), true);
  assert.equal((await save({ jobPrefix: 'AGAIN-' })).statusCode, 403);
});

test('unlock rejects invalid, unknown and unlinked clients', async () => {
  for (const [id, code] of [['not-a-uuid', 400], ['77777777-7777-4777-8777-777777777777', 404], [UNLINKED_ID, 400]]) {
    const res = mockRes();
    await developerController.unlockClientJobNumbering({ params: { id }, headers: {}, body: {}, user: { role: 'developer' } }, res);
    assert.equal(res.statusCode, code, id);
  }
});

test('unlock route is developer-only', () => {
  const routes = fs.readFileSync(new URL('../backend/src/routes/developer.js', import.meta.url), 'utf8');
  const guard = routes.indexOf('router.use(requireDeveloperAccess)');
  const route = routes.indexOf("router.post('/clients/:id/unlock-job-numbering'");
  assert.ok(guard > -1 && route > guard);
});

test('frontend: both numbering forms lock their job fields and request the lock on save', () => {
  const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert.equal((app.match(/lockJobNumbering: true/g) || []).length >= 2, true);
  assert.equal((app.match(/readOnly: Boolean\((fresh|settings)\.jobNumberingLocked\)/g) || []).length, 4);
  assert.match(app, /const \{ lockJobNumbering, lockInvoiceNumbering, \.\.\.settingsInput \} = st \|\| \{\};/);
  assert.match(app, /err\.code === 'JOB_NUMBERING_LOCKED'/);
  const dev = fs.readFileSync(new URL('../dist/developer.js', import.meta.url), 'utf8');
  assert.match(dev, /'\/api\/developer\/clients\/' \+ client\.id \+ '\/unlock-job-numbering'/);
  assert.match(dev, /c\.job_numbering_locked && h\('button'/);
});

// ---- Invoice starting number: its own one-time lock, same rules ----

test('first save from the numbering form locks the invoice starting number too', async () => {
  const res = await save({ jobPrefix: 'JOB-', jobStartNumber: 1042, invoiceStartNumber: 100, lockJobNumbering: true, lockInvoiceNumbering: true });
  assert.equal(res.statusCode, 200);
  assert.equal(Number(state.settings.invoice_start_number), 100);
  assert.equal(invoiceLocked(), true);
  assert.equal(res.body.invoiceNumberingLocked, true);
});

test('once locked, changing the invoice starting number is refused and nothing is written', async () => {
  await save({ invoiceStartNumber: 100, lockInvoiceNumbering: true });
  const writesBefore = state.updates;
  for (const body of [{ invoiceStartNumber: 1 }, { invoiceStartNumber: 5000, lockInvoiceNumbering: true }, { shopName: 'X', invoiceStartNumber: 7 }]) {
    const res = await save(body);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'INVOICE_NUMBERING_LOCKED');
  }
  assert.equal(state.updates, writesBefore);
  assert.equal(Number(state.settings.invoice_start_number), 100);
  // Saving the same value back (the locked field is read-only on screen) and other settings still work.
  const ok = await save({ shopName: 'Still Saves', invoiceStartNumber: 100 });
  assert.equal(ok.statusCode, 200);
  assert.equal(state.settings.shop_name, 'Still Saves');
});

test('a first real change of the invoice start number locks it even without the form flag', async () => {
  const res = await save({ invoiceStartNumber: 40 });
  assert.equal(res.statusCode, 200);
  assert.equal(invoiceLocked(), true);
  assert.equal(locked(), false, 'the job lock is separate');
  assert.equal((await save({ invoiceStartNumber: 41 })).statusCode, 403);
  const bulk = mockRes();
  await settingsController.bulkUpsert(ownerReq({ settings: { invoiceStartNumber: 99 } }), bulk, (err) => { throw err; });
  assert.equal(bulk.statusCode, 403, 'bulk endpoint follows the same rule');
});

test('job and invoice locks are separate; developer unlock of each allows one more change', async () => {
  await save({ jobPrefix: 'PG-', jobStartNumber: 500, invoiceStartNumber: 100, lockJobNumbering: true, lockInvoiceNumbering: true });

  let res = mockRes();
  await developerController.unlockClientJobNumbering(devReq(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(locked(), false);
  assert.equal(invoiceLocked(), true, 'unlocking job numbering does not unlock invoices');
  assert.equal((await save({ invoiceStartNumber: 200 })).statusCode, 403);

  res = mockRes();
  await developerController.unlockClientInvoiceNumbering(devReq(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.invoiceNumberingLocked, false);
  assert.match(res.body.message, /invoice starting number one more time/);
  assert.equal(invoiceLocked(), false);
  assert.equal((await save({ invoiceStartNumber: 200, lockInvoiceNumbering: true })).statusCode, 200);
  assert.equal(Number(state.settings.invoice_start_number), 200);
  assert.equal(invoiceLocked(), true, 'locks again after that one change');
  assert.equal((await save({ invoiceStartNumber: 300 })).statusCode, 403);

  for (const [id, code] of [['not-a-uuid', 400], ['77777777-7777-4777-8777-777777777777', 404], [UNLINKED_ID, 400]]) {
    const bad = mockRes();
    await developerController.unlockClientInvoiceNumbering(devReq(id), bad);
    assert.equal(bad.statusCode, code, id);
  }
});

test('GET settings reports both lock states', async () => {
  await save({ invoiceStartNumber: 10, lockInvoiceNumbering: true });
  const res = mockRes();
  await settingsController.getSettings(ownerReq({}), res, (err) => { throw err; });
  assert.equal(res.body.invoiceNumberingLocked, true);
  assert.equal(res.body.jobNumberingLocked, false);
});

test('developer client list shows where job and invoice numbers start, the next numbers, and both locks', async () => {
  await save({ jobPrefix: 'PG-', jobStartNumber: 1000, invoiceStartNumber: 5, lockJobNumbering: true, lockInvoiceNumbering: true });
  const res = mockRes();
  await developerController.getClients({ query: {}, headers: {}, params: {}, user: { role: 'developer' } }, res);
  assert.equal(res.statusCode, 200);
  const c = res.body.clients[0];
  assert.equal(c.job_numbering_locked, true);
  assert.equal(c.invoice_numbering_locked, true);
  assert.deepEqual(c.numbering, { jobPrefix: 'PG-', jobStartNumber: 1000, invoiceStartNumber: 5, nextJobNumber: 'PG-1051', nextInvoiceNumber: '13' });
});

test('invoice unlock route is developer-only; frontend locks the invoice field in both forms', () => {
  const routes = fs.readFileSync(new URL('../backend/src/routes/developer.js', import.meta.url), 'utf8');
  const guard = routes.indexOf('router.use(requireDeveloperAccess)');
  assert.ok(guard > -1 && routes.indexOf("router.post('/clients/:id/unlock-invoice-numbering'") > guard);
  const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert.equal((app.match(/lockInvoiceNumbering: true/g) || []).length >= 2, true);
  assert.equal((app.match(/readOnly: Boolean\((fresh|settings)\.invoiceNumberingLocked\)/g) || []).length, 2);
  assert.match(app, /err\.code === 'INVOICE_NUMBERING_LOCKED'/);
  const dev = fs.readFileSync(new URL('../dist/developer.js', import.meta.url), 'utf8');
  assert.match(dev, /'\/api\/developer\/clients\/' \+ client\.id \+ '\/unlock-invoice-numbering'/);
  assert.match(dev, /c\.invoice_numbering_locked && h\('button'/);
  assert.match(dev, /h\('th', \{ className: 'px-4 py-3' \}, 'Numbering'\)/);
});
