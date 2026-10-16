'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const vendorController = require('../controllers/vendorController');

router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.FINANCE_VIEW), vendorController.list);
router.post('/bulk', requirePermission(PERMISSIONS.FINANCE_UPDATE), vendorController.bulkUpsert);
router.get('/:id', requirePermission(PERMISSIONS.FINANCE_VIEW), vendorController.getById);
router.post('/', requirePermission(PERMISSIONS.FINANCE_UPDATE), vendorController.create);
router.put('/:id', requirePermission(PERMISSIONS.FINANCE_UPDATE), vendorController.update);
router.delete('/:id', requirePermission(PERMISSIONS.FINANCE_UPDATE), vendorController.remove);

module.exports = router;
