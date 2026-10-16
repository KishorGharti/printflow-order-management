# Print Ghar Full Runtime Audit — V9

This pass audited the uploaded project as it actually runs in the browser (`index.html` -> `dist/app.js`).

## Fixed

- Added a React error boundary so a render failure shows a recoverable error screen instead of a fully white page.
- Added a startup recovery screen if required CDN libraries fail to load.
- Preserved the safe WhatsApp status flow: status changes never navigate the current Print Ghar tab to WhatsApp.
- Fixed Invoice Prefix so the configured prefix is actually used by generated invoice numbers.
- Added/kept Invoice Start Number and Job Start Number controls in both numbering UIs.
- Removed a duplicate `getOrderCreditAmount` storage method that could silently override earlier logic.
- Removed unreachable legacy HTML after the Bill and Chalan print-preview return paths.
- Removed the disabled/stale duplicate numbering form from the Profile page.
- Updated bill settings typing for current company-fit and table-text-size options.
- Added browser-storage error handling so an oversized saved image/settings payload reports a useful message instead of failing silently.
- Bill Design Save now catches and displays save errors.
- Changed the package test script to run every `tests/*.mjs` file, preventing stale tests from being skipped.
- Changed the build check to validate the actual runtime files (`dist/app.js` and `server.js`) instead of pretending the legacy `src/` tree is the production bundle.
- Added a cache-busted runtime script version so browsers receive this repaired bundle.

## Bill runtime verification

The PDF renderer was executed with mocked jsPDF for these item counts without throwing:

- 0 items -> 1 page
- 1 item -> 1 page
- 14 items -> 1 page
- 15 items -> 2 pages
- 32 items -> 2 pages
- 33 items -> 3 pages
- 50 items -> 3 pages
- 100 items -> 6 pages

The existing V8 bill rules remain intact: Bill Issue Date, numeric table text size, Qty unit, left-aligned Qty/Rate, company design fit modes, 14-row single-page threshold and continuation pages.

## Verification completed

- `npm test`: **72/72 passed**
- `npm run build`: **passed**
- `node --check dist/app.js`: **passed**
- Main app render smoke: **passed**
- Main tabs rendered: Dashboard, Orders, Customers, Products, Stock, Expenses, Profile
- Profile topics rendered: Business Profile, Financial, Numbering/Bill Design, WhatsApp, Team, Branding, Date & Appearance, Reports & Archive, Backup & Data Safety
- No duplicate storage-service methods remain.

## Architecture note

`dist/app.js` is the current production runtime. The TypeScript files under `src/` are an older partial implementation and are retained only as reference. They are not the source used by the browser app. A future source consolidation should migrate the runtime back to a normal compiled TypeScript/React build, but this audit intentionally avoids replacing the working runtime with the stale partial tree.
