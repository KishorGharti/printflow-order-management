'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const teamController = require('../controllers/teamController');

router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.EMPLOYEES_VIEW), teamController.list);
router.post('/bulk', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), teamController.bulkUpsert);
router.get('/:id', requirePermission(PERMISSIONS.EMPLOYEES_VIEW), teamController.getById);
router.post('/', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), teamController.create);
router.put('/:id', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), teamController.update);
router.delete('/:id', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), teamController.remove);

module.exports = router;
