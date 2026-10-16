'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');

// POST /api/whatsapp/send — Send a WhatsApp message via Meta Cloud API
router.post('/send', requireAuth, whatsappController.send);

// POST /api/whatsapp/webhook — Meta webhook verification + message receive
router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.receiveWebhook);

module.exports = router;
