'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const uploadController = require('../controllers/uploadController');

// Configure Multer for in-memory upload (limit 50MB per design file)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

router.post('/design', requireAuth, upload.single('file'), uploadController.uploadDesign);
router.post('/logo', requireAuth, upload.single('file'), uploadController.uploadLogo);
router.post('/company-design', requireAuth, upload.single('file'), uploadController.uploadCompanyDesign);
router.delete('/company-design', requireAuth, uploadController.deleteCompanyDesign);
router.post('/company-design/delete', requireAuth, uploadController.deleteCompanyDesign);
router.post('/ledger-monthly', requireAuth, upload.single('file'), uploadController.uploadMonthlyLedger);
router.post('/trigger-monthly-archive', requireAuth, uploadController.triggerMonthlyArchive);
router.get('/monthly-reports', requireAuth, uploadController.listMonthlyReports);
router.get('/annual-backups', requireAuth, uploadController.getAnnualBackups);
router.get('/annual-backup/:year/download', requireAuth, uploadController.downloadAnnualBackup);
router.post('/annual-backup/:year/purge-cloud', requireAuth, uploadController.purgeAnnualCloudBackup);
router.delete('/file', requireAuth, uploadController.deleteFile);

module.exports = router;
