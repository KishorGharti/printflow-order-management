'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const pricingController = require('../controllers/pricingController');

router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.PRODUCTS_VIEW), pricingController.list);
router.post('/bulk', requirePermission(PERMISSIONS.PRODUCTS_MANAGE), pricingController.bulkUpsert);
router.post('/', requirePermission(PERMISSIONS.PRODUCTS_MANAGE), pricingController.setPrice);
router.delete('/', requirePermission(PERMISSIONS.PRODUCTS_MANAGE), pricingController.remove);

module.exports = router;
