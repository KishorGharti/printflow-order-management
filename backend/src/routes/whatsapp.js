'use strict';

const express = require('express');
const router = express.Router();
const { authenticateUser, requirePermission } = require('../middleware/rbac');
const { PERMISSIONS } = require('../config/permissions');
const whatsappController = require('../controllers/whatsappController');

// POST /api/whatsapp/send — Send a WhatsApp message via Meta Cloud API (signed-in shop users only)
router.post('/send', authenticateUser, requirePermission(PERMISSIONS.ORDERS_VIEW), whatsappController.send);

// POST /api/whatsapp/webhook — Meta webhook verification + message receive
router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.receiveWebhook);

module.exports = router;
