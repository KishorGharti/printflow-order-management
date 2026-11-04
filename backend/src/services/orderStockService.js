'use strict';

const crypto = require('crypto');

/**
 * Order stock accounting on the server.
 *
 * This used to run in the browser (_reconcileOrderStock), which then sent the whole stock list back
 * and overwrote every item's quantity. It now runs inside the same database transaction that saves
 * the order, so the order, its stock movements and the stock quantities are saved together or not
 * at all, and quantities change by the difference only.
 *
 * reconcileOrderStock() is a direct port of the browser rules:
 *  - AUTO materials reserve (quantity x quantity-per-unit) while the order is open;
 *  - reservations follow quantity changes (RESERVE / RELEASE);
 *  - stock is consumed (quantity reduced) once the order reaches the product's "deduct stock at" stage;
 *  - extra quantity added after consumption is consumed straight away;
 *  - cancelling releases reservations; consumed stock is never restored automatically;
 *  - removed order items release their reservations; MANUAL materials never move stock.
 */

const STATUS_RANKS = {
  'New': 0,
  'In Design': 1,
  'Design': 1,
  'Printing': 2,
  'Finishing': 3,
  'Ready': 4,
  'Done': 4,
  'Payment': 4.5,
  'Pickup': 5,
  'Delivery': 5,
  'Mistake': 99,
};

const defaultMakeId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const byId = (list, id) => list.find((entry) => entry.id === id || (entry.localId && entry.localId === id));

/**
 * Pure calculation. Returns the order's new stock allocations, the stock transactions to record,
 * and how much to subtract from each stock item (consumption, keyed by the allocation's inventoryItemId).
 */
function reconcileOrderStock({ order, previousAllocations = [], products = [], stock = [], now = new Date().toISOString(), makeId = defaultMakeId }) {
  const previous = Array.isArray(previousAllocations) ? previousAllocations : [];
  const previousMap = new Map(previous.map((allocation) => [`${allocation.orderItemId}:${allocation.inventoryItemId}:${allocation.trackingMode}`, allocation]));
  const nextAllocations = [];
  const nextItemIds = new Set((order.items || []).map((item) => item.id));
  const transactions = [];
  const consumption = new Map();

  const addTransaction = (allocation, type, quantity, reason) => {
    if (!(quantity > 0)) return;
    transactions.unshift({
      id: makeId('stocktxn'), inventoryItemId: allocation.inventoryItemId,
      inventoryItemName: allocation.inventoryItemName, quantity,
      signedQuantity: type === 'RESERVE' || type === 'CONSUME' ? -quantity : quantity,
      unit: allocation.unit, transactionType: type, orderId: order.id,
      orderNumber: order.orderNumber, masterProductId: allocation.masterProductId,
      masterProductName: allocation.masterProductName, orderItemId: allocation.orderItemId,
      timestamp: now, user: 'System', automatic: true, reason,
    });
  };
  const subtractStock = (inventoryItemId, amount) => {
    if (!byId(stock, inventoryItemId)) return;
    consumption.set(inventoryItemId, (consumption.get(inventoryItemId) || 0) + amount);
  };
  const consumeAllocation = (allocation) => {
    const amount = Math.max(0, Number(allocation.reservedQuantity || 0));
    if (!amount || allocation.trackingMode !== 'AUTO') return allocation;
    subtractStock(allocation.inventoryItemId, amount);
    addTransaction(allocation, 'CONSUME', amount, `Auto consumption at ${allocation.deductStockAt}`);
    return { ...allocation, reservedQuantity: 0, consumedQuantity: Number(allocation.consumedQuantity || 0) + amount, consumedAt: allocation.consumedAt || now };
  };

  (order.items || []).forEach((orderItem) => {
    const product = products.find((entry) => entry.id === orderItem.productId || (entry.localId && entry.localId === orderItem.productId));
    const existingForItem = previous.filter((allocation) => allocation.orderItemId === orderItem.id);
    const applicableMaterials = (product?.materials || []).filter((material) => !material.variant || material.variant === 'ALL' || material.variant === orderItem.variant);
    const recipe = existingForItem.length ? existingForItem : (product?.stockMaterialsEnabled ? applicableMaterials.map((material) => ({
      id: makeId('alloc'), orderItemId: orderItem.id, masterProductId: product.id, masterProductName: product.name,
      inventoryItemId: material.inventoryItemId, inventoryItemName: material.inventoryItemName || byId(stock, material.inventoryItemId)?.name || 'Inventory item',
      quantityPerUnit: material.trackingMode === 'MANUAL' ? (Number(material.quantityPerUnit) || 0) : Math.max(0, Number(material.quantityPerUnit || 0)),
      unit: material.unit || byId(stock, material.inventoryItemId)?.unit || 'pcs',
      trackingMode: material.trackingMode === 'MANUAL' ? 'MANUAL' : 'AUTO',
      deductStockAt: product.deductAutoStockAt || 'Finishing', reservedQuantity: 0, consumedQuantity: 0,
      recipeSnapshotAt: now,
    })) : []);
    recipe.forEach((base) => {
      const key = `${orderItem.id}:${base.inventoryItemId}:${base.trackingMode}`;
      const old = previousMap.get(key) || base;
      const desired = old.trackingMode === 'AUTO' ? Math.max(0, Number(orderItem.quantity || 0)) * Math.max(0, Number(old.quantityPerUnit || 0)) : 0;
      let allocation = { ...old, requiredQuantity: desired };
      if (allocation.trackingMode === 'AUTO' && !allocation.consumedAt) {
        const priorReserved = Math.max(0, Number(old.reservedQuantity || 0));
        const delta = desired - priorReserved;
        if (delta > 0) addTransaction(allocation, 'RESERVE', delta, priorReserved ? 'Order quantity increased' : 'Order created');
        if (delta < 0) addTransaction(allocation, 'RELEASE', -delta, desired === 0 ? 'Order item removed' : 'Order quantity decreased');
        allocation.reservedQuantity = desired;
      } else if (allocation.trackingMode === 'AUTO' && allocation.consumedAt) {
        const consumed = Math.max(0, Number(allocation.consumedQuantity || 0));
        const additional = desired - consumed;
        if (additional > 0) {
          subtractStock(allocation.inventoryItemId, additional);
          addTransaction(allocation, 'CONSUME', additional, 'Order quantity increased after stock consumption');
          allocation.consumedQuantity = consumed + additional;
        }
      }
      if (order.status === 'Cancelled' && Number(allocation.reservedQuantity || 0) > 0) {
        addTransaction(allocation, 'RELEASE', Number(allocation.reservedQuantity), 'Order cancelled');
        allocation.reservedQuantity = 0;
        allocation.releasedAt = now;
      } else if (order.status !== 'Cancelled' && allocation.trackingMode === 'AUTO' && !allocation.consumedAt &&
        (STATUS_RANKS[order.status] ?? 0) >= (STATUS_RANKS[allocation.deductStockAt || 'Finishing'] ?? 3)) {
        allocation = consumeAllocation(allocation);
      }
      nextAllocations.push(allocation);
    });
  });

  previous.filter((allocation) => !nextItemIds.has(allocation.orderItemId)).forEach((allocation) => {
    if (allocation.consumedAt) { nextAllocations.push(allocation); return; }
    const reserved = Math.max(0, Number(allocation.reservedQuantity || 0));
    if (reserved) addTransaction(allocation, 'RELEASE', reserved, order.status === 'Cancelled' ? 'Order cancelled' : 'Order item removed');
  });

  return { allocations: nextAllocations, transactions, consumption };
}

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
};

/**
 * Loads what the calculation needs, applies it, and returns the order's new allocations.
 * `client` must be inside the caller's transaction. Stock quantities are changed by the
 * difference only, in a fixed order, so concurrent orders cannot overwrite or deadlock each other.
 */
async function applyOrderStock(client, businessId, { order, previousAllocations = [] }) {
  const previous = Array.isArray(previousAllocations) ? previousAllocations : [];
  const productIds = [...new Set((order.items || []).map((item) => item.productId).filter(Boolean).map(String))];
  const productRows = productIds.length
    ? (await client.query(
      `SELECT id, local_id, name, materials, stock_materials_enabled, deduct_auto_stock_at FROM products
       WHERE business_id = $1 AND (id::text = ANY($2::text[]) OR local_id = ANY($2::text[]))`,
      [businessId, productIds]
    )).rows
    : [];
  const products = productRows.map((p) => ({
    id: String(p.id), localId: p.local_id, name: p.name,
    materials: parseJson(p.materials, []), stockMaterialsEnabled: p.stock_materials_enabled,
    deductAutoStockAt: p.deduct_auto_stock_at,
  }));
  // A product may be referenced by its local id; give it that id so allocations match what the app uses.
  for (const product of products) {
    const usedId = productIds.find((pid) => pid === product.id || pid === product.localId);
    if (usedId) product.id = usedId;
  }

  const stockIds = new Set(previous.map((a) => a.inventoryItemId).filter(Boolean).map(String));
  for (const product of products) for (const m of product.materials || []) if (m?.inventoryItemId) stockIds.add(String(m.inventoryItemId));
  const stockRows = stockIds.size
    ? (await client.query(
      `SELECT id, local_id, name, unit FROM stock_items
       WHERE business_id = $1 AND (id::text = ANY($2::text[]) OR local_id = ANY($2::text[]))`,
      [businessId, [...stockIds]]
    )).rows
    : [];
  const stock = stockRows.map((s) => ({ id: String(s.id), localId: s.local_id, name: s.name, unit: s.unit }));

  const result = reconcileOrderStock({ order, previousAllocations: previous, products, stock });

  for (const [inventoryItemId, amount] of [...result.consumption.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!(amount > 0)) continue;
    await client.query(
      `UPDATE stock_items SET quantity = COALESCE(quantity, 0) - $1, updated_at = NOW()
       WHERE business_id = $2 AND (id::text = $3 OR local_id = $3)`,
      [amount, businessId, String(inventoryItemId)]
    );
  }
  for (const t of result.transactions) {
    await client.query(
      `INSERT INTO stock_transactions (local_id, inventory_item_id, inventory_item_name, quantity, signed_quantity, unit,
         transaction_type, order_id, order_number, master_product_id, master_product_name, order_item_id,
         "timestamp", "user", automatic, reason, business_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [t.id, t.inventoryItemId, t.inventoryItemName || '', t.quantity, t.signedQuantity, t.unit || 'pcs',
        t.transactionType, t.orderId, t.orderNumber || '', t.masterProductId || '', t.masterProductName || '', t.orderItemId || '',
        t.timestamp, t.user, t.automatic, t.reason || '', businessId]
    );
  }
  return { allocations: result.allocations, stockChanged: result.transactions.length > 0 };
}

/**
 * Explicit "restore stock" for an order (materials physically returned). Same rule the browser used:
 * every consumed amount that was not restored before goes back into stock once, with a RESTORE movement.
 * `client` must be inside the caller's transaction, with the order row locked.
 */
async function restoreConsumedStock(client, businessId, { order, allocations = [], user, now = new Date().toISOString(), makeId = defaultMakeId }) {
  let restored = 0;
  const additions = new Map();
  const transactions = [];
  const next = (Array.isArray(allocations) ? allocations : []).map((allocation) => {
    const amount = allocation.restoredAt ? 0 : Math.max(0, Number(allocation.consumedQuantity || 0));
    if (!amount) return allocation;
    additions.set(String(allocation.inventoryItemId), (additions.get(String(allocation.inventoryItemId)) || 0) + amount);
    transactions.push({
      id: makeId('stocktxn'), inventoryItemId: allocation.inventoryItemId, inventoryItemName: allocation.inventoryItemName,
      quantity: amount, signedQuantity: amount, unit: allocation.unit, transactionType: 'RESTORE', orderId: order.id,
      orderNumber: order.orderNumber, masterProductId: allocation.masterProductId, masterProductName: allocation.masterProductName,
      orderItemId: allocation.orderItemId, timestamp: now, user, automatic: false, reason: 'Explicit stock restore after cancellation',
    });
    restored += amount;
    return { ...allocation, restoredAt: now, restoredQuantity: amount };
  });

  for (const [inventoryItemId, amount] of [...additions.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    await client.query(
      `UPDATE stock_items SET quantity = COALESCE(quantity, 0) + $1, updated_at = NOW()
       WHERE business_id = $2 AND (id::text = $3 OR local_id = $3)`,
      [amount, businessId, inventoryItemId]
    );
  }
  for (const t of transactions) {
    await client.query(
      `INSERT INTO stock_transactions (local_id, inventory_item_id, inventory_item_name, quantity, signed_quantity, unit,
         transaction_type, order_id, order_number, master_product_id, master_product_name, order_item_id,
         "timestamp", "user", automatic, reason, business_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [t.id, t.inventoryItemId, t.inventoryItemName || '', t.quantity, t.signedQuantity, t.unit || 'pcs',
        t.transactionType, t.orderId, t.orderNumber || '', t.masterProductId || '', t.masterProductName || '', t.orderItemId || '',
        t.timestamp, t.user, t.automatic, t.reason, businessId]
    );
  }
  return { allocations: next, restored };
}

module.exports = { reconcileOrderStock, applyOrderStock, restoreConsumedStock, STATUS_RANKS };
