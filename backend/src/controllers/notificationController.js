'use strict';

const { getNotificationsForRole, markNotificationAsRead, markAllNotificationsAsRead } = require('../services/notificationService');
const { getTenantBusinessId } = require('../middleware/rbac');

/** GET /api/notifications */
const list = async (req, res, next) => {
  try {
    const businessId = getTenantBusinessId(req);
    const role = req.user?.role || 'reception';
    const limit = Number(req.query.limit || 50);

    const notifications = await getNotificationsForRole(businessId, role, limit);
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/notifications/:id/read */
const markRead = async (req, res, next) => {
  try {
    const businessId = getTenantBusinessId(req);
    const updated = await markNotificationAsRead(req.params.id, businessId);
    if (!updated) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/** PUT /api/notifications/read-all */
const markAllRead = async (req, res, next) => {
  try {
    const businessId = getTenantBusinessId(req);
    const role = req.user?.role || 'reception';
    const count = await markAllNotificationsAsRead(businessId, role);
    res.json({ ok: true, count });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, markRead, markAllRead };
