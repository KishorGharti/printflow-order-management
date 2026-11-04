'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const orderController = require('../controllers/orderController');

router.use(authenticateUser);

// Bulk upsert must be BEFORE /:id to avoid route conflict
router.post('/bulk', requirePermission(PERMISSIONS.ORDERS_CREATE), orderController.bulkUpsert);
// Server-side invoice number allocation (atomic, retry-safe)
router.post('/invoice-number', requirePermission(PERMISSIONS.ORDERS_UPDATE), orderController.assignInvoiceNumber);
// Put an order's consumed materials back into stock (PIN of an authorized team member)
router.post('/:id/restore-stock', requirePermission(PERMISSIONS.STOCK_MANAGE), orderController.restoreStock);

router.get('/',      requirePermission(PERMISSIONS.ORDERS_VIEW), orderController.list);
router.get('/:id',   requirePermission(PERMISSIONS.ORDERS_VIEW), orderController.getById);
router.get('/:id/repeats', requirePermission(PERMISSIONS.ORDERS_VIEW), orderController.listRepeats);
router.post('/',     requirePermission(PERMISSIONS.ORDERS_CREATE), orderController.create);
router.put('/:id',   requirePermission(PERMISSIONS.ORDERS_UPDATE), orderController.update);
router.delete('/:id', requirePermission(PERMISSIONS.ORDERS_CANCEL), orderController.remove);

module.exports = router;
