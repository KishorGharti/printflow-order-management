'use strict';

const express = require('express');
const cors    = require('cors');
require('dotenv').config(); // Load env vars before anything else

const { env }                        = require('./config/env');
const { connectDB, isDBConnected }   = require('./config/db');
const { isConfigured: isCloudinaryConfigured } = require('./config/cloudinary');
const { initCron }                   = require('./services/cronService');
const { initBackupScheduler }        = require('./services/backupScheduler');
const { crashReporterMiddleware }    = require('./utils/crashReporter');
const { errorHandler }               = require('./middleware/errorHandler');
const { dynamicRateLimiter, maintenanceModeMiddleware } = require('./services/securityPolicyService');
const logger                         = require('./utils/logger');

// Routes
const authRoutes             = require('./routes/auth');
const notificationRoutes     = require('./routes/notifications');
const orderRoutes            = require('./routes/orders');
const customerRoutes         = require('./routes/customers');
const productRoutes          = require('./routes/products');
const whatsappRoutes         = require('./routes/whatsapp');
const uploadRoutes           = require('./routes/upload');
const expenseRoutes          = require('./routes/expenses');
const teamRoutes             = require('./routes/team');
const stockRoutes            = require('./routes/stock');
const stockTransactionRoutes = require('./routes/stockTransactions');
const vendorRoutes           = require('./routes/vendors');
const settingsRoutes         = require('./routes/settings');
const pricingRoutes          = require('./routes/pricing');
const statsRoutes            = require('./routes/stats');
const developerRoutes        = require('./routes/developer');
const backupRoutes           = require('./routes/backup');
const supportRoutes          = require('./routes/support');

const app = express();

// ─── CORS ─────────────────────────────────────────────────
const allowedOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const systemMonitor = require('./utils/systemMonitor');

// Request logger & monitor
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    try {
      const elapsed = Date.now() - start;
      systemMonitor.recordRequest(req, res, elapsed);
    } catch (_) {}
  });
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ─── Health Check ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    service:   'print-ghar-backend',
    db:        isDBConnected() ? 'connected' : 'connecting_or_error',
    cloudinary: isCloudinaryConfigured() ? 'connected' : 'pending_api_key',
  });
});

// ─── Dynamic API Rate Limiter ─────────────────────────────
app.use(dynamicRateLimiter);

// ─── Maintenance Mode Interceptor ─────────────────────────
app.use(maintenanceModeMiddleware);

// ─── API Routes ───────────────────────────────────────────
app.use('/api/auth',              authRoutes);
app.use('/api/notifications',     notificationRoutes);
app.use('/api/orders',            orderRoutes);
app.use('/api/customers',         customerRoutes);
app.use('/api/products',          productRoutes);
app.use('/api/expenses',          expenseRoutes);
app.use('/api/team',              teamRoutes);
app.use('/api/stock',             stockRoutes);
app.use('/api/stock-transactions', stockTransactionRoutes);
app.use('/api/vendors',           vendorRoutes);
app.use('/api/settings',          settingsRoutes);
app.use('/api/pricing',           pricingRoutes);
app.use('/api/stats',             statsRoutes);
app.use('/api/whatsapp',          whatsappRoutes);
app.use('/api/upload',            uploadRoutes);
app.use('/api/developer',         developerRoutes);
app.use('/api/backup',            backupRoutes);
app.use('/api/support',           supportRoutes);

// ─── 404 ──────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global Error Handler ─────────────────────────────────
app.use(crashReporterMiddleware);
app.use(errorHandler);

// ─── Boot ─────────────────────────────────────────────────
const PORT = env.PORT || 3001;

(async () => {
  await connectDB();         // Connect to PostgreSQL
  initCron();                // Start automated monthly ledger cron
  initBackupScheduler();     // Start automated daily database backup scheduler

  app.listen(PORT, () => {
    logger.info(`🚀 Print Ghar Backend  →  http://localhost:${PORT}`);
    logger.info(`   Environment : ${env.NODE_ENV}`);
    logger.info(`   Database    : PostgreSQL (printflow)`);
    logger.info(`   Cloudinary  : ${isCloudinaryConfigured() ? 'Active' : 'Pending API key'}`);
  });
})();

module.exports = app;
