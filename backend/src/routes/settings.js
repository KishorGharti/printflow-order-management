'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const settingsController = require('../controllers/settingsController');

router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.SETTINGS_VIEW), settingsController.getSettings);
router.put('/', requirePermission(PERMISSIONS.SETTINGS_MANAGE), settingsController.updateSettings);
router.post('/bulk', requirePermission(PERMISSIONS.SETTINGS_MANAGE), settingsController.bulkUpsert);

module.exports = router;
