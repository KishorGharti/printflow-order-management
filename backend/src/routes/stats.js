'use strict';

const express = require('express');
const router  = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const { getFinancialStats } = require('../controllers/statsController');

router.use(authenticateUser);

router.get('/financial', requirePermission(PERMISSIONS.FINANCE_VIEW), getFinancialStats);

module.exports = router;
