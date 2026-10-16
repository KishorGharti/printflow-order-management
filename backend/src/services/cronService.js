'use strict';

const cron = require('node-cron');
const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs } = require('../config/dbHelpers');
const { uploadBuffer, isConfigured } = require('../config/cloudinary');
const { generateMonthlyLedgerPdf } = require('../utils/pdfGenerator');
const logger = require('../utils/logger');

/**
 * Generates and archives monthly ledger to Cloudinary as an automated PDF statement.
 *
 * @param {string} [targetMonth] - 'YYYY-MM'
 */
async function archiveMonthlyLedger(targetMonth) {
  try {
    let month = targetMonth;
    if (!month) {
      // Default to previous month
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      month = d.toISOString().slice(0, 7);
    }

    const startDate = `${month}-01`;
    const endDate   = `${month}-31`;

    logger.info(`📅 Starting Automated Monthly PDF Ledger Archival for ${month}...`);

    // Fetch all orders for the month
    const { rows: orderRows } = await pool.query(
      `SELECT * FROM orders WHERE order_date >= $1 AND order_date <= $2 ORDER BY order_date ASC`,
      [startDate, endDate]
    );
    const orders = rowsToDocs(orderRows);

    let totalRevenue = 0;
    for (const ord of orders) {
      if (ord.status !== 'Cancelled') {
        totalRevenue += Number(ord.totalAmount || 0);
      }
    }

    const summary = {
      month,
      title: `Financial Ledger & Balance Summary - ${month}`,
      generatedAt: new Date().toISOString(),
      orderCount: orders.length,
      totalRevenue,
      periodStart: startDate,
      periodEnd: endDate,
    };

    let pdfUrl  = '';
    let publicId = '';

    // Generate lightweight JSON ledger payload for the month (~5-15 KB)
    const ledgerPayload = {
      app: 'print-ghar-order-manager-monthly-backup',
      version: 1,
      format: 'json',
      month,
      year: month.slice(0, 4),
      title: `Print Ghar — Monthly Financial Ledger (${month})`,
      periodStart: startDate,
      periodEnd: endDate,
      generatedAt: new Date().toISOString(),
      summary: {
        orderCount: orders.length,
        totalRevenue,
      },
      orders,
    };
    const jsonBuffer = Buffer.from(JSON.stringify(ledgerPayload, null, 2), 'utf-8');

    // Upload the JSON buffer to Cloudinary
    if (isConfigured()) {
      const uploadRes = await uploadBuffer(jsonBuffer, {
        folder:       `printghar/monthly_reports/${month}`,
        resourceType: 'raw',
        publicId:     `Print_Ghar_Monthly_Ledger_${month}.json`,
        tags:         ['monthly_report', 'ledger_json', month],
      });
      pdfUrl   = uploadRes.secure_url;
      publicId = uploadRes.public_id;
      logger.info(`✅ Monthly JSON Ledger archived to Cloudinary: ${pdfUrl} (${jsonBuffer.length} bytes)`);
    } else {
      logger.warn('Cloudinary not configured. Mocking monthly JSON upload.');
      pdfUrl   = `https://res.cloudinary.com/mock/raw/upload/printghar/monthly_reports/${month}/Print_Ghar_Monthly_Ledger_${month}.json`;
      publicId = `printghar/monthly_reports/${month}/Print_Ghar_Monthly_Ledger_${month}`;
    }

    const year = month.slice(0, 4);

    const { rows: reportRows } = await pool.query(
      `INSERT INTO monthly_reports
         (month, year, title, period_start, period_end, total_revenue, order_count,
          cloudinary_pdf_url, cloudinary_public_id, summary_data, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (month) DO UPDATE SET
         year                 = EXCLUDED.year,
         title                = EXCLUDED.title,
         period_start         = EXCLUDED.period_start,
         period_end           = EXCLUDED.period_end,
         total_revenue        = EXCLUDED.total_revenue,
         order_count          = EXCLUDED.order_count,
         cloudinary_pdf_url   = EXCLUDED.cloudinary_pdf_url,
         cloudinary_public_id = EXCLUDED.cloudinary_public_id,
         summary_data         = EXCLUDED.summary_data,
         generated_at         = NOW(),
         updated_at           = NOW()
       RETURNING *`,
      [
        month,
        year,
        `Monthly Financial Report - ${month}`,
        startDate,
        endDate,
        totalRevenue,
        orders.length,
        pdfUrl,
        publicId,
        JSON.stringify(summary),
      ]
    );

    const report = rowToDoc(reportRows[0]);

    // Check if any previous year is now complete and ready for local archival
    await checkAnnualRollovers();

    return report;
  } catch (err) {
    logger.error('archiveMonthlyLedger error:', err);
    throw err;
  }
}

/**
 * Returns annual backup summaries grouped by year.
 */
async function getAnnualBackupSummaries(businessId = 'global_settings') {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM monthly_reports WHERE business_id = $1 ORDER BY month ASC`,
      [businessId]
    );
    const reports = rowsToDocs(rows);
    const currentYear = new Date().getFullYear().toString();
    const yearMap = new Map();

    for (const rep of reports) {
      const yr = rep.year || (rep.month || '').slice(0, 4);
      if (!yr) continue;

      if (!yearMap.has(yr)) {
        yearMap.set(yr, {
          year: yr,
          monthCount: 0,
          months: [],
          totalRevenue: 0,
          orderCount: 0,
          hasCloudFiles: false,
          isArchivedLocally: false,
          isDeletedFromCloud: false,
          cloudCleanupStatus: 'ACTIVE',
          isReadyForAnnualArchival: false,
          cloudPublicIds: [],
        });
      }

      const yObj = yearMap.get(yr);
      yObj.monthCount   += 1;
      yObj.totalRevenue += Number(rep.totalRevenue || 0);
      yObj.orderCount   += Number(rep.orderCount || 0);
      yObj.months.push({
        month:               rep.month,
        title:               rep.title,
        totalRevenue:        rep.totalRevenue,
        orderCount:          rep.orderCount,
        cloudinaryPdfUrl:    rep.cloudinaryPdfUrl,
        cloudinaryPublicId:  rep.cloudinaryPublicId,
        isDeletedFromCloud:  rep.isDeletedFromCloud || false,
        isArchivedLocally:   rep.isArchivedLocally  || false,
      });

      if (rep.cloudinaryPublicId && !rep.isDeletedFromCloud) {
        yObj.hasCloudFiles = true;
        yObj.cloudPublicIds.push(rep.cloudinaryPublicId);
      }
      if (rep.isArchivedLocally)  yObj.isArchivedLocally  = true;
      if (rep.isDeletedFromCloud) yObj.isDeletedFromCloud = true;
    }

    const summaries = Array.from(yearMap.values()).map((yObj) => {
      const isPastYear            = yObj.year < currentYear;
      const isFullYear            = yObj.monthCount >= 12;
      const isReadyForAnnualArchival = (isPastYear || isFullYear) && yObj.hasCloudFiles;

      let cloudCleanupStatus = 'ACTIVE';
      if (!yObj.hasCloudFiles && yObj.isDeletedFromCloud) {
        cloudCleanupStatus = 'PURGED_FROM_CLOUD';
      } else if (yObj.isArchivedLocally && yObj.hasCloudFiles) {
        cloudCleanupStatus = 'ARCHIVED_LOCAL';
      }

      return { ...yObj, isReadyForAnnualArchival, cloudCleanupStatus };
    });

    return summaries.sort((a, b) => b.year.localeCompare(a.year));
  } catch (err) {
    logger.error('getAnnualBackupSummaries error:', err);
    return [];
  }
}

/**
 * Checks for completed 1-year backup cycles and logs notification alerts.
 */
async function checkAnnualRollovers() {
  const summaries  = await getAnnualBackupSummaries();
  const readyYears = summaries.filter((s) => s.isReadyForAnnualArchival);

  if (readyYears.length > 0) {
    for (const yr of readyYears) {
      logger.info(`🔔 ANNUAL BACKUP NOTIFICATION: Year ${yr.year} has ${yr.monthCount} monthly backups in Cloudinary. Ready for 1-year local download and Cloudinary purge.`);
    }
  }
}

/**
 * Initializes the automated monthly cron job.
 * Runs on the 1st of every month at 00:05 AM.
 */
function initCron() {
  // '5 0 1 * *' -> At 00:05 on day 1 of the month
  cron.schedule('5 0 1 * *', async () => {
    logger.info('⏰ Triggering scheduled monthly ledger archival job...');
    try {
      await archiveMonthlyLedger();
    } catch (e) {
      logger.error('Cron job error:', e);
    }
  });

  logger.info('🕒 Monthly Ledger Archival Cron scheduled (runs 1st of every month).');
}

module.exports = {
  initCron,
  archiveMonthlyLedger,
  getAnnualBackupSummaries,
  checkAnnualRollovers,
};
