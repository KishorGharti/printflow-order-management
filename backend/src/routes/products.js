'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const productController = require('../controllers/productController');

router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.PRODUCTS_VIEW), productController.list);
router.post('/bulk', requirePermission(PERMISSIONS.PRODUCTS_MANAGE), productController.bulkUpsert);
router.get('/:id', requirePermission(PERMISSIONS.PRODUCTS_VIEW), productController.getById);
router.post('/', requirePermission(PERMISSIONS.PRODUCTS_MANAGE), productController.create);
router.put('/:id', requirePermission(PERMISSIONS.PRODUCTS_MANAGE), productController.update);
router.delete('/:id', requirePermission(PERMISSIONS.PRODUCTS_MANAGE), productController.remove);

module.exports = router;
