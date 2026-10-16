Print Ghar Order Manager — Runtime Notes

Current app entry point: index.html -> dist/app.js

Current workflow status:
New -> In Design -> Printing -> Finishing -> Done / Ready -> Cancelled
"Waiting for Customer" and "Completed" have been removed. Legacy saved orders using those statuses are automatically converted to In Design and Ready.

Latest changes:
- Dashboard cleaned and made wider/responsive so table text does not hide.
- Completed KPI removed; attention panel is based on overdue orders only.
- Custom Pricing shows ONLY products with custom rates for the client; new products are added via the "[ + Add Product ]" searchable modal.
- Client Profile date format toggle removed; Profile / Settings -> Date Format is the single global source of truth everywhere.
- Customer Product Overrides card is clickable and opens the Custom Price Override section.
- Existing orders can receive additional products later using "Add Product to This Order" in Order Details.
- New orders can already contain multiple different products.
- WhatsApp remains manual-send: changing status opens WhatsApp with message preloaded; user presses Send.


V25 Human UI polish:
- Wider balanced desktop gutters; compact mobile gutters.
- Customer cards switch to 3 columns at XL screens.
- Job number, company name and product name open Order Details; table row itself stays passive.
- Payment wording standardized to Cash / Online / Credit while preserving legacy stored value Pay for compatibility.
- Calmer shadows, radii, forms and focus states for a more human-designed interface.
- Modal max-height/scroll behavior prevents clipped forms on smaller screens.
- Added reduced-motion and keyboard focus accessibility polish.

Reliability and security pass:
- Cancelled orders now remain in order history instead of being permanently deleted.
- Current net cash uses collected Cash/Online income and excludes unpaid Credit orders.
- Order status changes now keep a timestamped history and consistently update timestamps.
- IDs use collision-resistant UUIDs where supported.
- The server exposes only the application entry files, not project source or configuration files.
- WhatsApp access tokens are server-only through WHATSAPP_ACCESS_TOKEN and are removed from browser storage.
- WhatsApp requests now have size validation, phone validation and a 15-second timeout.
- Core navigation and Profile form controls have explicit accessible names and a single page heading.

Architecture note:
The production browser entry remains index.html -> dist/app.js. The TypeScript files in src/ are a legacy/reference implementation and are not emitted by the current build script.

2026-09-10 Linked inventory workflow:
- Inventory and Products now link to each other directly.
- New or edited master products require at least one existing inventory material.
- Only stock-linked master products are available in order product selectors.
- Stock products support a dedicated one-level entry list for stock details.
- Product-level low-stock alert is optional; blank uses the inventory item's alert level.
- Removed the Inventory Transaction History card and New Order Stock Impact preview from the UI while keeping automatic stock accounting active.
- Stock Inventory now uses a systematic header, grouped summary, focused filters, desktop table, and responsive material cards for smaller screens.
- Stock products now open into a dedicated Entries view with list, add, and edit actions; the old inline multi-row creator is removed.
- Master Product sub-options can link to matching Stock entries. Single-option orders use only that entry; Mixed orders require a total and an equal per-option allocation.
- The old comma-separated Sub Options field is replaced by a Stock entry picker; every selected entry exposes Quantity Used and AUTO/MANUAL controls in the same row.
- Existing product sub-option stock links can be replaced in place without deleting and recreating the row.
- Each stock sub-option can store its own master selling price; customer-specific sub-option rates still take priority.
- Adding a Stock sub-option is now a deliberate two-step Select + Add action, which prevents accidental additions.
- Every linked stock sub-option has an enabled Selling Price field and an inline Save Price action; existing products save that rate immediately without closing the editor.
- Adding a product to Client Price Override now stores and displays its current master price first; editing starts only after the user explicitly clicks Edit.
- Client Price Override sub-options now display their exact Master Product Stock Link selling prices; a product-level client rate no longer hides those sub-option rates.

2026-09-08 Safe UI / UX polish pass (no feature or workflow changes):
- Added an intentional first-paint loading skeleton so slow CDN startup no longer looks like a blank page.
- Added skip-to-content support, active-navigation semantics, searchable-field labels and status-control accessibility labels.
- Clarified the Cancelled status action label from "Delete" to "Cancel Order"; underlying cancellation/history behavior is unchanged.
- Improved disabled states, keyboard focus, file input appearance, data-table number alignment and horizontal-scroll behavior.
- Removed misleading pointer cursor from passive table rows while preserving all existing click targets.
- Added sidebar active indicator, cleaner field semantics, mobile modal viewport handling and mobile input sizing.
- Added dark-mode and print-safe corrections for the new presentation primitives.
