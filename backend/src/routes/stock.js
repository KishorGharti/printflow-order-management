'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const stockController = require('../controllers/stockController');

router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.STOCK_VIEW), stockController.list);
router.post('/bulk', requirePermission(PERMISSIONS.STOCK_MANAGE), stockController.bulkUpsert);
router.get('/:id', requirePermission(PERMISSIONS.STOCK_VIEW), stockController.getById);
router.post('/', requirePermission(PERMISSIONS.STOCK_MANAGE), stockController.create);
router.put('/:id', requirePermission(PERMISSIONS.STOCK_MANAGE), stockController.update);
router.delete('/:id', requirePermission(PERMISSIONS.STOCK_MANAGE), stockController.remove);

module.exports = router;
