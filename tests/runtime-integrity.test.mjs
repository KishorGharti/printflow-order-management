import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('runtime bundle has a React error boundary instead of a white-screen failure', () => {
  assert.match(app, /class AppErrorBoundary extends React\.Component/);
  assert.match(app, /root\.render\(h\(AppErrorBoundary, null, h\(PrintApp\)\)\)/);
  assert.match(app, /Print Ghar recovered from an error/);
});

test('storageService has only one getOrderCreditAmount implementation', () => {
  const matches = app.match(/\n    getOrderCreditAmount\(order\) \{/g) || [];
  assert.equal(matches.length, 1);
});

test('print preview methods do not contain unreachable legacy HTML after returning', () => {
  const billing = app.slice(app.indexOf('    printBillingInvoice(order) {'), app.indexOf('    printDeliveryChalan(order) {'));
  assert.equal(billing.includes('return result;\n      const '), false);
  assert.ok(billing.length < 1000);
});

test('build validates the actual runtime bundle and test script includes every test file', () => {
  assert.equal(pkg.scripts.build, 'node --check dist/app.js && node --check server.js');
  assert.equal(pkg.scripts.test, 'node --test tests/*.mjs');
});

test('invoice prefix is used by the runtime invoice generator', () => {
  assert.match(app, /const prefix = String\(numberingSettings\.invoicePrefix \?\? 'INV-'\)\.trim\(\)/);
  assert.match(app, /return `\$\{prefix\}\$\{maxNum \+ 1\}`/);
});

test('workflow dropdown keeps Mistake as a separate explicit action', () => {
  assert.match(app, /Collapsible Workflow dropdown/);
  assert.match(app, /moveTo\('Mistake','Mistake'\)/);
});

test('hexToRgb helper is declared for PDF engine color parsing', () => {
  assert.match(app, /const hexToRgb = \(value, fallback/);
  assert.match(app, /const accent = hexToRgb\(design\.accentColor, PRINT_GHAR_PDF_THEME\.indigo\);/);
});

test('Delivery Assignment includes By Transport option and handler', () => {
  assert.match(app, /"By Transport"/);
  assert.match(app, /finishDeliveryWithTransport/);
  assert.match(app, /deliveryType:\s*'transport'/);
});

test('pagination reset hooks are declared after state variables to prevent TDZ reference errors', () => {
  const searchQueryIdx = app.indexOf("const [searchQuery, setSearchQuery] = useState('')");
  const paginationHooksIdx = app.indexOf("// Reset pagination to page 1 whenever filters/search queries change");
  assert.ok(searchQueryIdx > 0, 'searchQuery state should be declared');
  assert.ok(paginationHooksIdx > 0, 'pagination reset hooks should be declared');
  assert.ok(paginationHooksIdx > searchQueryIdx, 'pagination reset hooks must be declared after searchQuery to prevent TDZ reference errors');
});

test('SearchableSelect does not invoke disruptive scrollIntoView on ancestor elements and contains internal scroll', () => {
  assert.equal(app.includes('scrollIntoView'), false, 'SearchableSelect must never invoke Element.scrollIntoView to avoid erratic ancestor/modal scrolling');
  assert.match(app, /overscroll-contain/, 'SearchableSelect listbox must have overscroll-contain to prevent scroll chaining to modal');
  assert.match(app, /isKeyboardNav\.current/, 'SearchableSelect must restrict internal scrolling strictly to keyboard navigation');
});



