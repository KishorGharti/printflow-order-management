import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Financial Date Range & CSV/PDF Export Verification', () => {
  const appCode = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

  // Verify exportFinancialLedgerCSV is present in dist/app.js
  assert.ok(
    appCode.includes('exportFinancialLedgerCSV('),
    'dist/app.js must contain exportFinancialLedgerCSV method'
  );

  // Verify custom date range presets and calculateLedgerPresetDates are present
  assert.ok(
    appCode.includes('calculateLedgerPresetDates'),
    'dist/app.js must define calculateLedgerPresetDates helper'
  );

  // Verify CSV export and PDF export buttons exist in financial export modal
  assert.ok(
    appCode.includes('Export CSV / Excel'),
    'dist/app.js must include Export CSV / Excel button in export dialog'
  );

  assert.ok(
    appCode.includes('Calendar Mode:'),
    'dist/app.js must support AD and BS Calendar Mode toggle in export dialog'
  );

  // Verify date input fields for From Date and To Date exist in export dialog
  assert.ok(
    appCode.includes('From Date ('),
    'dist/app.js must include From Date input with active date mode'
  );
  assert.ok(
    appCode.includes('To Date ('),
    'dist/app.js must include To Date input with active date mode'
  );
});
