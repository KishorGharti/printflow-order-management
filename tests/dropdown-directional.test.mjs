import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appJs = fs.readFileSync('dist/app.js', 'utf8');

test('calculateMenuPlacement exists and computes openUp and alignRight based on viewport boundaries', () => {
  assert.match(appJs, /const calculateMenuPlacement\s*=/);

  // Test the logic directly
  const calculateMenuPlacementFn = new Function(`
    return ${appJs.match(/const calculateMenuPlacement = \([\s\S]*?return \{ openUp, alignRight \};\s*\};/)[0].replace(/^const calculateMenuPlacement = /, '')}
  `)();

  // Mock element near bottom of viewport (e.g. y = 700 in an 800px window)
  const bottomEl = {
    getBoundingClientRect: () => ({
      top: 680,
      bottom: 720,
      left: 100,
      right: 300,
      width: 200,
      height: 40
    }),
    ownerDocument: {
      defaultView: {
        innerHeight: 800,
        innerWidth: 1200
      }
    }
  };

  const placementBottom = calculateMenuPlacementFn(bottomEl, 220, 180);
  assert.equal(placementBottom.openUp, true, 'Should open UP when near viewport bottom');
  assert.equal(placementBottom.alignRight, false, 'Should align left when plenty of space on right');

  // Mock element near top and right edge of viewport (e.g. right = 1180 in a 1200px window)
  const topEl = {
    getBoundingClientRect: () => ({
      top: 50,
      bottom: 90,
      left: 1050,
      right: 1180,
      width: 130,
      height: 40
    }),
    ownerDocument: {
      defaultView: {
        innerHeight: 800,
        innerWidth: 1200
      }
    }
  };

  const placementTop = calculateMenuPlacementFn(topEl, 220, 200);
  assert.equal(placementTop.openUp, false, 'Should open DOWN when plenty of space below');
  assert.equal(placementTop.alignRight, true, 'Should align RIGHT when near right boundary');
});

test('shared floating layer computes fixed viewport-clamped portal coordinates', () => {
  assert.match(appJs, /const UI_LAYERS = Object\.freeze/);
  assert.match(appJs, /const FLOATING_UI = Object\.freeze/);
  assert.match(appJs, /const getFloatingMenuPosition =/);
  assert.match(appJs, /const FloatingPortal =/);
  assert.match(appJs, /ReactDOM\.createPortal/);
  assert.match(appJs, /viewportWidth - width - padding/);
  assert.match(appJs, /placement: openUp \? 'top-start' : 'bottom-start'/);
});

test('action menus and dropdowns use the shared fixed placement contract', () => {
  // Team Action Menu
  assert.match(appJs, /setTeamActionMenuPlacement\(getFloatingMenuPosition\(e\.currentTarget/);
  assert.match(appJs, /teamActionMenuPlacement\.top/);

  // Order Print and More dropdowns
  assert.match(appJs, /setOrderPrintPlacement\(getFloatingMenuPosition\(e\.currentTarget/);
  assert.match(appJs, /open: orderPrintDropdownOpen/);
  assert.match(appJs, /setOrderMorePlacement\(getFloatingMenuPosition\(e\.currentTarget/);
  assert.match(appJs, /open: orderMoreDropdownOpen/);

  // Financial Ledger Action Menu
  assert.match(appJs, /setFinancialActionMenuPlacement\(getFloatingMenuPosition\(e\.currentTarget/);
  assert.match(appJs, /financialActionMenuPlacement\.top/);

  // Financial Party Summary Details dropdown
  assert.match(appJs, /financial-summary-dropdown/);
  assert.match(appJs, /menu\.classList\.add\('bottom-full', 'mb-2'\)/);
});

test('ActionStatusSelector and OrderItemsDropdown preserve their floating portal logic', () => {
  assert.match(appJs, /const ActionStatusSelector\s*=/);
  assert.match(appJs, /getFloatingMenuPosition/);
  assert.match(appJs, /createPortal/);
});

test('SearchableSelect exposes combobox semantics, states, and complete keyboard navigation', () => {
  assert.match(appJs, /role: "combobox"/);
  assert.match(appJs, /"aria-controls": listboxId/);
  assert.match(appJs, /role: "listbox"/);
  assert.match(appJs, /role: "option"/);
  assert.match(appJs, /e\.key === "Home"/);
  assert.match(appJs, /e\.key === "End"/);
  assert.match(appJs, /Loading options/);
  assert.match(appJs, /No options available/);
  assert.match(appJs, /No results found/);
});
