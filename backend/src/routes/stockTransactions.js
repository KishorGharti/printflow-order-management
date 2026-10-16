'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const stockTransactionController = require('../controllers/stockTransactionController');

router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.STOCK_VIEW), stockTransactionController.list);
router.post('/bulk', requirePermission(PERMISSIONS.STOCK_UPDATE), stockTransactionController.bulkUpsert);
router.post('/', requirePermission(PERMISSIONS.STOCK_UPDATE), stockTransactionController.create);

module.exports = router;
