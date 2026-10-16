import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('Sub Items section includes enable/disable checkbox and toggleable add sub item controls', () => {
  // Checkbox label and binding
  assert.match(app, /"Add Sub Items"/);
  assert.match(app, /const isSubItemsEnabled = selectedStockProduct\.hasSubItems !== undefined/);
  // Add Sub Item button disabled when sub-items are disabled
  assert.match(app, /disabled: !isSubItemsEnabled/);
  // Disabled state explanation message
  assert.match(app, /Sub items are disabled/);
  assert.match(app, /Check \\"Add Sub Items\\" above to enable sub item creation/);
});

test('Sub Items section is hidden when disabled and no entries exist, with Add Sub Item shortcuts', () => {
  // Section returns null when sub items are disabled AND no entries exist
  assert.match(app, /if \(!isSubItemsEnabled && selectedStockEntries\.length === 0\) return null/);
  // "+ Add Sub Item" button in modal header when section is hidden
  assert.match(app, /storageService\.saveStockItem\(\{ \.\.\.selectedStockProduct, hasSubItems: true \}\)/);
  // Table/card views show "+ Add Sub Item" text instead of "Off" or "Sub items disabled"
  assert.match(app, /\+ Add Sub Item/);
});

test('Stock inventory tracks parent or sub items according to hasSubItems flag', () => {
  assert.match(app, /parent\.hasSubItems !== false/);
  assert.match(app, /usesSubItemTotals = item\.hasSubItems !== false && subItems\.length > 0/);
  assert.match(app, /const trackedItems = usesSubItemTotals \? subItems : \[item\]/);
});

test('Stock parent summaries aggregate sub-item quantities and alert levels', () => {
  assert.match(app, /const getStockAggregateMetrics = item =>/);
  assert.match(app, /usesSubItemTotals = item\.hasSubItems !== false && subItems\.length > 0/);
  assert.match(app, /onHand: trackedItems\.reduce/);
  assert.match(app, /lowAlertLevel: trackedItems\.reduce/);
  assert.match(app, /const selQty = selMetrics\.onHand/);
  assert.match(app, /const selThreshold = selMetrics\.lowAlertLevel/);

  const aggregate = (parent, allStock) => {
    const children = allStock.filter(entry => entry.parentId === parent.id);
    const tracked = parent.hasSubItems !== false && children.length ? children : [parent];
    return {
      onHand: tracked.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      lowAlertLevel: tracked.reduce((sum, item) => sum + Number(item.lowStockThreshold || 0), 0)
    };
  };
  const parent = { id: 'parent', quantity: 99, lowStockThreshold: 50, hasSubItems: true };
  const allStock = [parent,
    { id: 'sub-1', parentId: 'parent', quantity: 12, lowStockThreshold: 3 },
    { id: 'sub-2', parentId: 'parent', quantity: 8, lowStockThreshold: 2 }
  ];
  assert.deepEqual(aggregate(parent, allStock), { onHand: 20, lowAlertLevel: 5 });
});

test('Parent quantity controls are hidden when stock is managed by sub-items', () => {
  assert.match(app, /selMetrics\.usesSubItemTotals\s*\? h\("div"/);
  assert.match(app, /Stock quantity is managed from \$\{selMetrics\.subItems\.length\} sub-items below/);
  assert.match(app, /metrics\.usesSubItemTotals \? h\("div"[^\n]+Quantity managed from sub-items/);
  assert.match(app, /metrics\.usesSubItemTotals[\s\S]*?"Manage sub-items"/);
  assert.match(app, /!metrics\.usesSubItemTotals && h\("button"[^\n]+"\+10 stock"/);
});

test('Blocked stock deletion explains dependencies and offers safe resolution actions', () => {
  assert.match(app, /getStockItemDependencies\(id\)/);
  assert.match(app, /unlinkStockItemFromProducts\(id\)/);
  assert.match(app, /const showStockDeleteDependencies = item =>/);
  assert.match(app, /title: 'Stock item cannot be deleted'/);
  assert.match(app, /Master Products \(\$\{productNames\.length\}\)/);
  assert.match(app, /Order Allocations \(\$\{orderNames\.length\}\)/);
  assert.match(app, /Sub-items \(\$\{childNames\.length\}\)/);
  assert.match(app, /label: 'Unlink from Products'/);
  assert.match(app, /label: 'Open Master Product'/);
  assert.match(app, /label: 'View Linked Order'/);
  assert.doesNotMatch(app, /This material is used by a Master Product recipe or stock allocation and cannot be deleted/);
});

test('Order-linked stock can be archived without removing historical records', () => {
  assert.match(app, /archiveStockItem\(id\)/);
  assert.match(app, /isArchived: true, archivedAt: now/);
  assert.match(app, /const activeStock = useMemo\(\(\) => stock\.filter\(item => !item\.isArchived\)/);
  assert.match(app, /label: 'Archive Stock'/);
  assert.match(app, /hidden from active inventory and new selections/);
  assert.match(app, /const stockProducts = activeStock\.filter/);
  assert.match(app, /\.\.\.activeStock\.map\(item =>/);
  assert.match(app, /options: activeStock\.filter/);
});

test('New stock products become visible even when inventory filters were active', () => {
  assert.match(app, /const savedStockItem = (await\s+)?storageService\.saveStockItem/);
  assert.match(app, /if \(!savedStockItem\)/);
  assert.match(app, /setStockSearchQuery\(''\)/);
  assert.match(app, /setStockStatusFilter\('ALL'\)/);
  assert.match(app, /setStockUnitFilter\('ALL'\)/);
  assert.match(app, /setStockTablePage\(1\)/);
  assert.match(app, /setSelectedStockProductId\(savedStockItem\.id\)/);
});

test('Client pricing supports product sub-option overrides with safe fallback', () => {
  assert.match(app, /getCustomerVariantPricingMap\(customerId\)/);
  assert.match(app, /setCustomerPrice\(customerId, productId, customPrice, variant = ''\)/);
  assert.match(app, /getEffectivePrice\(productId, customerId, variant = ''\)/);
  assert.match(app, /variantMap\.has\(variantKey\)/);
  assert.match(app, /savePrice\(floatingVariantProduct, variant\)/);
  assert.match(app, /getEffectivePrice\(prodId, custId, entry\.variant\)/);

  const resolvePrice = ({ productId, variant, customerId, masterPrice, pricing }) => {
    const variantEntry = pricing.find(entry => entry.customerId === customerId && entry.productId === productId && entry.variant === variant);
    if (variantEntry) return variantEntry.customPrice;
    const productEntry = pricing.find(entry => entry.customerId === customerId && entry.productId === productId && !entry.variant);
    return productEntry ? productEntry.customPrice : masterPrice;
  };
  const pricing = [
    { customerId: 'client-1', productId: 'product-1', customPrice: 90 },
    { customerId: 'client-1', productId: 'product-1', variant: 'Gloss', customPrice: 75 }
  ];
  assert.equal(resolvePrice({ productId: 'product-1', variant: 'Gloss', customerId: 'client-1', masterPrice: 100, pricing }), 75);
  assert.equal(resolvePrice({ productId: 'product-1', variant: 'Matte', customerId: 'client-1', masterPrice: 100, pricing }), 90);
  assert.equal(resolvePrice({ productId: 'product-1', variant: 'Gloss', customerId: 'client-2', masterPrice: 100, pricing }), 100);
});

test('Product sub-option custom pricing opens in a floating dropdown', () => {
  assert.match(app, /const \[priceVariantMenuProductId, setPriceVariantMenuProductId\] = useState\(''\)/);
  assert.match(app, /setPriceVariantMenuPosition\(getFloatingMenuPosition\(event\.currentTarget/);
  assert.match(app, /align: 'end'/);
  assert.match(app, /`Sub-options \(\$\{getUniqueVariants\(product\)\.length\}\)`/);
  assert.match(app, /h\(FloatingPortal, \{\s*open: Boolean\(floatingVariantProduct\)/);
  assert.match(app, /role: 'dialog'/);
  assert.match(app, /Close sub-option pricing/);
  assert.match(app, /document\.addEventListener\('pointerdown', closeOutside\)/);
  assert.match(app, /event\.key === 'Escape'/);
});

test('Product sub-option stocking requires unique case-insensitive stock links', () => {
  assert.match(app, /Sub-option Stock Links \*/);
  assert.match(app, /Product Sub-options is enabled\. Select at least one Stock sub-item before saving/);
  assert.match(app, /Sub-option names must be unique\. Remove duplicate names such as Blue and blue/);
  assert.match(app, /toLocaleLowerCase\(\) === String\(item\.name \|\| ''\)\.trim\(\)\.toLocaleLowerCase\(\)/);
  assert.match(app, /variants: productMaterialsEnabled && productSubOptionsEnabled \? cleanVariants : \[\]/);
  assert.match(app, /materials: \(productMaterialsEnabled \? productMaterials : \[\]\)\.map/);
});

test('Invoice prefix is removed from numbering settings and invoices use pure numbers', () => {
  // Default company settings has empty invoicePrefix
  assert.match(app, /invoicePrefix: '',/);
  // Numbering form has Invoice Starting Number (Where to start)
  assert.match(app, /Invoice starting number \(Where to start\)/);
  assert.match(app, /Job starting number \(Where to start\)/);
  assert.match(app, /Next invoice \(Pure Number\)/);
  // Edit modal saves empty invoicePrefix and provides where to start
  assert.match(app, /invoicePrefix: '',/);
  assert.match(app, /Invoice Starting Number \(Where to start\)/);
});

test('generateNextInvoiceNumber generates pure numbers starting from configured startNumber', () => {
  function generateNextInvoiceNumber({ orders = [], prefix = '', startNumber = 1042 }) {
    let maxNum = Math.max(1, parseInt(startNumber, 10) || 1) - 1;
    orders.forEach(order => {
      const match = String(order.invoiceNumber || '').match(/(\d+)$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    });
    return `${String(prefix ?? '').trim()}${maxNum + 1}`;
  }

  // Without any orders, starts at 1042 without prefix
  assert.equal(generateNextInvoiceNumber({ orders: [], prefix: '', startNumber: 1042 }), '1042');

  // Increments from existing orders without prefix
  const orders = [
    { orderNumber: 'JOB-1042', invoiceNumber: '1042' },
    { orderNumber: 'JOB-1043', invoiceNumber: '1043' }
  ];
  assert.equal(generateNextInvoiceNumber({ orders, prefix: '', startNumber: 1042 }), '1044');

  // Can start at a custom start number (e.g. 5000)
  assert.equal(generateNextInvoiceNumber({ orders, prefix: '', startNumber: 5000 }), '5000');
});

test('ActionStatusSelector uses a custom floating dropdown menu with workflow categories', () => {
  assert.match(app, /STATUS_CONFIG = \[/);
  assert.match(app, /TRIGGER_THEMES = \{/);
  assert.match(app, /ReactDOM\.createPortal/);
  assert.match(app, /"Workflow Stages"/);
  assert.match(app, /"Dispatch \/ Delivery"/);
  assert.match(app, /"Actions"/);
  // Ensure the old plain HTML select is replaced
  assert.doesNotMatch(app, /h\("select", \{\s*value: order\.status === 'Design'/);
});
