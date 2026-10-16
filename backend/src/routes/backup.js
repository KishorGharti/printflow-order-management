'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const backupController = require('../controllers/backupController');

router.use(authenticateUser);

// Owner + Reception may download (sign) a backup; only the Owner may restore (enforced in controller).
router.post('/sign', requirePermission(PERMISSIONS.SETTINGS_MANAGE), backupController.sign);
router.post('/verify', requirePermission(PERMISSIONS.SETTINGS_MANAGE), backupController.verify);

module.exports = router;
