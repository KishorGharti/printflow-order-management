'use strict';

const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs, buildInsertParts, buildSetClause } = require('../config/dbHelpers');
const { deleteResource, isConfigured } = require('../config/cloudinary');
const { getTenantBusinessId } = require('../middleware/rbac');
const { createWorkNotification } = require('../services/notificationService');
const { allocateNumber, lockCounter } = require('../services/numberingService');
const { applyOrderStock, restoreConsumedStock } = require('../services/orderStockService');
const { verifyPassword } = require('../utils/authHelper');

const REPEAT_FIELDS = ['repeatOfOrderId', 'repeat_of_order_id', 'repeatOfOrderNumber', 'repeat_of_order_number', 'repeatDesignMode', 'repeat_design_mode'];
const REPEAT_DESIGN_MODES = ['same', 'changes'];

/** A repeat link is set once, when the order is created, and never changes afterwards. */
function stripRepeatFields(body) {
  for (const key of REPEAT_FIELDS) delete body[key];
}

/** Stock allocations are calculated on the server from the order's saved state; never taken from the browser. */
function stripClientStockFields(body) {
  delete body.stockAllocations;
  delete body.stock_allocations;
  delete body.stockUpdatedAt;
  delete body.stock_updated_at;
  delete body.stockChanged; // reply-only flag, echoed back by clients
  delete body.stock_changed;
}

/**
 * Order lists send media only as a count, so the browser holds empty placeholders for files it has
 * not loaded. Placeholders are never stored: the saved files are kept and genuinely new files
 * (by id) are added. Returns the media to save, or undefined when nothing should change.
 */
const isEmptyMediaEntry = (m) => !m || (typeof m === 'object' && Object.keys(m).length === 0);
function mergeMediaPlaceholders(incoming, currentMedia) {
  if (!Array.isArray(incoming) || !incoming.some(isEmptyMediaEntry)) return incoming;
  let current = currentMedia;
  try { current = typeof current === 'string' ? JSON.parse(current) : current; } catch { current = []; }
  current = Array.isArray(current) ? current : [];
  const known = new Set(current.map((m) => m && m.id).filter(Boolean));
  const added = incoming.filter((m) => !isEmptyMediaEntry(m) && !(m.id && known.has(m.id)));
  return added.length ? [...current, ...added] : undefined;
}
const logger = require('../utils/logger');

/**
 * Removes fields that only exist in the browser (for example the dashboard's _dueMs / _diffMs).
 * No orders column starts with "_", so these can never be stored and would make the query fail.
 */
function stripTransientFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('_')) delete obj[key];
  }
  return obj;
}

// Statuses that trigger automatic cleanup of Cloudinary files
const DELIVERY_STATUSES = ['Delivery', 'Pickup', 'Delivered', 'Done'];
const DESIGN_COMPLETED_STATUSES = ['Printing', 'Finishing', 'Ready', 'Done', 'Pickup', 'Delivery', 'Delivered'];

/**
 * Resolves an :id parameter to a SQL WHERE clause fragment + value.
 * Handles UUID, localId, or orderNumber.
 */
function resolveOrderWhere(id, businessId) {
  // UUIDs are 36 chars; anything else is treated as localId/orderNumber
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) return { where: 'id = $1', values: [id] };
  if (businessId) {
    return { where: '(local_id = $1 OR order_number = $1) AND business_id = $2', values: [id, businessId] };
  }
  return { where: '(local_id = $1 OR order_number = $1)', values: [id] };
}

/**
 * Roles that may NOT see any financial data.
 */
function isFinancialRestrictedRole(role) {
  if (!role) return false;
  const roles = (Array.isArray(role) ? role : String(role).split(','))
    .map(r => r.trim().toLowerCase())
    .filter(Boolean);

  if (roles.some(r => r === 'owner' || r === 'reception' || r === 'super_admin' || r === 'developer')) {
    return false;
  }
  return roles.some(r => r === 'designer' || r === 'printer_finishing' || r === 'printer' || r === 'finisher');
}

/**
 * Sanitizes an order document based on the authenticated user's role.
 * Designers and Printers & Finishing staff MUST NOT receive financial data:
 * expenses, payment details, profit, revenue, balances, unit prices, or line totals.
 */
function sanitizeOrderForRole(order, role) {
  if (!order) return order;
  if (!isFinancialRestrictedRole(role)) return order; // owner, reception, super_admin pass through

  const sanitized = { ...order };

  // ── Order-level financial fields ──────────────────────────────────────────
  const FINANCIAL_FIELDS = [
    'totalAmount', 'total_amount',
    'discount',
    'advanceAmount', 'advance_amount',
    'balanceDue', 'balance_due',
    'paymentMethod', 'payment_method',
    'paymentStatus', 'payment_status',
    'paymentHistory', 'payment_history',
    'initialPaymentMethod', 'initial_payment_method',
    'initialReceivedAmount', 'initial_received_amount',
    'invoiceNumber', 'invoice_number',
    'paidAmount', 'paid_amount',
    'outstandingAmount', 'outstanding_amount',
    'openingBalance', 'opening_balance',
  ];
  for (const field of FINANCIAL_FIELDS) {
    delete sanitized[field];
  }

  // ── Per-item pricing ──────────────────────────────────────────────────────
  if (Array.isArray(sanitized.items)) {
    sanitized.items = sanitized.items.map((item) => {
      const cleanItem = { ...item };
      delete cleanItem.unitPrice;
      delete cleanItem.unit_price;
      delete cleanItem.lineTotal;
      delete cleanItem.line_total;
      delete cleanItem.amount;
      return cleanItem;
    });
  }

  return sanitized;
}

/**
 * Auto-cleanup Cloudinary design and reference files when order status advances.
 * Preserved exactly from the original Mongoose implementation.
 */
async function autoCleanupCloudinaryFiles(order, targetStatus) {
  if (!order || !Array.isArray(order.media) || order.media.length === 0) return order;

  const currentStatus = targetStatus || order.status;
  const isDeliveredOrDone = DELIVERY_STATUSES.includes(currentStatus);
  const isDesignCompleted = DESIGN_COMPLETED_STATUSES.includes(currentStatus);

  let modified = false;
  const updatedMedia = await Promise.all(
    order.media.map(async (item) => {
      if (item.cloudinaryPublicId && !item.isDeletedFromCloud) {
        const isRef = item.category === 'Client Reference' || item.category === 'Reference';

        if (isDeliveredOrDone || (isDesignCompleted && isRef)) {
          try {
            if (isConfigured()) {
              await deleteResource(item.cloudinaryPublicId, item.resourceType || 'image');
            }
            modified = true;
            logger.info(`🧹 Auto-deleted Cloudinary file "${item.name}" (${item.cloudinaryPublicId}) for Order #${order.orderNumber} (trigger: ${currentStatus})`);
            return {
              ...item,
              isDeletedFromCloud: true,
              deletedFromCloudAt: new Date().toISOString(),
            };
          } catch (err) {
            logger.error(`Failed to auto-delete Cloudinary file for Order #${order.orderNumber}:`, err.message);
            return item;
          }
        }
      }
      return item;
    })
  );

  if (modified) {
    await pool.query('UPDATE orders SET media = $1 WHERE id = $2', [JSON.stringify(updatedMedia), order._id]);
    order.media = updatedMedia;
  }

  return order;
}

/** GET /api/orders — list with optional filters and server-side pagination */
const list = async (req, res, next) => {
  try {
    const businessId = getTenantBusinessId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined ? Math.max(0, parseInt(req.query.skip, 10)) : (page - 1) * limit;
    const { status, customerId, search, fields, fromDate, toDate } = req.query;

    const conditions = ['business_id = $1'];
    const values = [businessId];
    let idx = 2;

    if (status && status !== 'ALL') {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }
    if (customerId) {
      conditions.push(`customer_id = $${idx++}`);
      values.push(customerId);
    }
    if (fromDate) {
      conditions.push(`order_date >= $${idx++}`);
      values.push(fromDate);
    }
    if (toDate) {
      conditions.push(`order_date <= $${idx++}`);
      values.push(toDate);
    }
    if (search) {
      conditions.push(`(order_number ILIKE $${idx} OR customer_name ILIKE $${idx} OR customer_phone ILIKE $${idx} OR order_contact_name ILIKE $${idx})`);
      values.push(`%${search.trim()}%`);
      idx++;
    }

    // Role-based Order Scoping:
    // Designer only sees Design Orders (New, In Design, Design, Ready to Go, or assigned to designer)
    // Printer / Finishing only sees Production Orders (Printing, Finishing, Ready, Done, Payment, Pickup, Delivery)
    // Multi-role (Designer + Printer) sees both areas!
    const userRoleStr = String(req.user?.role || '').toLowerCase();
    const isOwnerOrRec = userRoleStr.includes('owner') || userRoleStr.includes('reception') || userRoleStr.includes('super_admin') || userRoleStr.includes('developer');
    const hasDesigner = userRoleStr.includes('designer');
    const hasPrinter = userRoleStr.includes('printer') || userRoleStr.includes('finisher');

    if (!isOwnerOrRec) {
      if (hasDesigner && hasPrinter) {
        conditions.push(`(status IN ('New', 'In Design', 'Design', 'Ready to Go', 'Printing', 'Finishing', 'Ready', 'Done', 'Payment', 'Pickup', 'Delivery') OR designer_id = $${idx} OR designer_name ILIKE $${idx + 1} OR printer_id = $${idx} OR printer_name ILIKE $${idx + 1} OR printed_by ILIKE $${idx + 1})`);
        values.push(String(req.user.id || req.user.localId || ''), `%${req.user.name || ''}%`);
        idx += 2;
      } else if (hasDesigner) {
        conditions.push(`(status IN ('New', 'In Design', 'Design', 'Ready to Go') OR designer_id = $${idx} OR designer_name ILIKE $${idx + 1})`);
        values.push(String(req.user.id || req.user.localId || ''), `%${req.user.name || ''}%`);
        idx += 2;
      } else if (hasPrinter) {
        conditions.push(`(status IN ('Printing', 'Finishing', 'Ready', 'Done', 'Payment', 'Pickup', 'Delivery') OR printer_id = $${idx} OR printer_name ILIKE $${idx + 1} OR printed_by ILIKE $${idx + 1})`);
        values.push(String(req.user.id || req.user.localId || ''), `%${req.user.name || ''}%`);
        idx += 2;
      }
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // 1. Get exact total count for the filtered dataset
    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM orders ${where}`, values);
    const total = countRes.rows[0]?.total || 0;

    // Slim projection for list view: omits heavy JSONB blobs
    const selectCols = fields === 'list'
      ? `id, local_id, business_id, order_number, customer_id, customer_name, customer_phone,
         order_contact_name, order_contact_phone, status, previous_status,
         total_amount, discount, payment_method, payment_status, payment_history,
         initial_payment_method, initial_received_amount, invoice_number,
         due_date, due_time, order_date, created_at, updated_at,
         designer_id, designer_name, designer_job_title,
         printer_id, printer_name, printed_by, printer_job_title,
         pickup_type, delivery_type, completed_at,
         notes, cancel_reason, cancelled_at, cancelled_by,
         repeat_of_order_id, repeat_of_order_number, repeat_design_mode,
         stock_allocations,
         -- Full items (with item id, product id and rate) so saving an order from a list keeps them intact.
         COALESCE(items, '[]'::jsonb) AS items,
         COALESCE(
           (SELECT string_agg(elem->>'productName', ', ')
            FROM jsonb_array_elements(COALESCE(items, '[]'::jsonb)) AS elem),
           ''
         ) AS item_summary,
         COALESCE(jsonb_array_length(COALESCE(media, '[]'::jsonb)), 0) AS media_count`
      : '*';

    const { rows } = await pool.query(
      `SELECT ${selectCols} FROM orders ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    const docs = rowsToDocs(rows);
    const role = req.user?.role;
    res.json({
      orders: docs.map((o) => sanitizeOrderForRole(o, role)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/orders/:id */
const getById = async (req, res, next) => {
  try {
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveOrderWhere(req.params.id, businessId);
    const { rows } = await pool.query(`SELECT * FROM orders WHERE ${where}`, values);
    if (!rows.length) return res.status(404).json({ error: 'Order not found.' });

    const order = rows[0];
    if (order.business_id && order.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    const doc = rowToDoc(order);
    res.json(sanitizeOrderForRole(doc, req.user?.role));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id/repeats
 * The repeat jobs made from this order, newest first. Only job identity and status are returned,
 * so every role that can view orders may see the links.
 */
const listRepeats = async (req, res, next) => {
  try {
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveOrderWhere(req.params.id, businessId);
    const source = (await pool.query(`SELECT id, business_id FROM orders WHERE ${where} LIMIT 1`, values)).rows[0];
    if (!source) return res.status(404).json({ error: 'Order not found.' });
    if (source.business_id && source.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }
    const { rows } = await pool.query(
      `SELECT id, local_id, order_number, order_date, status, repeat_design_mode, created_at
       FROM orders WHERE business_id = $1 AND repeat_of_order_id = $2
       ORDER BY created_at DESC`,
      [businessId, String(source.id)]
    );
    res.json({ repeats: rowsToDocs(rows) });
  } catch (err) {
    next(err);
  }
};

/** POST /api/orders */
const create = async (req, res, next) => {
  try {
    if (req.user && isFinancialRestrictedRole(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Role "${req.user.role}" is not permitted to create orders.`
      });
    }

    const businessId = getTenantBusinessId(req);

    // Subscription check: if tenant subscription has expired, enforce read-only mode for orders
    if (businessId && businessId !== 'global_settings') {
      const subRes = await pool.query(
        `SELECT status, subscription_status, subscription_expires_at FROM saas_clients WHERE business_id = $1 LIMIT 1`,
        [businessId]
      );
      if (subRes.rows.length) {
        const sub = subRes.rows[0];
        const isExp = (sub.subscription_status === 'expired') ||
                      (sub.status === 'expired') ||
                      (sub.subscription_expires_at && new Date(sub.subscription_expires_at).getTime() < Date.now());
        if (isExp) {
          return res.status(403).json({
            error: 'Subscription has expired. Account is in read-only mode. Please contact administrator to renew your plan.',
            code: 'SUBSCRIPTION_EXPIRED'
          });
        }
      }
    }

    const body = { ...req.body };
    if (!body.customerId) return res.status(400).json({ error: 'customerId is required.' });
    if (!Array.isArray(body.items) || body.items.length === 0)
      return res.status(400).json({ error: 'At least one order item is required.' });

    body.businessId = businessId;

    // Job and invoice numbers are assigned by the server, never taken from the browser.
    delete body.orderNumber;
    delete body.order_number;
    delete body.invoiceNumber;
    delete body.invoice_number;

    // Strip computed / virtual fields if present
    delete body.itemSummary;
    delete body.item_summary;
    delete body.mediaCount;
    delete body.media_count;
    stripTransientFields(body);
    stripClientStockFields(body);
    if (Array.isArray(body.media)) body.media = body.media.filter((m) => !isEmptyMediaEntry(m));

    // Repeat job: the browser only names the old order. Its job number is read from the database,
    // and the old order must belong to this business.
    const repeatOfId = String(body.repeatOfOrderId || body.repeat_of_order_id || '').trim();
    const repeatDesignMode = String(body.repeatDesignMode || body.repeat_design_mode || '').trim();
    stripRepeatFields(body);
    if (repeatOfId) {
      const { where, values } = resolveOrderWhere(repeatOfId, businessId);
      const source = (await pool.query(`SELECT id, business_id, order_number FROM orders WHERE ${where} LIMIT 1`, values)).rows[0];
      if (!source || source.business_id !== businessId) {
        return res.status(400).json({ error: 'The order being repeated was not found.' });
      }
      body.repeatOfOrderId = String(source.id);
      body.repeatOfOrderNumber = source.order_number;
      body.repeatDesignMode = REPEAT_DESIGN_MODES.includes(repeatDesignMode) ? repeatDesignMode : 'changes';
      const note = `Repeat of ${source.order_number} (${body.repeatDesignMode === 'same' ? 'same design' : 'design changes'})`;
      if (Array.isArray(body.history) && body.history.length) body.history[0] = { ...body.history[0], note };
      else body.history = [{ status: body.status || 'New', timestamp: new Date().toISOString(), note }];
    }

    // The browser sends a fresh localId for every new order. A retry with the same localId
    // (for example after a network timeout) returns the order that was already created.
    const idempotencyKey = body.localId ? String(body.localId) : null;
    const findExisting = async (db) => {
      if (!idempotencyKey) return null;
      const r = await db.query('SELECT * FROM orders WHERE business_id = $1 AND local_id = $2 LIMIT 1', [businessId, idempotencyKey]);
      return r.rows[0] || null;
    };

    let createdRow = null;
    let stockChanged = false;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existingRow = await findExisting(client);
      if (existingRow) {
        await client.query('ROLLBACK');
        return res.status(200).json(sanitizeOrderForRole(rowToDoc(existingRow), req.user?.role));
      }

      const { formatted } = await allocateNumber(client, businessId, 'job');
      body.orderNumber = formatted;

      const { cols, placeholders, values } = buildInsertParts(body);
      const { rows } = await client.query(
        `INSERT INTO orders (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );
      // Reserve / consume the order's stock in the same transaction as the order itself.
      let row = rows[0];
      const inserted = rowToDoc(row);
      const stock = await applyOrderStock(client, businessId, {
        order: { id: String(row.id), orderNumber: inserted.orderNumber, status: inserted.status, items: inserted.items || [] },
        previousAllocations: [],
      });
      if (stock.allocations.length || stock.stockChanged) {
        row = (await client.query(
          'UPDATE orders SET stock_allocations = $1, stock_updated_at = $2 WHERE id = $3 RETURNING *',
          [JSON.stringify(stock.allocations), new Date().toISOString(), row.id]
        )).rows[0];
      }
      stockChanged = stock.stockChanged;
      await client.query('COMMIT');
      createdRow = row;
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      // Two identical requests raced: the other one created the order, so return it.
      if (txErr.code === '23505') {
        const existingRow = await findExisting(pool);
        if (existingRow) return res.status(200).json(sanitizeOrderForRole(rowToDoc(existingRow), req.user?.role));
      }
      throw txErr;
    } finally {
      client.release();
    }

    const order = rowToDoc(createdRow);

    if (DESIGN_COMPLETED_STATUSES.includes(order.status)) {
      await autoCleanupCloudinaryFiles(order, order.status);
    }

    // Role-based work notification: when order requires design
    if (order.status === 'In Design' || order.status === 'New') {
      await createWorkNotification({
        businessId,
        targetRole: 'designer',
        orderId: order._id || order.id,
        orderNumber: order.orderNumber,
        title: 'New Work Ready for Design',
        message: `Order #${order.orderNumber} (${order.customerName || 'Client'}) requires design.`,
        stage: order.status,
      });
    }

    res.status(201).json({ ...sanitizeOrderForRole(order, req.user?.role), stockChanged });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Order number already exists.' });
    next(err);
  }
};

/** PUT /api/orders/:id */
const CANCELLABLE_STATUSES = ['New', 'In Design', 'Design', 'Printing', 'Finishing', 'Progress'];

const update = async (req, res, next) => {
  try {
    const businessId = getTenantBusinessId(req);
    const { where, values: whereValues } = resolveOrderWhere(req.params.id, businessId);

    // Verify existence first
    const existing = await pool.query(`SELECT * FROM orders WHERE ${where}`, whereValues);
    if (!existing.rows.length) return res.status(404).json({ error: 'Order not found.' });

    const currentOrder = existing.rows[0];

    // Multi-tenant check
    if (currentOrder.business_id && currentOrder.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    const newStatus = req.body.status;

    // Dead Order Rule: If an order is cancelled, it is dead - no work progress or reactivation allowed
    if (currentOrder.status === 'Cancelled') {
      if (newStatus && newStatus !== 'Cancelled') {
        return res.status(400).json({
          error: 'This order is cancelled and dead. No work progress or status changes are permitted.'
        });
      }
      if (req.body.items) {
        return res.status(400).json({
          error: 'This order is cancelled and dead. Order items and work cannot be modified.'
        });
      }
      if (newStatus === 'Cancelled') {
        return res.status(400).json({ error: 'Order is already cancelled and closed.' });
      }
    }

    // Mistake is final: once an order is marked as Mistake its status cannot change again.
    if (currentOrder.status === 'Mistake' && newStatus && newStatus !== 'Mistake') {
      return res.status(400).json({
        error: 'This order was marked as Mistake and is closed. Its status can no longer be changed.',
        code: 'ORDER_MISTAKE_FINAL',
      });
    }

    if (newStatus === 'Cancelled') {
      // Allowed only from beginning until it reaches the Progress stage
      if (!CANCELLABLE_STATUSES.includes(currentOrder.status)) {
        return res.status(400).json({
          error: `Cannot cancel order in "${currentOrder.status}" stage. Cancellation is only allowed from New up to Progress stage.`
        });
      }

      // Completed / Paid orders must not be cancellable
      if (currentOrder.payment_status === 'Paid') {
        return res.status(400).json({
          error: 'Cannot cancel order because payment has already been completed.'
        });
      }

      // Preserve cancellation audit fields
      const now = new Date().toISOString();
      if (!req.body.cancelledAt) req.body.cancelledAt = now;
      if (!req.body.previousStatus) req.body.previousStatus = currentOrder.status;
      if (!req.body.cancelReason && req.body.notes) req.body.cancelReason = req.body.notes;

      let history = req.body.history;
      if (!history) {
        try {
          history = typeof currentOrder.history === 'string' ? JSON.parse(currentOrder.history) : (currentOrder.history || []);
        } catch {
          history = [];
        }
      }
      if (Array.isArray(history)) {
        const last = history[history.length - 1];
        if (!last || last.status !== 'Cancelled') {
          history.push({
            status: 'Cancelled',
            previousStatus: currentOrder.status,
            timestamp: now,
            cancelledAt: now,
            cancelledBy: req.body.cancelledBy || req.user?.name || 'Staff',
            note: req.body.cancelReason || 'Order cancelled'
          });
          req.body.history = history;
        }
      }
    }

    // Finance, Dispatch & Customer Protection: Designer and Printer/Finishing cannot perform Pickup, Delivery, Payment, or edit financial fields
    if (req.user && isFinancialRestrictedRole(req.user.role)) {
      if (['Pickup', 'Delivery', 'Payment'].includes(newStatus)) {
        return res.status(403).json({ error: 'Forbidden: Pickup, Delivery, and Payment can only be managed by Owner or Reception.' });
      }
      delete req.body.totalAmount;
      delete req.body.total_amount;
      delete req.body.discount;
      delete req.body.paymentMethod;
      delete req.body.payment_method;
      delete req.body.paymentStatus;
      delete req.body.payment_status;
      delete req.body.paymentHistory;
      delete req.body.payment_history;
      delete req.body.initialPaymentMethod;
      delete req.body.initial_payment_method;
      delete req.body.initialReceivedAmount;
      delete req.body.initial_received_amount;
      delete req.body.invoiceNumber;
      delete req.body.invoice_number;
      delete req.body.customerId;
      delete req.body.customer_id;
      delete req.body.customerName;
      delete req.body.customer_name;
    }

    // Tenant Isolation: business_id is immutable and cannot be updated
    delete req.body.businessId;
    delete req.body.business_id;
    stripRepeatFields(req.body);

    // Job and invoice numbers are assigned by the server; an update can never change them.
    // Invoice numbers are set through POST /api/orders/invoice-number.
    delete req.body.orderNumber;
    delete req.body.order_number;
    delete req.body.invoiceNumber;
    delete req.body.invoice_number;
    stripTransientFields(req.body);
    stripClientStockFields(req.body);

    // Computed / virtual fields from list projections
    delete req.body.itemSummary;
    delete req.body.item_summary;
    delete req.body.mediaCount;
    delete req.body.media_count;
    if (req.body.media !== undefined) {
      const media = mergeMediaPlaceholders(req.body.media, currentOrder.media);
      if (media === undefined) delete req.body.media; else req.body.media = media;
    }

    // Order lists do not include history; record a status change here when none was sent.
    if (newStatus && newStatus !== currentOrder.status && !Array.isArray(req.body.history)) {
      let history = currentOrder.history;
      try { history = typeof history === 'string' ? JSON.parse(history) : history; } catch { history = []; }
      history = Array.isArray(history) ? [...history] : [];
      history.push({ status: newStatus, timestamp: new Date().toISOString() });
      req.body.history = history;
    }

    if (!buildSetClause(req.body).setClause) return res.status(400).json({ error: 'No fields to update.' });

    // Save the order and its stock movements together: lock the order, recalculate its stock from
    // the saved allocations, and write everything in one transaction.
    let rows;
    let stockChanged = false;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const locked = (await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [currentOrder.id])).rows[0];
      const lockedDoc = rowToDoc(locked);
      const stock = await applyOrderStock(client, businessId, {
        order: {
          id: String(locked.id),
          orderNumber: locked.order_number,
          status: req.body.status ?? locked.status,
          items: Array.isArray(req.body.items) ? req.body.items : (lockedDoc.items || []),
        },
        previousAllocations: lockedDoc.stockAllocations || [],
      });
      req.body.stockAllocations = stock.allocations;
      if (stock.stockChanged) req.body.stockUpdatedAt = new Date().toISOString();
      stockChanged = stock.stockChanged;

      const { setClause, values: setValues } = buildSetClause(req.body);
      rows = (await client.query(
        `UPDATE orders SET ${setClause} WHERE id = $${setValues.length + 1} RETURNING *`,
        [...setValues, locked.id]
      )).rows;
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    const order = rowToDoc(rows[0]);

    if (newStatus) {
      await autoCleanupCloudinaryFiles(order, newStatus);
    }

    // Role-based work notifications on status transitions
    if (newStatus && newStatus !== currentOrder.status) {
      const orderNum = order.orderNumber || currentOrder.order_number;
      const orderId = order._id || order.id || currentOrder.id;

      if (newStatus === 'In Design') {
        await createWorkNotification({
          businessId,
          targetRole: 'designer',
          orderId,
          orderNumber: orderNum,
          title: 'Work Ready for Design',
          message: `Order #${orderNum} moved to In Design.`,
          stage: newStatus,
        });
      } else if (newStatus === 'Printing' || newStatus === 'Finishing') {
        await createWorkNotification({
          businessId,
          targetRole: 'printer_finishing',
          orderId,
          orderNumber: orderNum,
          title: 'Design Completed - Ready for Production',
          message: `Order #${orderNum} design completed. Ready for production.`,
          stage: newStatus,
        });
      } else if (['Done', 'Ready', 'Pickup', 'Delivery'].includes(newStatus)) {
        await createWorkNotification({
          businessId,
          targetRole: 'reception',
          orderId,
          orderNumber: orderNum,
          title: 'Printing / Production Completed',
          message: `Order #${orderNum} printing completed. Ready for customer pickup or delivery.`,
          stage: newStatus,
        });
      }
    }

    res.json({ ...sanitizeOrderForRole(order, req.user?.role), stockChanged });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/orders/:id */
const remove = async (req, res, next) => {
  // Rule 2: Completely remove the normal "Delete Order" functionality
  return res.status(403).json({
    error: 'Permanent order deletion is disabled. Please cancel the order instead.'
  });
};

/**
 * POST /api/orders/bulk
 * One-time migration: upserts a batch of orders from localStorage.
 */
const bulkUpsert = async (req, res, next) => {
  try {
    if (req.user && isFinancialRestrictedRole(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Role "${req.user.role}" is not permitted to create or bulk update orders.`
      });
    }

    const businessId = getTenantBusinessId(req);
    const items = req.body.orders;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'orders array is required.' });
    }

    // Used to migrate old browser-stored orders and to restore a verified backup. Orders are matched
    // only by identity (local id or server id) inside this business, never by job number, so a
    // stale or reused number can never overwrite a different order.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const payloadIds = new Set();
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      for (const v of [item.localId, item.id, item._id]) if (v) payloadIds.add(String(v));
    }
    // An invoice number from the payload is kept only if no unrelated order already uses it
    // (orders billed together in the same payload may share it).
    const invoiceUsable = async (db, invoiceNumber, ownId) => {
      const { rows } = await db.query(
        'SELECT id, local_id FROM orders WHERE business_id = $1 AND invoice_number = $2',
        [businessId, invoiceNumber]
      );
      return rows.every((r) => String(r.id) === String(ownId) || payloadIds.has(String(r.id)) || (r.local_id && payloadIds.has(String(r.local_id))));
    };

    let inserted = 0;
    let updated = 0;
    let renumbered = 0;
    let skipped = 0;
    let invoiceNumbersCleared = 0;

    for (const item of items) {
      if (!item || typeof item !== 'object') { skipped++; continue; }
      const localId = String(item.localId || item.id || '').trim();
      const serverId = [item._id, item.id].find((v) => UUID_RE.test(String(v || ''))) || null;
      if (!localId && !serverId) { skipped++; continue; }

      const wantedNumber = String(item.orderNumber || '').trim();
      const wantedInvoice = String(item.invoiceNumber || '').trim();
      const cleanItem = { ...item, localId: localId || undefined, businessId };
      for (const key of ['id', '_id', 'business_id', 'orderNumber', 'order_number', 'invoiceNumber', 'invoice_number',
        'itemSummary', 'item_summary', 'mediaCount', 'media_count', 'stockChanged', 'stock_changed']) delete cleanItem[key];
      stripTransientFields(cleanItem);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = (await client.query(
          `SELECT id, invoice_number FROM orders
           WHERE business_id = $1 AND ((local_id = $2 AND $2 <> '') OR id::text = $3)
           LIMIT 1 FOR UPDATE`,
          [businessId, localId, serverId || '']
        )).rows[0];

        if (existing) {
          // Restoring an order never changes its job number or replaces its invoice number.
          if (wantedInvoice && !existing.invoice_number) {
            if (await invoiceUsable(client, wantedInvoice, existing.id)) cleanItem.invoiceNumber = wantedInvoice;
            else invoiceNumbersCleared++;
          }
          const { setClause, values: setValues } = buildSetClause(cleanItem);
          if (setClause) {
            await client.query(`UPDATE orders SET ${setClause} WHERE id = $${setValues.length + 1}`, [...setValues, existing.id]);
          }
          updated++;
        } else {
          // Keep the order's original job number when it is still free; otherwise the server assigns one.
          await lockCounter(client, businessId, 'job');
          let orderNumber = wantedNumber;
          const taken = !orderNumber || (await client.query(
            'SELECT 1 FROM orders WHERE business_id = $1 AND order_number = $2 LIMIT 1',
            [businessId, orderNumber]
          )).rows.length > 0;
          if (taken) {
            orderNumber = (await allocateNumber(client, businessId, 'job')).formatted;
            if (wantedNumber) renumbered++;
          }
          cleanItem.orderNumber = orderNumber;
          if (wantedInvoice) {
            await lockCounter(client, businessId, 'invoice');
            if (await invoiceUsable(client, wantedInvoice, null)) cleanItem.invoiceNumber = wantedInvoice;
            else invoiceNumbersCleared++;
          }
          const { cols, placeholders, values } = buildInsertParts(cleanItem);
          await client.query(`INSERT INTO orders (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`, values);
          inserted++;
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        if (e.code !== '23505') throw e;
        skipped++; // another request saved the same order at the same moment
      } finally {
        client.release();
      }
    }

    logger.info(`📦 Bulk orders upsert: ${inserted} inserted, ${updated} updated, ${renumbered} renumbered, ${skipped} skipped for business: ${businessId}`);
    res.json({ success: true, inserted, updated, renumbered, skipped, invoiceNumbersCleared });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/invoice-number  { orderIds: [...] }
 * Assigns one invoice number to the given orders (one order, or several billed together).
 * If they already share an invoice number it is returned unchanged, so retries are safe.
 * Otherwise the next number is allocated and saved in the same transaction.
 */
const assignInvoiceNumber = async (req, res, next) => {
  try {
    if (req.user && isFinancialRestrictedRole(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Role "${req.user.role}" is not permitted to issue invoices.` });
    }
    const businessId = getTenantBusinessId(req);
    const ids = Array.isArray(req.body?.orderIds)
      ? [...new Set(req.body.orderIds.map((v) => String(v || '').trim()).filter(Boolean))]
      : [];
    if (!ids.length) return res.status(400).json({ error: 'orderIds is required.' });
    if (ids.length > 200) return res.status(400).json({ error: 'Too many orders in one invoice.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT id, local_id, order_number, invoice_number FROM orders
         WHERE business_id = $1 AND (id::text = ANY($2::text[]) OR local_id = ANY($2::text[]))
         ORDER BY id
         FOR UPDATE`,
        [businessId, ids]
      );
      // Every requested order must exist in this business (also blocks cross-business IDs).
      const matched = new Set();
      for (const r of rows) { matched.add(String(r.id)); if (r.local_id) matched.add(String(r.local_id)); }
      if (!rows.length || ids.some((id) => !matched.has(id))) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'One or more orders were not found.' });
      }

      const current = [...new Set(rows.map((r) => String(r.invoice_number || '').trim()))];
      let invoiceNumber;
      let reused = false;
      if (current.length === 1 && current[0]) {
        invoiceNumber = current[0];
        reused = true;
      } else {
        invoiceNumber = (await allocateNumber(client, businessId, 'invoice')).formatted;
        await client.query(
          'UPDATE orders SET invoice_number = $1, updated_at = NOW() WHERE business_id = $2 AND id = ANY($3::uuid[])',
          [invoiceNumber, businessId, rows.map((r) => r.id)]
        );
      }
      await client.query('COMMIT');

      return res.json({
        ok: true,
        invoiceNumber,
        reused,
        orders: rows.map((r) => ({ _id: r.id, id: r.id, localId: r.local_id, orderNumber: r.order_number, invoiceNumber })),
      });
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/:id/restore-stock   body: { pin }
 * Puts an order's consumed materials back into stock (materials physically returned).
 * Needs the PIN of an active team member whose job title is Owner, Admin, Inventory, Stock or Manager,
 * the same rule the order screen shows. Order, stock quantities and RESTORE movements are saved together.
 */
const RESTORE_AUTHORIZED_TITLE = /admin|owner|inventory|stock|manager/i;

const restoreStock = async (req, res, next) => {
  try {
    const businessId = getTenantBusinessId(req);
    const pin = String(req.body?.pin || '').replace(/\D/g, '');
    if (!pin) return res.status(400).json({ error: 'Authorized inventory PIN required.' });

    const members = (await pool.query(
      `SELECT name, job_title, pin, password_hash FROM team_members
       WHERE business_id = $1 AND is_active IS DISTINCT FROM false AND COALESCE(status, '') <> 'inactive'`,
      [businessId]
    )).rows.filter((m) => RESTORE_AUTHORIZED_TITLE.test(String(m.job_title || '')));
    if (!members.length) {
      return res.status(403).json({ error: 'Stock restore requires an Owner, Admin, Inventory, Stock, or Manager team role. Add an authorized member in Profile → Team.' });
    }
    const member = members.find((m) => verifyPassword(pin, m.pin) || verifyPassword(pin, m.password_hash));
    if (!member) return res.status(403).json({ error: 'Incorrect PIN or this team member is not authorized to restore stock.' });

    const { where, values } = resolveOrderWhere(req.params.id, businessId);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const locked = (await client.query(`SELECT * FROM orders WHERE ${where} FOR UPDATE`, values)).rows[0];
      if (!locked || (locked.business_id && locked.business_id !== businessId)) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found.' });
      }
      const lockedDoc = rowToDoc(locked);
      const result = await restoreConsumedStock(client, businessId, {
        order: { id: String(locked.id), orderNumber: locked.order_number },
        allocations: lockedDoc.stockAllocations || [],
        user: member.name,
      });
      const saved = (await client.query(
        'UPDATE orders SET stock_allocations = $1, stock_updated_at = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
        [JSON.stringify(result.allocations), new Date().toISOString(), locked.id]
      )).rows[0];
      await client.query('COMMIT');
      return res.json({
        order: sanitizeOrderForRole(rowToDoc(saved), req.user && req.user.role),
        restored: result.restored,
        authorizedBy: member.name,
        stockChanged: result.restored > 0,
      });
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, listRepeats, create, update, remove, bulkUpsert, assignInvoiceNumber, restoreStock, autoCleanupCloudinaryFiles, sanitizeOrderForRole, isFinancialRestrictedRole };
