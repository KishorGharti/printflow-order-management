'use strict';

const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs } = require('../config/dbHelpers');
const { getTenantBusinessId } = require('../middleware/rbac');
const logger = require('../utils/logger');

function enforcePricingRoleGuard(req, res) {
  if (req.user && (req.user.role === 'designer' || req.user.role === 'printer_finishing')) {
    res.status(403).json({ error: `Forbidden: Pricing is restricted from role "${req.user.role}".` });
    return true;
  }
  return false;
}

/** GET /api/pricing */
const list = async (req, res, next) => {
  try {
    if (enforcePricingRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { customerId, productId } = req.query;

    const conditions = ['business_id = $1'];
    const values = [businessId];
    let idx = 2;

    if (customerId) { conditions.push(`customer_id = $${idx++}`); values.push(customerId); }
    if (productId)  { conditions.push(`product_id = $${idx++}`);  values.push(productId); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await pool.query(`SELECT * FROM customer_pricing ${where}`, values);
    const pricing = rowsToDocs(rows);
    res.json({ pricing, total: pricing.length });
  } catch (err) {
    next(err);
  }
};

/** POST /api/pricing — set custom price override */
const setPrice = async (req, res, next) => {
  try {
    if (enforcePricingRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { customerId, productId, variant = '', customPrice } = req.body;
    if (!customerId || !productId || customPrice === undefined) {
      return res.status(400).json({ error: 'customerId, productId, and customPrice are required.' });
    }

    const normalizedVariant = String(variant || '').trim();

    const { rows } = await pool.query(
      `INSERT INTO customer_pricing (customer_id, product_id, variant, custom_price, business_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (customer_id, product_id, variant)
       DO UPDATE SET custom_price = EXCLUDED.custom_price, updated_at = NOW()
       RETURNING *`,
      [customerId, productId, normalizedVariant, Number(customPrice), businessId]
    );

    res.status(200).json(rowToDoc(rows[0]));
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/pricing — remove custom price override */
const remove = async (req, res, next) => {
  try {
    if (enforcePricingRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const { customerId, productId, variant = '' } = req.query;
    if (!customerId || !productId) {
      return res.status(400).json({ error: 'customerId and productId are required.' });
    }

    const normalizedVariant = String(variant || '').trim();
    await pool.query(
      `DELETE FROM customer_pricing WHERE customer_id = $1 AND product_id = $2 AND variant = $3 AND business_id = $4`,
      [customerId, productId, normalizedVariant, businessId]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/** POST /api/pricing/bulk */
const bulkUpsert = async (req, res, next) => {
  try {
    if (enforcePricingRoleGuard(req, res)) return;
    const businessId = getTenantBusinessId(req);
    const items = req.body.pricing;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'pricing array is required.' });
    }

    let inserted = 0;
    let updated  = 0;

    for (const item of items) {
      const { customerId, productId, variant = '', customPrice } = item;
      if (!customerId || !productId || customPrice === undefined) continue;

      const normalizedVariant = String(variant || '').trim();

      const { rows } = await pool.query(
        `INSERT INTO customer_pricing (customer_id, product_id, variant, custom_price, local_id, business_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (customer_id, product_id, variant)
         DO UPDATE SET custom_price = EXCLUDED.custom_price, updated_at = NOW()
         RETURNING (xmax = 0) AS inserted`,
        [customerId, productId, normalizedVariant, Number(customPrice), item.id || item.localId || null, businessId]
      );

      if (rows[0]?.inserted) inserted++;
      else updated++;
    }

    logger.info(`📦 Bulk pricing upsert (business=${businessId}): ${inserted} inserted, ${updated} updated.`);
    res.json({ success: true, inserted, updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, setPrice, remove, bulkUpsert };
