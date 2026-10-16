import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('group items are nested beneath their parent across client ledger, jobs and order detail views', () => {
  assert.match(app, /const groupedRows = normalizeFileBreakdown\(item\.fileBreakdown\)/);
  assert.match(app, /border-l-2 border-sky-200 pl-2\.5/);
  assert.match(app, /\$\{itemIndex \+ 1\}\. \$\{item\.productName/);
  assert.match(app, /\$\{row\.quantity\} \$\{item\.unit \|\| 'pcs'\}/);
  assert.match(app, /Group Items \(\$\{normalizeFileBreakdown\(it\.fileBreakdown\)\.length\}\)/);
  assert.match(app, /normalizeFileBreakdown\(item\.fileBreakdown\)\.map\(\(row, rowIndex\)/);
  assert.match(app, /const hasGroupedItems = jobItems\.some/);
  assert.match(app, /groupedSubItems\.map\(\(row, rowIndex\)/);
});

test('Workflow uses a floating portal and reports activity in a separate card below', () => {
  assert.match(app, /workflowDropdownOpen/);
  assert.match(app, /h\(FloatingPortal, \{ open: workflowDropdownOpen, menuRef: workflowMenuRef/);
  assert.match(app, /role: "menu"/);
  assert.match(app, /workflowMenuPosition/);
  assert.match(app, /Design Print & Download Activity/);
  assert.match(app, /operatorStats/);
  assert.match(app, /\$\{operator\.count\} time/);
});

test('team filter uses All Team wording', () => {
  assert.match(app, /All Team \(\$\{team\.length\}\)/);
  assert.doesNotMatch(app, /All Staff \(\$\{team\.length\}\)/);
});
