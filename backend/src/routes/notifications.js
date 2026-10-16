'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const notificationController = require('../controllers/notificationController');

router.get('/', authenticateUser, requirePermission(PERMISSIONS.NOTIFICATIONS_VIEW), notificationController.list);
router.put('/read-all', authenticateUser, requirePermission(PERMISSIONS.NOTIFICATIONS_VIEW), notificationController.markAllRead);
router.put('/:id/read', authenticateUser, requirePermission(PERMISSIONS.NOTIFICATIONS_VIEW), notificationController.markRead);

module.exports = router;
