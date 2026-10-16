'use strict';

const { env } = require('../config/env');

/**
 * API key authentication middleware.
 * Expects header:  Authorization: Bearer <API_SECRET_KEY>
 * In dev mode this is bypassed for convenience (NODE_ENV !== 'production').
 */
function requireAuth(req, res, next) {
  if (env.NODE_ENV !== 'production') return next();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || token !== env.API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized — invalid or missing API key.' });
  }
  next();
}

module.exports = { requireAuth };
