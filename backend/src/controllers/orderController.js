'use strict';

const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs, buildInsertParts, buildSetClause } = require('../config/dbHelpers');
const { deleteResource, isConfigured } = require('../config/cloudinary');
const { getTenantBusinessId } = require('../middleware/rbac');
const { createWorkNotification } = require('../services/notificationService');
const logger = require('../utils/logger');

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
         stock_allocations,
         COALESCE(
           (SELECT jsonb_agg(
             jsonb_build_object(
               'productName', elem->>'productName',
               'quantity', COALESCE((elem->>'quantity')::numeric, 0),
               'unit', COALESCE(elem->>'unit', 'pcs'),
               'itemDescription', COALESCE(elem->>'itemDescription', ''),
               'fileBreakdown', COALESCE(elem->'fileBreakdown', '[]'::jsonb),
               'unitPrice', COALESCE((elem->>'unitPrice')::numeric, 0),
               'lineTotal', COALESCE((elem->>'lineTotal')::numeric, 0),
               'variant', elem->>'variant',
               'subItemGroupId', elem->>'subItemGroupId',
               'subItemGroupName', elem->>'subItemGroupName'
             )
           ) FROM jsonb_array_elements(COALESCE(items, '[]'::jsonb)) AS elem),
           '[]'::jsonb
         ) AS items,
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
    if (!body.orderNumber) return res.status(400).json({ error: 'orderNumber is required.' });

    body.businessId = businessId;

    // Strip computed / virtual fields if present
    delete body.itemSummary;
    delete body.item_summary;
    delete body.mediaCount;
    delete body.media_count;

    const { cols, placeholders, values } = buildInsertParts(body);
    const { rows } = await pool.query(
      `INSERT INTO orders (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );

    const order = rowToDoc(rows[0]);

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

    res.status(201).json(sanitizeOrderForRole(order, req.user?.role));
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

    // Computed / virtual fields from list projections
    delete req.body.itemSummary;
    delete req.body.item_summary;
    delete req.body.mediaCount;
    delete req.body.media_count;

    const { setClause, values: setValues } = buildSetClause(req.body);
    if (!setClause) return res.status(400).json({ error: 'No fields to update.' });

    const shiftedWhere = where.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + setValues.length}`);
    const { rows } = await pool.query(
      `UPDATE orders SET ${setClause} WHERE ${shiftedWhere} RETURNING *`,
      [...setValues, ...whereValues]
    );

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

    res.json(sanitizeOrderForRole(order, req.user?.role));
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

    let inserted = 0;
    let updated = 0;

    for (const item of items) {
      const orderNum = item.orderNumber;
      if (!orderNum) continue;

      const localId = item.id || item.localId;
      const cleanItem = { ...item, localId, businessId };
      delete cleanItem.id;
      delete cleanItem._id;

      // Check existing by orderNumber or localId within this business
      const condVals = localId
        ? [orderNum, localId, businessId]
        : [orderNum, orderNum, businessId];
      const existQ = localId
        ? `SELECT id FROM orders WHERE (order_number = $1 OR local_id = $2) AND business_id = $3 LIMIT 1`
        : `SELECT id FROM orders WHERE order_number = $1 AND business_id = $3 LIMIT 1`;
      const existRes = await pool.query(existQ, condVals.slice(0, localId ? 3 : 2));

      if (existRes.rows.length) {
        const { setClause, values: setValues } = buildSetClause(cleanItem);
        if (setClause) {
          await pool.query(
            `UPDATE orders SET ${setClause} WHERE id = $${setValues.length + 1}`,
            [...setValues, existRes.rows[0].id]
          );
        }
        updated++;
      } else {
        try {
          const { cols, placeholders, values } = buildInsertParts(cleanItem);
          await pool.query(
            `INSERT INTO orders (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          );
          inserted++;
        } catch (e) {
          if (e.code !== '23505') throw e; // skip duplicate key
        }
      }
    }

    logger.info(`📦 Bulk orders upsert: ${inserted} inserted, ${updated} updated for business: ${businessId}`);
    res.json({ success: true, inserted, updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, remove, bulkUpsert, autoCleanupCloudinaryFiles, sanitizeOrderForRole, isFinancialRestrictedRole };
