'use strict';

const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs, buildInsertParts, buildSetClause } = require('../config/dbHelpers');
const { getTenantBusinessId } = require('../middleware/rbac');
const logger = require('../utils/logger');

/**
 * Recompute paidAmount / outstandingAmount / paymentStatus from paymentHistory.
 * Keeps derived fields consistent on every write.
 */
function computeDerivedPaymentFields(data) {
  const amount = Math.max(0, Number(data.amount || 0));
  const history = Array.isArray(data.paymentHistory) ? data.paymentHistory : [];
  const isCredit =
    data.paymentMethod === 'Credit' ||
    ['Partial', 'Unpaid', 'Credit'].includes(String(data.paymentStatus || '')) ||
    history.length > 0;

  const paidAmount = isCredit
    ? Math.min(amount, history.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0))
    : amount;
  const outstandingAmount = Math.max(0, amount - paidAmount);
  const paymentMethod = isCredit ? 'Credit' : (data.paymentMethod || 'Cash');
  const paymentStatus =
    outstandingAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid';

  return { paidAmount, outstandingAmount, paymentMethod, paymentStatus };
}

function resolveExpenseWhere(id, businessId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) return { where: 'id = $1', values: [id] };
  if (businessId) {
    return { where: 'local_id = $1 AND business_id = $2', values: [id, businessId] };
  }
  return { where: 'local_id = $1', values: [id] };
}

function enforceFinanceRoleGuard(req, res) {
  if (req.user && (req.user.role === 'designer' || req.user.role === 'printer_finishing')) {
    res.status(403).json({ error: `Forbidden: Expenses and finance are restricted from role "${req.user.role}".` });
    return true;
  }
  return false;
}

/**
 * Sync stock quantity and record stock transaction when an expense has a linked stock item.
 */
async function syncStockFromExpense(expense, previousExpense = null) {
  try {
    const businessId = expense.businessId || expense.business_id;
    const nextLinkedId = expense.linkedPurchaseId || expense.linked_purchase_id;
    const nextQuantity = Math.max(0, Number(expense.stockQuantity || expense.stock_quantity || 0));

    const prevLinkedId = previousExpense ? (previousExpense.linkedPurchaseId || previousExpense.linked_purchase_id) : null;
    const prevQuantity = previousExpense ? Math.max(0, Number(previousExpense.stockQuantity || previousExpense.stock_quantity || 0)) : 0;

    // 1. If linked stock item changed or was unlinked, revert previous quantity from old item
    if (prevLinkedId && prevLinkedId !== nextLinkedId && prevQuantity > 0) {
      const oldItemRes = await pool.query(
        `SELECT id, name, unit FROM stock_items WHERE (id::text = $1 OR local_id = $1 OR purchase_number = $1) AND business_id = $2 LIMIT 1`,
        [prevLinkedId, businessId]
      );
      if (oldItemRes.rows.length) {
        const oldItem = oldItemRes.rows[0];
        await pool.query(
          `UPDATE stock_items SET quantity = GREATEST(0, quantity - $1), updated_at = NOW() WHERE id = $2`,
          [prevQuantity, oldItem.id]
        );
        await pool.query(
          `INSERT INTO stock_transactions (
            inventory_item_id, inventory_item_name, quantity, signed_quantity, unit,
            transaction_type, "timestamp", "user", automatic, reason, business_id
          ) VALUES ($1, $2, $3, $4, $5, 'ADJUST', $6, $7, true, $8, $9)`,
          [
            oldItem.id, oldItem.name, prevQuantity, -prevQuantity, oldItem.unit || 'pcs',
            new Date().toISOString(), expense.paidBy || 'System',
            `Stock item unlinked from expense ${expense.expenseNumber || expense.title || ''}`, businessId
          ]
        );
      }
    }

    // 2. Restock nextLinkedId with delta
    if (nextLinkedId) {
      const delta = (prevLinkedId === nextLinkedId) ? (nextQuantity - prevQuantity) : nextQuantity;
      if (delta !== 0) {
        const itemRes = await pool.query(
          `SELECT id, name, unit FROM stock_items WHERE (id::text = $1 OR local_id = $1 OR purchase_number = $1) AND business_id = $2 LIMIT 1`,
          [nextLinkedId, businessId]
        );
        if (itemRes.rows.length) {
          const item = itemRes.rows[0];
          await pool.query(
            `UPDATE stock_items SET
              quantity = GREATEST(0, quantity + $1),
              vendor = COALESCE(NULLIF($2, ''), vendor),
              vendor_id = COALESCE(NULLIF($3, ''), vendor_id),
              purchase_amount = COALESCE(NULLIF($4, 0), purchase_amount),
              source_expense_id = $5,
              payment_method = COALESCE(NULLIF($6, ''), payment_method),
              payment_status = COALESCE(NULLIF($7, ''), payment_status),
              paid_amount = $8,
              outstanding_amount = $9,
              updated_at = NOW()
             WHERE id = $10`,
            [
              delta,
              expense.vendor || '',
              expense.vendorId || expense.vendor_id || '',
              Number(expense.amount || 0),
              expense.id || expense._id || '',
              expense.paymentMethod || expense.payment_method || '',
              expense.paymentStatus || expense.payment_status || '',
              Number(expense.paidAmount || expense.paid_amount || 0),
              Number(expense.outstandingAmount || expense.outstanding_amount || 0),
              item.id
            ]
          );

          await pool.query(
            `INSERT INTO stock_transactions (
              inventory_item_id, inventory_item_name, quantity, signed_quantity, unit,
              transaction_type, "timestamp", "user", automatic, reason, business_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10)`,
            [
              item.id, item.name, Math.abs(delta), delta, item.unit || 'pcs',
              delta > 0 ? 'PURCHASE' : 'ADJUST',
              new Date().toISOString(), expense.paidBy || 'System',
              delta > 0
                ? `Stock purchase via expense ${expense.expenseNumber || expense.title || ''}`
                : `Stock adjustment via expense ${expense.expenseNumber || expense.title || ''}`,
              businessId
            ]
          );
        }
      }
    }
  } catch (err) {
    logger.error('Failed to sync stock from expense:', err);
  }
}

/** GET /api/expenses — list with search, categories, dates and server-side pagination */
const list = async (req, res, next) => {
  try {
    if (enforceFinanceRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined ? Math.max(0, parseInt(req.query.skip, 10)) : (page - 1) * limit;
    const { fromDate, toDate, category, paymentStatus, search, vendorId } = req.query;

    const conditions = ['business_id = $1'];
    const values = [businessId];
    let idx = 2;

    if (fromDate) { conditions.push(`date >= $${idx++}`); values.push(fromDate); }
    if (toDate)   { conditions.push(`date <= $${idx++}`); values.push(toDate); }
    if (category && category !== 'ALL') { conditions.push(`category ILIKE $${idx++}`); values.push(`%${category}%`); }
    if (paymentStatus && paymentStatus !== 'ALL') { conditions.push(`payment_status = $${idx++}`); values.push(paymentStatus); }
    if (vendorId) { conditions.push(`(vendor_id = $${idx++} OR vendor = $${idx})`); values.push(vendorId); }
    if (search) {
      conditions.push(`(title ILIKE $${idx} OR vendor ILIKE $${idx} OR category ILIKE $${idx} OR expense_number ILIKE $${idx})`);
      values.push(`%${search.trim()}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Exact count of filtered expenses
    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM expenses ${where}`, values);
    const total = countRes.rows[0]?.total || 0;

    const { rows } = await pool.query(
      `SELECT * FROM expenses ${where} ORDER BY date DESC, created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    res.json({
      expenses: rowsToDocs(rows),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/expenses/:id */
const getById = async (req, res, next) => {
  try {
    if (enforceFinanceRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveExpenseWhere(req.params.id, businessId);
    const { rows } = await pool.query(`SELECT * FROM expenses WHERE ${where}`, values);
    if (!rows.length) return res.status(404).json({ error: 'Expense not found.' });

    const expense = rows[0];
    if (expense.business_id && expense.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    res.json(rowToDoc(expense));
  } catch (err) {
    next(err);
  }
};

/** POST /api/expenses */
const create = async (req, res, next) => {
  try {
    if (enforceFinanceRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const body = { ...req.body };
    if (!body.title?.trim()) return res.status(400).json({ error: 'title is required.' });
    if (!body.date)          return res.status(400).json({ error: 'date is required.' });
    if (body.amount == null) return res.status(400).json({ error: 'amount is required.' });

    const derived = computeDerivedPaymentFields(body);
    const merged = { ...body, ...derived, businessId };

    const { cols, placeholders, values } = buildInsertParts(merged);
    const { rows } = await pool.query(
      `INSERT INTO expenses (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );

    const expense = rowToDoc(rows[0]);
    if (expense.linkedPurchaseId && Number(expense.stockQuantity || 0) > 0) {
      await syncStockFromExpense(expense, null);
    }
    logger.info(`💰 Expense created: ${expense.expenseNumber || expense._id} — ${expense.title}`);
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
};

/** PUT /api/expenses/:id */
const update = async (req, res, next) => {
  try {
    if (enforceFinanceRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values: whereValues } = resolveExpenseWhere(req.params.id, businessId);

    const existRes = await pool.query(`SELECT * FROM expenses WHERE ${where}`, whereValues);
    if (!existRes.rows.length) return res.status(404).json({ error: 'Expense not found.' });

    const currentExpense = existRes.rows[0];
    if (currentExpense.business_id && currentExpense.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    const existing = rowToDoc(currentExpense);
    const merged = { ...existing, ...req.body };
    delete merged.businessId;
    delete merged.business_id;

    const derived = computeDerivedPaymentFields(merged);
    const updateData = { ...req.body, ...derived };
    delete updateData.businessId;
    delete updateData.business_id;

    const { setClause, values: setValues } = buildSetClause(updateData);
    if (!setClause) return res.status(400).json({ error: 'No fields to update.' });

    const shiftedWhere = where.replace(/\$(\d+)/g, (_, num) => `$${Number(num) + setValues.length}`);
    const { rows } = await pool.query(
      `UPDATE expenses SET ${setClause} WHERE ${shiftedWhere} RETURNING *`,
      [...setValues, ...whereValues]
    );
    const updatedDoc = rowToDoc(rows[0]);
    await syncStockFromExpense(updatedDoc, existing);
    res.json(updatedDoc);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/expenses/:id/payments
 * Records a single cash payment against a credit/partial expense.
 */
const recordPayment = async (req, res, next) => {
  try {
    if (enforceFinanceRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values: whereValues } = resolveExpenseWhere(req.params.id, businessId);
    const existRes = await pool.query(`SELECT * FROM expenses WHERE ${where}`, whereValues);
    if (!existRes.rows.length) return res.status(404).json({ error: 'Expense not found.' });

    const currentExpense = existRes.rows[0];
    if (currentExpense.business_id && currentExpense.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    const expense = rowToDoc(currentExpense);
    const payAmount   = Math.max(0, Number(req.body.amount || 0));
    const outstanding = Math.max(0, Number(expense.outstandingAmount || 0));

    if (!payAmount)              return res.status(400).json({ error: 'Enter an amount greater than zero.' });
    if (payAmount > outstanding) return res.status(400).json({ error: 'Amount paid cannot exceed the outstanding balance.' });

    const payment = {
      id:        `exppay-${Date.now()}`,
      reference: `CP-${String(Date.now()).slice(-4)}`,
      amount:    payAmount,
      method:    req.body.method || 'Cash',
      paidAt:    req.body.paidAt || new Date().toISOString().split('T')[0],
      notes:     String(req.body.notes || '').trim(),
      paidBy:    req.body.paidBy || '',
      receipt:   req.body.receipt || undefined,
    };

    const existingHistory = Array.isArray(expense.paymentHistory) ? expense.paymentHistory : [];
    const newHistory      = [...existingHistory, payment];
    const newPaidAmount   = Math.min(expense.amount, newHistory.reduce((s, p) => s + Number(p.amount || 0), 0));
    const newOutstanding  = Math.max(0, expense.amount - newPaidAmount);

    const nextIdx = 6;
    const { rows } = await pool.query(
      `UPDATE expenses SET
        payment_history    = $1,
        paid_amount        = $2,
        outstanding_amount = $3,
        payment_method     = 'Credit',
        payment_status     = $4,
        paid_at            = $5
       WHERE ${where.replace('$1', `$${nextIdx}`)}
       RETURNING *`,
      [
        JSON.stringify(newHistory),
        newPaidAmount,
        newOutstanding,
        newOutstanding <= 0 ? 'Paid' : 'Partial',
        payment.paidAt,
        ...whereValues,
      ]
    );

    logger.info(`💳 Expense payment recorded: ${expense.expenseNumber || expense._id} — Rs ${payAmount}`);
    res.json(rowToDoc(rows[0]));
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/expenses/:id */
const remove = async (req, res, next) => {
  try {
    if (enforceFinanceRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { where, values } = resolveExpenseWhere(req.params.id, businessId);

    const existRes = await pool.query(`SELECT * FROM expenses WHERE ${where}`, values);
    if (!existRes.rows.length) return res.status(404).json({ error: 'Expense not found.' });

    const currentExpense = existRes.rows[0];
    if (currentExpense.business_id && currentExpense.business_id !== businessId) {
      return res.status(403).json({ error: 'Forbidden: Cross-business access is strictly prohibited.' });
    }

    await pool.query(`DELETE FROM expenses WHERE ${where}`, values);
    if (currentExpense.linked_purchase_id && Number(currentExpense.stock_quantity || 0) > 0) {
      await syncStockFromExpense({ ...rowToDoc(currentExpense), stockQuantity: 0 }, rowToDoc(currentExpense));
    }
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/expenses/bulk
 * One-time migration: upserts a batch of expenses from localStorage.
 */
const bulkUpsert = async (req, res, next) => {
  try {
    if (enforceFinanceRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const items = req.body.expenses;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'expenses array is required.' });
    }

    let inserted = 0;
    let skipped  = 0;

    for (const item of items) {
      const localId = item.id || item.localId;
      if (!localId) { skipped++; continue; }

      const exists = await pool.query(`SELECT id, business_id FROM expenses WHERE local_id = $1 LIMIT 1`, [localId]);
      if (exists.rows.length) { skipped++; continue; }

      const derived  = computeDerivedPaymentFields(item);
      const cleanItem = { ...item, ...derived, localId, businessId };
      delete cleanItem.id;
      delete cleanItem._id;

      try {
        const { cols, placeholders, values } = buildInsertParts(cleanItem);
        await pool.query(
          `INSERT INTO expenses (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
          values
        );
        inserted++;
      } catch (e) {
        if (e.code !== '23505') throw e;
        skipped++;
      }
    }

    logger.info(`📦 Bulk expense upsert: ${inserted} inserted, ${skipped} skipped for business: ${businessId}`);
    res.json({ success: true, inserted, skipped });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, recordPayment, remove, bulkUpsert, syncStockFromExpense };
