'use strict';

const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { rowToDoc, rowsToDocs } = require('../config/dbHelpers');
const { uploadBuffer, deleteResource, deleteResources, deleteResourcesByPrefix, isConfigured } = require('../config/cloudinary');
const { getAnnualBackupSummaries, archiveMonthlyLedger } = require('../services/cronService');
const { getTenantBusinessId } = require('../middleware/rbac');
const logger = require('../utils/logger');

/**
 * Determine resource_type for Cloudinary based on mimetype / extension.
 */
function getResourceType(mimetype = '', ext = '') {
  const e = ext.toLowerCase().replace('.', '');
  if (mimetype.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(e)) {
    return 'image';
  }
  if (mimetype.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv'].includes(e)) {
    return 'video';
  }
  return 'raw'; // PDF, PSD, AI, CDR, ZIP, etc.
}

/**
 * POST /api/upload/design
 * Handles designer / print-ready file uploads to Cloudinary.
 */
const uploadDesign = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { orderId, orderNumber, category = 'Client Reference', uploadedBy = 'Designer' } = req.body;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName) || '';
    const cleanExt = ext.replace('.', '').toLowerCase();
    const resourceType = getResourceType(req.file.mimetype, cleanExt);
    const mediaId = `med_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const folder = orderNumber
      ? `printghar/designs/${orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : 'printghar/designs';

    let cloudinaryResult = null;
    let fileUrl = '';
    let publicId = '';

    if (isConfigured()) {
      cloudinaryResult = await uploadBuffer(req.file.buffer, {
        folder,
        resourceType,
        tags: ['design', orderNumber || 'general'],
      });
      fileUrl = cloudinaryResult.secure_url;
      publicId = cloudinaryResult.public_id;
    } else {
      logger.warn('Cloudinary not configured. Simulating mock upload URL.');
      fileUrl = `https://res.cloudinary.com/mock/image/upload/${mediaId}${ext}`;
      publicId = `mock/${mediaId}`;
    }

    const mediaItem = {
      id: mediaId,
      name: originalName,
      type: req.file.mimetype || 'application/octet-stream',
      size: req.file.size,
      extension: cleanExt,
      category: category === 'Ready to Go' ? 'Ready to Go' : 'Client Reference',
      cloudinaryUrl: fileUrl,
      cloudinaryPublicId: publicId,
      resourceType,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      isDeletedFromCloud: false,
    };

    // If orderId or orderNumber provided, automatically attach to Order in PostgreSQL
    if (orderId || orderNumber) {
      const isUuid = orderId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      const where = orderId
        ? (isUuid ? 'id = $1' : 'local_id = $1')
        : 'order_number = $1';
      const key = orderId || orderNumber;

      try {
        await pool.query(
          `UPDATE orders SET media = COALESCE(media, '[]'::jsonb) || $1::jsonb WHERE ${where}`,
          [JSON.stringify([mediaItem]), key]
        );
      } catch (dbErr) {
        logger.warn(`Could not attach media to order ${key}: ${dbErr.message}`);
      }
    }

    res.status(201).json({
      success: true,
      media: mediaItem,
    });
  } catch (err) {
    logger.error('uploadDesign error:', err);
    next(err);
  }
};

/**
 * POST /api/upload/logo
 * Handles shop branding and logo uploads, delegates to uploadCompanyDesign with target 'logo'.
 */
const uploadLogo = async (req, res, next) => {
  req.body = req.body || {};
  req.body.target = 'logo';
  return uploadCompanyDesign(req, res, next);
};

/**
 * Helper to extract Cloudinary public_id from a secure_url
 */
function extractCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return '';
  const match = url.match(/\/upload\/(?:v\d+\/)?([^.]+)/);
  return match ? match[1] : '';
}

/**
 * POST /api/upload/company-design
 * Uploads bill/chalan company design or branding to Cloudinary,
 * replaces/deletes the previous design if one exists,
 * and saves the new Cloudinary link directly in PostgreSQL database settings.
 */
const uploadCompanyDesign = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const businessKey = getTenantBusinessId(req);
    const target = req.body.target || req.query.target || 'bill'; // 'bill' | 'chalan' | 'logo'
    const folder = 'printghar/branding';
    const timestamp = Date.now();
    const publicId = `${target}_design_${timestamp}`;

    // 1. Fetch current settings to identify existing public_id
    const { rows } = await pool.query('SELECT * FROM settings WHERE key = $1', [businessKey]);
    const currentSettings = rows.length ? rows[0] : null;

    let previousPublicId = req.body.previousPublicId || '';
    if (!previousPublicId && currentSettings) {
      if (target === 'bill') {
        const cfg = currentSettings.bill_reference_config || {};
        previousPublicId = cfg.companyDesignPublicId || extractCloudinaryPublicId(cfg.companyDesign);
      } else if (target === 'chalan') {
        const cfg = currentSettings.chalan_reference_config || {};
        previousPublicId = cfg.companyDesignPublicId || extractCloudinaryPublicId(cfg.companyDesign);
      } else if (target === 'logo') {
        previousPublicId = extractCloudinaryPublicId(currentSettings.shop_logo);
      }
    }

    // 2. If a previous Cloudinary file exists, delete it
    if (previousPublicId && isConfigured()) {
      try {
        await deleteResource(previousPublicId, 'image');
        logger.info(`Deleted previous ${target} design from Cloudinary: ${previousPublicId}`);
      } catch (delErr) {
        logger.warn(`Failed to delete previous ${target} design (${previousPublicId}): ${delErr.message}`);
      }
    }

    // 3. Upload new design to Cloudinary
    let uploadResult = null;
    let url = '';
    let resultPublicId = '';

    if (isConfigured()) {
      uploadResult = await uploadBuffer(req.file.buffer, {
        folder,
        publicId,
        resourceType: 'image',
        tags: ['branding', `${target}_design`],
      });
      url = uploadResult.secure_url;
      resultPublicId = uploadResult.public_id;
    } else {
      url = `https://res.cloudinary.com/mock/image/upload/${folder}/${publicId}.png`;
      resultPublicId = `${folder}/${publicId}`;
    }

    // 4. Save the Cloudinary link to PostgreSQL settings (tenant-scoped)
    let updatedSettings = null;
    if (currentSettings) {
      if (target === 'bill') {
        const currentCfg = currentSettings.bill_reference_config || {};
        const newCfg = {
          ...currentCfg,
          companyDesign: url,
          companyDesignPublicId: resultPublicId,
        };
        const u = await pool.query(
          'UPDATE settings SET bill_reference_config = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
          [JSON.stringify(newCfg), businessKey]
        );
        updatedSettings = rowToDoc(u.rows[0]);
      } else if (target === 'chalan') {
        const currentCfg = currentSettings.chalan_reference_config || {};
        const newCfg = {
          ...currentCfg,
          companyDesign: url,
          companyDesignPublicId: resultPublicId,
          useBillCompanyDesign: false,
        };
        const u = await pool.query(
          'UPDATE settings SET chalan_reference_config = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
          [JSON.stringify(newCfg), businessKey]
        );
        updatedSettings = rowToDoc(u.rows[0]);
      } else if (target === 'logo') {
        const u = await pool.query(
          'UPDATE settings SET shop_logo = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
          [url, businessKey]
        );
        updatedSettings = rowToDoc(u.rows[0]);
      }
    }

    res.status(200).json({
      success: true,
      url,
      publicId: resultPublicId,
      target,
      settings: updatedSettings,
    });
  } catch (err) {
    logger.error('uploadCompanyDesign error:', err);
    next(err);
  }
};

/**
 * DELETE /api/upload/company-design
 * Removes company design from Cloudinary and cleans up settings in DB.
 */
const deleteCompanyDesign = async (req, res, next) => {
  try {
    const businessKey = getTenantBusinessId(req);
    const target = req.body?.target || req.query?.target || 'bill';
    let publicId = req.body?.publicId || req.query?.publicId || '';

    const { rows } = await pool.query('SELECT * FROM settings WHERE key = $1', [businessKey]);
    const currentSettings = rows.length ? rows[0] : null;

    if (!publicId && currentSettings) {
      if (target === 'bill') {
        const cfg = currentSettings.bill_reference_config || {};
        publicId = cfg.companyDesignPublicId || extractCloudinaryPublicId(cfg.companyDesign);
      } else if (target === 'chalan') {
        const cfg = currentSettings.chalan_reference_config || {};
        publicId = cfg.companyDesignPublicId || extractCloudinaryPublicId(cfg.companyDesign);
      } else if (target === 'logo') {
        publicId = extractCloudinaryPublicId(currentSettings.shop_logo);
      }
    }

    if (publicId && isConfigured()) {
      try {
        await deleteResource(publicId, 'image');
        logger.info(`Deleted ${target} design from Cloudinary: ${publicId}`);
      } catch (delErr) {
        logger.warn(`Could not delete from Cloudinary (${publicId}): ${delErr.message}`);
      }
    }

    let updatedSettings = null;
    if (currentSettings) {
      if (target === 'bill') {
        const currentCfg = currentSettings.bill_reference_config || {};
        const newCfg = { ...currentCfg, companyDesign: '', companyDesignPublicId: '' };
        const u = await pool.query(
          'UPDATE settings SET bill_reference_config = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
          [JSON.stringify(newCfg), businessKey]
        );
        updatedSettings = rowToDoc(u.rows[0]);
      } else if (target === 'chalan') {
        const currentCfg = currentSettings.chalan_reference_config || {};
        const newCfg = { ...currentCfg, companyDesign: '', companyDesignPublicId: '', useBillCompanyDesign: false };
        const u = await pool.query(
          'UPDATE settings SET chalan_reference_config = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
          [JSON.stringify(newCfg), businessKey]
        );
        updatedSettings = rowToDoc(u.rows[0]);
      } else if (target === 'logo') {
        const u = await pool.query(
          'UPDATE settings SET shop_logo = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
          ['', businessKey]
        );
        updatedSettings = rowToDoc(u.rows[0]);
      }
    }

    res.status(200).json({
      success: true,
      message: `${target} design removed from Cloudinary and database.`,
      settings: updatedSettings,
    });
  } catch (err) {
    logger.error('deleteCompanyDesign error:', err);
    next(err);
  }
};

/**
 * POST /api/upload/ledger-monthly
 * Handles archiving of monthly financial reports / balance sheets to Cloudinary.
 */
const uploadMonthlyLedger = async (req, res, next) => {
  try {
    const { month, title, periodStart, periodEnd, totalRevenue, totalExpenses, netProfit, orderCount, summaryData } = req.body;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const targetYear = targetMonth.split('-')[0] || new Date().getFullYear().toString();

    let pdfUrl = '';
    let publicId = '';

    if (req.file) {
      const ext = path.extname(req.file.originalname) || '.pdf';
      const resourceType = getResourceType(req.file.mimetype, ext);

      if (isConfigured()) {
        const uploadRes = await uploadBuffer(req.file.buffer, {
          folder: `printghar/monthly_reports/${targetMonth}`,
          resourceType,
          tags: ['ledger', 'monthly_report', targetMonth],
        });
        pdfUrl = uploadRes.secure_url;
        publicId = uploadRes.public_id;
      } else {
        pdfUrl = `https://res.cloudinary.com/mock/raw/upload/printghar/monthly_reports/${targetMonth}/ledger.pdf`;
        publicId = `printghar/monthly_reports/${targetMonth}/ledger`;
      }
    }

    const query = `
      INSERT INTO monthly_reports (
        month, year, title, period_start, period_end, total_revenue, total_expenses,
        net_profit, order_count, cloudinary_pdf_url, cloudinary_public_id, summary_data, generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (month) DO UPDATE SET
        title = EXCLUDED.title,
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        total_revenue = EXCLUDED.total_revenue,
        total_expenses = EXCLUDED.total_expenses,
        net_profit = EXCLUDED.net_profit,
        order_count = EXCLUDED.order_count,
        cloudinary_pdf_url = CASE WHEN EXCLUDED.cloudinary_pdf_url <> '' THEN EXCLUDED.cloudinary_pdf_url ELSE monthly_reports.cloudinary_pdf_url END,
        cloudinary_public_id = CASE WHEN EXCLUDED.cloudinary_public_id <> '' THEN EXCLUDED.cloudinary_public_id ELSE monthly_reports.cloudinary_public_id END,
        summary_data = COALESCE(EXCLUDED.summary_data, monthly_reports.summary_data),
        generated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      targetMonth,
      targetYear,
      title || `Monthly Financial Report - ${targetMonth}`,
      periodStart || `${targetMonth}-01`,
      periodEnd || `${targetMonth}-31`,
      Number(totalRevenue || 0),
      Number(totalExpenses || 0),
      Number(netProfit || 0),
      Number(orderCount || 0),
      pdfUrl || '',
      publicId || '',
      summaryData ? (typeof summaryData === 'string' ? summaryData : JSON.stringify(summaryData)) : null,
    ]);

    const report = rowToDoc(result.rows[0]);

    res.status(200).json({
      success: true,
      report,
    });
  } catch (err) {
    logger.error('uploadMonthlyLedger error:', err);
    next(err);
  }
};

/**
 * POST /api/upload/trigger-monthly-archive
 * Manually or programmatically triggers the monthly ledger archival in JSON format.
 */
const triggerMonthlyArchive = async (req, res, next) => {
  try {
    const targetMonth = req.body?.month || req.query?.month;
    const report = await archiveMonthlyLedger(targetMonth);
    res.json({ success: true, report });
  } catch (err) {
    logger.error('triggerMonthlyArchive error:', err);
    next(err);
  }
};

/**
 * GET /api/upload/monthly-reports
 * List all archived monthly reports with business_id scoping and server-side pagination.
 */
const listMonthlyReports = async (req, res, next) => {
  try {
    const businessId = getTenantBusinessId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = req.query.skip !== undefined ? Math.max(0, parseInt(req.query.skip, 10)) : (page - 1) * limit;
    const { search } = req.query;

    const conditions = ['business_id = $1'];
    const values = [businessId];

    if (search) {
      conditions.push(`(month ILIKE $2 OR year ILIKE $2)`);
      values.push(`%${search.trim()}%`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM monthly_reports ${where}`, values);
    const total = countRes.rows[0]?.total || 0;

    const { rows } = await pool.query(
      `SELECT * FROM monthly_reports ${where} ORDER BY month DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    res.json({
      reports: rowsToDocs(rows),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/upload/file
 * Delete a specific file from Cloudinary and mark in PostgreSQL.
 */
const deleteFile = async (req, res, next) => {
  try {
    const { publicId, resourceType = 'image', orderId, mediaId } = req.body;

    if (!publicId) {
      return res.status(400).json({ error: 'publicId is required.' });
    }

    let destroyResult = { result: 'ok' };
    if (isConfigured()) {
      destroyResult = await deleteResource(publicId, resourceType);
    }

    if (orderId && mediaId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      const where = isUuid ? 'id = $1' : 'local_id = $1';
      const { rows } = await pool.query(`SELECT id, media FROM orders WHERE ${where}`, [orderId]);
      if (rows.length && Array.isArray(rows[0].media)) {
        const updated = rows[0].media.map((m) => {
          if (m.id === mediaId) {
            return { ...m, isDeletedFromCloud: true, deletedFromCloudAt: new Date().toISOString() };
          }
          return m;
        });
        await pool.query('UPDATE orders SET media = $1 WHERE id = $2', [JSON.stringify(updated), rows[0].id]);
      }
    }

    res.json({
      success: true,
      publicId,
      result: destroyResult,
    });
  } catch (err) {
    logger.error('deleteFile error:', err);
    next(err);
  }
};

/**
 * GET /api/upload/annual-backups
 * Returns list of annual backup summaries grouped by year, identifying 1-year completed batches.
 */
const getAnnualBackups = async (req, res, next) => {
  try {
    const businessId = getTenantBusinessId(req);
    const summaries = await getAnnualBackupSummaries(businessId);
    const readyToDownload = summaries.filter((s) => s.isReadyForAnnualArchival);

    res.json({
      success: true,
      summaries,
      readyCount: readyToDownload.length,
      readyYears: readyToDownload.map((s) => s.year),
    });
  } catch (err) {
    logger.error('getAnnualBackups error:', err);
    next(err);
  }
};

/**
 * GET /api/upload/annual-backup/:year/download
 * Generates and downloads the annual consolidated ledger package for the target year.
 */
const downloadAnnualBackup = async (req, res, next) => {
  try {
    const { year } = req.params;
    if (!year || !/^\d{4}$/.test(year)) {
      return res.status(400).json({ error: 'Valid 4-digit year is required.' });
    }

    const businessId = getTenantBusinessId(req);
    const startDate = `${year}-01-01`;
    const endDate   = `${year}-12-31`;

    const [reportsRes, ordersRes] = await Promise.all([
      pool.query(
        'SELECT * FROM monthly_reports WHERE (year = $1 OR month LIKE $2) AND business_id = $3 ORDER BY month ASC',
        [year, `${year}-%`, businessId]
      ),
      pool.query(
        'SELECT * FROM orders WHERE order_date >= $1 AND order_date <= $2 AND business_id = $3 ORDER BY order_date ASC',
        [startDate, endDate, businessId]
      ),
    ]);

    const monthlyReports = rowsToDocs(reportsRes.rows);
    const orders = rowsToDocs(ordersRes.rows);

    let totalRevenue = 0;
    for (const o of orders) {
      if (o.status !== 'Cancelled') {
        totalRevenue += Number(o.totalAmount || 0);
      }
    }

    // Mark monthly reports as archived locally
    await pool.query(
      `UPDATE monthly_reports SET is_archived_locally = true, archived_locally_at = NOW(), cloud_cleanup_status = 'ARCHIVED_LOCAL' WHERE (year = $1 OR month LIKE $2) AND business_id = $3`,
      [year, `${year}-%`, businessId]
    );

    const annualBundle = {
      title: `Print Ghar — Annual Financial Statement & Ledger (${year})`,
      year,
      periodStart: startDate,
      periodEnd: endDate,
      generatedAt: new Date().toISOString(),
      orderCount: orders.length,
      totalRevenue,
      monthlyReportsCount: monthlyReports.length,
      monthlyBreakdown: monthlyReports.map((m) => ({
        month: m.month,
        title: m.title,
        totalRevenue: m.totalRevenue,
        orderCount: m.orderCount,
        cloudinaryPdfUrl: m.cloudinaryPdfUrl,
        isDeletedFromCloud: m.isDeletedFromCloud,
        summary: m.summaryData,
      })),
      orders: orders.map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        orderDate: o.orderDate,
        totalAmount: o.totalAmount,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        status: o.status,
      })),
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Print-Ghar-Annual-Backup-${year}.json"`);
    res.status(200).json(annualBundle);
  } catch (err) {
    logger.error('downloadAnnualBackup error:', err);
    next(err);
  }
};

/**
 * POST /api/upload/annual-backup/:year/purge-cloud
 * Deletes all Cloudinary backup files for the target year and updates database status.
 */
const purgeAnnualCloudBackup = async (req, res, next) => {
  try {
    const { year } = req.params;
    if (!year || !/^\d{4}$/.test(year)) {
      return res.status(400).json({ error: 'Valid 4-digit year is required.' });
    }

    const businessId = getTenantBusinessId(req);
    const { rows } = await pool.query(
      `SELECT * FROM monthly_reports WHERE (year = $1 OR month LIKE $2) AND business_id = $3 AND cloudinary_public_id <> '' AND is_deleted_from_cloud = false`,
      [year, `${year}-%`, businessId]
    );

    const publicIds = rows.map((r) => r.cloudinary_public_id).filter(Boolean);
    let deletionResult = { deleted: {}, count: 0 };

    if (publicIds.length > 0 && isConfigured()) {
      deletionResult = await deleteResources(publicIds, 'raw');
      // Also delete any other resources under that year's folder
      await deleteResourcesByPrefix(`printghar/monthly_reports/${year}`, 'raw');
    }

    // Update PostgreSQL records to record Cloudinary purge
    const updateResult = await pool.query(
      `UPDATE monthly_reports SET is_deleted_from_cloud = true, deleted_from_cloud_at = NOW(), cloud_cleanup_status = 'PURGED_FROM_CLOUD' WHERE (year = $1 OR month LIKE $2) AND business_id = $3`,
      [year, `${year}-%`, businessId]
    );

    logger.info(`🧹 Purged Cloudinary backups for Year ${year}: ${publicIds.length} files removed, ${updateResult.rowCount} records updated in PostgreSQL.`);

    res.json({
      success: true,
      year,
      purgedFilesCount: publicIds.length,
      updatedRecordsCount: updateResult.rowCount,
      message: `Cloudinary monthly backup storage for Year ${year} successfully purged. Local backups and PostgreSQL audit history remain intact.`,
      result: deletionResult,
    });
  } catch (err) {
    logger.error('purgeAnnualCloudBackup error:', err);
    next(err);
  }
};

module.exports = {
  uploadDesign,
  uploadLogo,
  uploadCompanyDesign,
  deleteCompanyDesign,
  uploadMonthlyLedger,
  triggerMonthlyArchive,
  listMonthlyReports,
  getAnnualBackups,
  downloadAnnualBackup,
  purgeAnnualCloudBackup,
  deleteFile,
};
