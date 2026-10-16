'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const customerController = require('../controllers/customerController');

router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.CUSTOMERS_VIEW), customerController.list);
router.post('/bulk', requirePermission(PERMISSIONS.CUSTOMERS_MANAGE), customerController.bulkUpsert);
router.get('/:id', requirePermission(PERMISSIONS.CUSTOMERS_VIEW), customerController.getById);
router.post('/', requirePermission(PERMISSIONS.CUSTOMERS_MANAGE), customerController.create);
router.put('/:id', requirePermission(PERMISSIONS.CUSTOMERS_MANAGE), customerController.update);
router.delete('/:id', requirePermission(PERMISSIONS.CUSTOMERS_MANAGE), customerController.remove);

module.exports = router;
