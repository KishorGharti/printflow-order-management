'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticateUser } = require('../middleware/rbac');
const logger = require('../utils/logger');

/**
 * POST /api/support/tickets
 * Submit a direct support ticket / bug report from the client shop storefront to the Developer Console.
 */
router.post('/tickets', authenticateUser, async (req, res) => {
  try {
    const { subject, message, priority = 'medium', clientName, clientEmail, companyName, businessId } = req.body;

    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ ok: false, error: 'Subject is required.' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ ok: false, error: 'Message / description is required.' });
    }

    const name = (clientName || req.user?.name || req.body?.performedBy || 'Shop Staff').trim();
    const email = (clientEmail || req.user?.email || 'client@printghar.com').trim();
    const company = (companyName || req.user?.companyName || req.user?.businessId || 'Print Ghar').trim();
    let bizId = (businessId || req.user?.businessId || req.headers['x-business-id'] || '').trim();
    if (!bizId || bizId === 'global_settings') {
      const clientMatch = await pool.query('SELECT business_id FROM saas_clients WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
      if (clientMatch.rows.length && clientMatch.rows[0].business_id) {
        bizId = clientMatch.rows[0].business_id;
      } else {
        bizId = 'global_settings';
      }
    }

    const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
    const safePriority = allowedPriorities.includes(priority) ? priority : 'medium';

    const { rows } = await pool.query(
      `INSERT INTO saas_support_tickets (client_name, client_email, company_name, business_id, subject, message, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
       RETURNING *;`,
      [name, email, company, bizId, subject.trim(), message.trim(), safePriority]
    );

    const ticket = rows[0];
    logger.info(`📩 Support Ticket created from ${name} (${company}): "${subject}" [${safePriority.toUpperCase()}]`);

    return res.status(201).json({
      ok: true,
      message: 'Support ticket submitted successfully. The platform developer has received your report.',
      ticket,
    });
  } catch (err) {
    logger.error('Failed to create client support ticket:', err);
    return res.status(500).json({ ok: false, error: 'Failed to submit support ticket.' });
  }
});

/**
 * GET /api/support/my-tickets
 * Retrieve tickets submitted by this client shop.
 */
router.get('/my-tickets', authenticateUser, async (req, res) => {
  try {
    const email = req.user?.email || '';
    const company = req.user?.companyName || '';
    const businessId = req.user?.businessId || req.headers['x-business-id'] || '';

    const { rows } = await pool.query(
      `SELECT * FROM saas_support_tickets
       WHERE ($1 != '' AND client_email = $1)
          OR ($2 != '' AND company_name = $2)
          OR ($3 != '' AND business_id = $3)
       ORDER BY created_at DESC
       LIMIT 30;`,
      [email, company, businessId]
    );

    return res.json({ ok: true, tickets: rows });
  } catch (err) {
    logger.error('Failed to list client support tickets:', err);
    return res.status(500).json({ ok: false, error: 'Failed to retrieve support tickets.' });
  }
});

module.exports = router;
