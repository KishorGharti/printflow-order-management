import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateMonthlyLedgerPdf } from '../backend/src/utils/pdfGenerator.js';

test('1-Year Monthly Backup Local Download & Cloudinary Purge Lifecycle', async (t) => {
  const distApp = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
  const uploadRoutes = fs.readFileSync(new URL('../backend/src/routes/upload.js', import.meta.url), 'utf8');
  const uploadController = fs.readFileSync(new URL('../backend/src/controllers/uploadController.js', import.meta.url), 'utf8');
  const cronService = fs.readFileSync(new URL('../backend/src/services/cronService.js', import.meta.url), 'utf8');
  const cloudinaryConfig = fs.readFileSync(new URL('../backend/src/config/cloudinary.js', import.meta.url), 'utf8');
  const monthlyReportModel = fs.readFileSync(new URL('../backend/src/models/MonthlyReport.js', import.meta.url), 'utf8');

  // 1. MonthlyReport Schema Verification
  assert.ok(monthlyReportModel.includes("year:"), 'MonthlyReport must include year field');
  assert.ok(monthlyReportModel.includes("isArchivedLocally:"), 'MonthlyReport must include isArchivedLocally field');
  assert.ok(monthlyReportModel.includes("isDeletedFromCloud:"), 'MonthlyReport must include isDeletedFromCloud field');
  assert.ok(monthlyReportModel.includes("cloudCleanupStatus:"), 'MonthlyReport must include cloudCleanupStatus field');

  // 2. Automated Monthly PDF Generation Verification
  assert.ok(cronService.includes('generateMonthlyLedgerPdf'), 'cronService must use generateMonthlyLedgerPdf');
  assert.ok(cronService.includes('Print_Ghar_Monthly_Ledger_'), 'cronService must upload monthly ledger PDF');

  const samplePdf = await generateMonthlyLedgerPdf({
    month: '2026-03',
    totalRevenue: 35000,
    orderCount: 3,
    orders: [
      { orderNumber: 'JOB-201', customerName: 'Apex Graphic', totalAmount: 12000, paymentMethod: 'Cash', paymentStatus: 'Paid', status: 'Done' },
      { orderNumber: 'JOB-202', customerName: 'Vision Media', totalAmount: 23000, paymentMethod: 'Online', paymentStatus: 'Paid', status: 'Done' }
    ]
  });
  assert.ok(Buffer.isBuffer(samplePdf), 'generateMonthlyLedgerPdf must return a Buffer');
  assert.ok(samplePdf.length > 500, 'generateMonthlyLedgerPdf buffer must have content');
  assert.strictEqual(samplePdf.slice(0, 4).toString(), '%PDF', 'generateMonthlyLedgerPdf must produce valid PDF binary');

  // 3. Cloudinary Bulk Helpers Verification
  assert.ok(cloudinaryConfig.includes('deleteResources('), 'cloudinary config must export deleteResources');
  assert.ok(cloudinaryConfig.includes('deleteResourcesByPrefix('), 'cloudinary config must export deleteResourcesByPrefix');

  // 4. Cron Service Lifecycle Check
  assert.ok(cronService.includes('getAnnualBackupSummaries'), 'cronService must export getAnnualBackupSummaries');
  assert.ok(cronService.includes('checkAnnualRollovers'), 'cronService must export checkAnnualRollovers');

  // 5. Controller Methods Verification
  assert.ok(uploadController.includes('getAnnualBackups'), 'uploadController must export getAnnualBackups');
  assert.ok(uploadController.includes('downloadAnnualBackup'), 'uploadController must export downloadAnnualBackup');
  assert.ok(uploadController.includes('purgeAnnualCloudBackup'), 'uploadController must export purgeAnnualCloudBackup');

  // 6. Route Endpoints Verification
  assert.ok(uploadRoutes.includes('/annual-backups'), 'upload routes must register GET /annual-backups');
  assert.ok(uploadRoutes.includes('/annual-backup/:year/download'), 'upload routes must register GET /annual-backup/:year/download');
  assert.ok(uploadRoutes.includes('/annual-backup/:year/purge-cloud'), 'upload routes must register POST /annual-backup/:year/purge-cloud');

  // 7. Frontend storageService Methods Verification
  assert.ok(distApp.includes('getAnnualBackupStatus()'), 'dist/app.js storageService must contain getAnnualBackupStatus');
  assert.ok(distApp.includes('downloadAnnualBackupPackage('), 'dist/app.js storageService must contain downloadAnnualBackupPackage');
  assert.ok(distApp.includes('purgeAnnualCloudBackup('), 'dist/app.js storageService must contain purgeAnnualCloudBackup');

  // 8. Notification Bell & UI Integration Verification
  assert.ok(distApp.includes('Annual Cloud Backup (1-Year Rollover)'), 'dist/app.js must render Annual Cloud Backup rollover section in bell panel');
  assert.ok(distApp.includes('📥 Download 1-Year Backup'), 'dist/app.js must render Download 1-Year Backup button');
  assert.ok(distApp.includes('🧹 Purge Cloudinary'), 'dist/app.js must render Purge Cloudinary button');
});
