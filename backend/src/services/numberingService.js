'use strict';

/**
 * Server-side job and invoice number allocation.
 *
 * Numbers are per business and sequential. The next number is 1 + the highest of:
 *   - the business's counter row in number_counters,
 *   - the configured starting number - 1 (from settings),
 *   - the highest number already used by that business's orders (keeps existing data compatible).
 *
 * The counter row is locked with SELECT ... FOR UPDATE inside the caller's transaction, so
 * concurrent requests for the same business are serialized. If the transaction rolls back,
 * the counter update rolls back with it and no number is skipped.
 */

const KINDS = {
  job: { column: 'order_number' },
  invoice: { column: 'invoice_number' },
};

const COUNTERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS number_counters (
    business_id TEXT        NOT NULL,
    kind        TEXT        NOT NULL CHECK (kind IN ('job', 'invoice')),
    last_value  BIGINT      NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (business_id, kind)
  );
`;

function numberingFormat(settingsRow, kind) {
  const s = settingsRow || {};
  if (kind === 'job') {
    return {
      prefix: String(s.job_prefix || 'JOB-').trim() || 'JOB-',
      start: Math.max(1, parseInt(s.job_start_number, 10) || 1042),
    };
  }
  // Invoices are pure numbers; the legacy 'INV-' default is treated as no prefix, as the app does.
  const rawPrefix = s.invoice_prefix === 'INV-' ? '' : s.invoice_prefix;
  return {
    prefix: String(rawPrefix ?? '').trim(),
    start: Math.max(1, parseInt(s.invoice_start_number, 10) || 1),
  };
}

/**
 * Locks the business's counter row for `kind` until the transaction ends, creating it if needed.
 * Anything that writes job / invoice numbers for the business should hold this lock.
 * Returns the counter's current last_value.
 */
async function lockCounter(client, businessId, kind) {
  if (!KINDS[kind]) throw new Error(`Unknown number kind: ${kind}`);
  if (!businessId) throw new Error('A business is required to allocate a number.');
  await client.query(
    `INSERT INTO number_counters (business_id, kind, last_value) VALUES ($1, $2, 0)
     ON CONFLICT (business_id, kind) DO NOTHING`,
    [businessId, kind]
  );
  const counterRes = await client.query(
    'SELECT last_value FROM number_counters WHERE business_id = $1 AND kind = $2 FOR UPDATE',
    [businessId, kind]
  );
  return Number(counterRes.rows[0]?.last_value || 0);
}

/**
 * Allocates the next number of `kind` for `businessId`.
 * `client` must be a pg client with an open transaction (BEGIN already issued).
 */
async function allocateNumber(client, businessId, kind) {
  const spec = KINDS[kind];
  const lastValue = await lockCounter(client, businessId, kind);
  const [settingsRes, maxRes] = await Promise.all([
    client.query(
      'SELECT job_prefix, job_start_number, invoice_prefix, invoice_start_number FROM settings WHERE key = $1 OR business_id = $1 LIMIT 1',
      [businessId]
    ),
    client.query(
      `SELECT COALESCE(MAX(substring(${spec.column} from '([0-9]{1,15})$')::bigint), 0) AS max_used
       FROM orders WHERE business_id = $1`,
      [businessId]
    ),
  ]);

  const { prefix, start } = numberingFormat(settingsRes.rows[0], kind);
  const next = Math.max(
    lastValue,
    start - 1,
    Number(maxRes.rows[0]?.max_used || 0)
  ) + 1;

  await client.query(
    'UPDATE number_counters SET last_value = $3, updated_at = NOW() WHERE business_id = $1 AND kind = $2',
    [businessId, kind, next]
  );
  return { value: next, formatted: `${prefix}${next}` };
}

module.exports = { allocateNumber, lockCounter, numberingFormat, COUNTERS_TABLE_SQL };
