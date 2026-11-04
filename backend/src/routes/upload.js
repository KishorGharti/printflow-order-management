'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateUser, requirePermission, requireDeveloperAccess } = require('../middleware/rbac');
const { PERMISSIONS, hasPermission } = require('../config/permissions');
const uploadController = require('../controllers/uploadController');

// Configure Multer for in-memory upload (limit 50MB per design file)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});
// Logos and bill/chalan designs are images only, and small.
const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) return cb(null, true);
    const err = new Error('Only image files can be used for the logo or bill design.');
    err.statusCode = 400;
    cb(err);
  },
});

// Every upload route needs a signed-in user of the shop (same login as the rest of the app).
router.use(authenticateUser);

const canWorkOnOrders = (req, res, next) => {
  const allowed = [PERMISSIONS.ORDERS_UPDATE, PERMISSIONS.ORDERS_DESIGN, PERMISSIONS.PRODUCTION_UPDATE];
  if (req.user && req.user.isActive && allowed.some((p) => hasPermission(req.user.role, p))) return next();
  return res.status(403).json({ error: 'Forbidden: you do not have permission to manage order files.' });
};
const manageSettings = requirePermission(PERMISSIONS.SETTINGS_MANAGE);

router.post('/design', canWorkOnOrders, upload.single('file'), uploadController.uploadDesign);
router.post('/logo', manageSettings, imageUpload.single('file'), uploadController.uploadLogo);
router.post('/company-design', manageSettings, imageUpload.single('file'), uploadController.uploadCompanyDesign);
router.delete('/company-design', manageSettings, uploadController.deleteCompanyDesign);
router.post('/company-design/delete', manageSettings, uploadController.deleteCompanyDesign);
// Monthly ledger archiving is run by the server itself; by hand only from the developer console.
router.post('/ledger-monthly', requireDeveloperAccess, upload.single('file'), uploadController.uploadMonthlyLedger);
router.post('/trigger-monthly-archive', requireDeveloperAccess, uploadController.triggerMonthlyArchive);
router.get('/monthly-reports', requirePermission(PERMISSIONS.REPORTS_VIEW), uploadController.listMonthlyReports);
router.get('/annual-backups', manageSettings, uploadController.getAnnualBackups);
router.get('/annual-backup/:year/download', manageSettings, uploadController.downloadAnnualBackup);
router.post('/annual-backup/:year/purge-cloud', manageSettings, uploadController.purgeAnnualCloudBackup);
router.delete('/file', canWorkOnOrders, uploadController.deleteFile);

module.exports = router;
