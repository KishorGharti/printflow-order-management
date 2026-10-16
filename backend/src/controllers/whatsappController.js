'use strict';

const { env } = require('../config/env');
const logger = require('../utils/logger');

/**
 * POST /api/whatsapp/send
 * Body: { to: string, message: string }
 * Sends a text message via the Meta WhatsApp Cloud API.
 */
const send = async (req, res, next) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: '"to" (phone number) and "message" are required.' });
    }

    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      return res.status(503).json({
        error: 'WhatsApp API credentials not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env',
      });
    }

    const cleanPhone = String(to).replace(/\D/g, '');
    const apiUrl = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: { preview_url: false, body: message },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('WhatsApp API error', data);
      return res.status(502).json({ error: 'WhatsApp API returned an error.', details: data });
    }

    res.json({ ok: true, messageId: data?.messages?.[0]?.id });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/whatsapp/webhook
 * Meta webhook verification handshake.
 */
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.API_SECRET_KEY) {
    logger.info('WhatsApp webhook verified.');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
};

/**
 * POST /api/whatsapp/webhook
 * Receives incoming WhatsApp messages (extend as needed).
 */
const receiveWebhook = (req, res) => {
  logger.info('WhatsApp webhook event received', JSON.stringify(req.body).slice(0, 200));
  // TODO: Parse req.body.entry[0].changes[0].value.messages and handle incoming messages
  res.sendStatus(200);
};

module.exports = { send, verifyWebhook, receiveWebhook };
