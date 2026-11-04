'use strict';

const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developerController');
const { authenticateUser, requireDeveloperAccess } = require('../middleware/rbac');

// ── Public Developer Authentication & Error Reporting Routes ──
router.post('/auth/login', developerController.developerLogin);
router.post('/auth/verify-mfa', developerController.verifyDeveloperMfa);
router.post('/errors/report', developerController.reportFrontendError);
router.post('/report-error', developerController.reportFrontendError);

// ── Protected Developer Routes ──
router.use(authenticateUser);
router.use(requireDeveloperAccess);

// Developer Profile
router.get('/auth/me', developerController.getDeveloperProfile);

// 1. Overview / Server Status & Logs
router.get('/server-status', developerController.getServerStatus);
router.get('/logs', developerController.getLogs);

// 2. Database / Data
router.get('/database/health', developerController.getDatabaseHealth);
router.get('/database/backup', developerController.backupDatabase);
router.post('/database/restore', developerController.restoreDatabase);
router.post('/database/run-migrations', developerController.runMigrations);
// Point 5: SQL Playground & Query Inspector
router.get('/database/saved-queries', developerController.getSavedQueries);
router.post('/database/query', developerController.executeSafeQuery);
// Point 8: Automated Scheduled Backups
router.get('/database/automated-backups', developerController.getAutomatedBackups);
router.post('/database/automated-backups/run-now', developerController.runAutomatedBackupNow);
router.get('/database/automated-backups/:filename', developerController.downloadAutomatedBackup);
router.get('/database/automated-backups/:filename/download', developerController.downloadAutomatedBackup);

// 3. Security
router.get('/security/overview', developerController.getSecurityOverview);
router.post('/security/revoke-sessions', developerController.revokeSessions);
router.post('/security/revoke-user-session/:id', developerController.revokeUserSession);
router.put('/security/settings', developerController.updateSecuritySettings);

// Point 7: Real-Time Crash & Error Trace Viewer
router.get('/errors', developerController.getErrorLogs);
router.post('/errors/:id/resolve', developerController.resolveErrorLog);
router.patch('/errors/:id/resolve', developerController.resolveErrorLog);
router.delete('/errors/clear', developerController.clearErrorLogs);
router.delete('/errors/resolved', developerController.clearErrorLogs);

// 4. System Settings
router.get('/system-settings', developerController.getSystemSettings);
router.put('/system-settings', developerController.updateSystemSettings);

// 5. Support & Announcements
router.get('/support/tickets', developerController.getSupportTickets);
router.post('/support/tickets', developerController.createSupportTicket);
router.patch('/support/tickets/:id', developerController.updateSupportTicket);
router.get('/support/announcements', developerController.getAnnouncements);
router.post('/support/announcements', developerController.createAnnouncement);
router.delete('/support/announcements/:id', developerController.deleteAnnouncement);
router.post('/support/broadcast', developerController.broadcastSystemNotification);

// Legacy and Client Management Routes
router.get('/stats', developerController.getStats);
router.get('/clients', developerController.getClients);
router.get('/clients/presence', developerController.getClientPresence);
router.get('/clients/:id', developerController.getClientById);
router.post('/clients', developerController.createClient);
router.put('/clients/:id', developerController.updateClient);
router.patch('/clients/:id/status', developerController.toggleClientStatus);
router.post('/clients/:id/reset-password', developerController.resetClientPassword);
router.post('/clients/:id/unlock-job-numbering', developerController.unlockClientJobNumbering);
router.post('/clients/:id/unlock-invoice-numbering', developerController.unlockClientInvoiceNumbering);
router.delete('/clients/:id', developerController.deleteClient);
// Point 3: Subscription & License Management
router.patch('/clients/:id/subscription', developerController.updateClientSubscription);
router.put('/clients/:id/subscription', developerController.updateClientSubscription);

router.get('/audit-logs', developerController.getAuditLogs);
router.get('/support', developerController.getSupportTickets);
router.patch('/support/:id', developerController.updateSupportTicket);
router.get('/settings', developerController.getSettings);
router.put('/settings', developerController.updateSettings);

// Multi-Tenant Businesses & Business Developer Settings
router.get('/businesses', developerController.getBusinesses);
router.get('/businesses/:businessId', developerController.getBusinessById);
router.get('/businesses/:businessId/settings', developerController.getBusinessDeveloperSettings);
router.put('/businesses/:businessId/settings', developerController.updateBusinessDeveloperSettings);

module.exports = router;
