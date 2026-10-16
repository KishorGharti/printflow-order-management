'use strict';

/**
 * Global Express error handler.
 * Must have 4 parameters so Express recognises it as an error handler.
 */
const systemMonitor = require('../utils/systemMonitor');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message || err);
  try {
    systemMonitor.recordError(err, req);
  } catch (_) {}

  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal server error'
      : err.message || 'Something went wrong';

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
