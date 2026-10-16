'use strict';

const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs } = require('../config/dbHelpers');
const logger = require('../utils/logger');

/**
 * Creates a role-based work notification in PostgreSQL
 */
async function createWorkNotification({
  businessId = 'global_settings',
  targetRole,
  orderId = '',
  orderNumber = '',
  title,
  message,
  stage = '',
}) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO work_notifications (business_id, target_role, order_id, order_number, title, message, stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [businessId, targetRole, String(orderId), String(orderNumber), title, message, stage]
    );
    logger.info(`🔔 Work notification sent to role [${targetRole}]: "${title}" for Order #${orderNumber}`);
    return rowToDoc(rows[0]);
  } catch (err) {
    logger.error('Failed to create work notification:', err.message);
    return null;
  }
}

/**
 * Lists notifications for a given role within a business tenant
 */
async function getNotificationsForRole(businessId, role, limit = 50) {
  try {
    // Owner and Reception receive both Reception and general notifications
    const targetRoles = (role === 'owner' || role === 'reception')
      ? ['reception', 'owner', 'all']
      : [role, 'all'];

    const placeholders = targetRoles.map((_, i) => `$${i + 2}`).join(', ');
    const { rows } = await pool.query(
      `SELECT * FROM work_notifications
       WHERE (business_id = $1 OR business_id = 'global_settings') AND target_role IN (${placeholders})
       ORDER BY created_at DESC
       LIMIT $${targetRoles.length + 2}`,
      [businessId, ...targetRoles, Number(limit)]
    );
    return rowsToDocs(rows);
  } catch (err) {
    logger.error('Failed to list notifications:', err.message);
    return [];
  }
}

/**
 * Marks a notification as read
 */
async function markNotificationAsRead(id, businessId) {
  try {
    const { rows } = await pool.query(
      `UPDATE work_notifications
       SET is_read = true
       WHERE id = $1 AND (business_id = $2 OR business_id = 'global_settings' OR $2 = 'global_settings')
       RETURNING *`,
      [id, businessId]
    );
    return rows.length ? rowToDoc(rows[0]) : null;
  } catch (err) {
    logger.error('Failed to mark notification as read:', err.message);
    return null;
  }
}

/**
 * Marks all notifications for a given role/tenant as read
 */
async function markAllNotificationsAsRead(businessId, role) {
  try {
    const targetRoles = (role === 'owner' || role === 'reception')
      ? ['reception', 'owner', 'all']
      : [role, 'all'];

    const placeholders = targetRoles.map((_, i) => `$${i + 2}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE work_notifications
       SET is_read = true
       WHERE (business_id = $1 OR business_id = 'global_settings')
         AND target_role IN (${placeholders})
         AND is_read = false
       RETURNING *`,
      [businessId, ...targetRoles]
    );
    return rows.length;
  } catch (err) {
    logger.error('Failed to mark all notifications as read:', err.message);
    return 0;
  }
}

module.exports = {
  createWorkNotification,
  getNotificationsForRole,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
