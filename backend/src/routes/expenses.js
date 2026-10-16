'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const expenseController = require('../controllers/expenseController');

router.use(authenticateUser);

// Bulk upsert must be BEFORE /:id to avoid route conflict
router.post('/bulk', requirePermission(PERMISSIONS.FINANCE_UPDATE), expenseController.bulkUpsert);

router.get('/', requirePermission(PERMISSIONS.FINANCE_VIEW), expenseController.list);
router.get('/:id', requirePermission(PERMISSIONS.FINANCE_VIEW), expenseController.getById);
router.post('/', requirePermission(PERMISSIONS.FINANCE_UPDATE), expenseController.create);
router.put('/:id', requirePermission(PERMISSIONS.FINANCE_UPDATE), expenseController.update);
router.post('/:id/payments', requirePermission(PERMISSIONS.FINANCE_UPDATE), expenseController.recordPayment);
router.delete('/:id', requirePermission(PERMISSIONS.FINANCE_UPDATE), expenseController.remove);

module.exports = router;
