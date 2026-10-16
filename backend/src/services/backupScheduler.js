'use strict';

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const logger = require('../utils/logger');

const BACKUP_DIR = path.resolve(__dirname, '../../backups/automated');
const MAX_BACKUPS_RETAINED = 7;
let schedulerTimer = null;
let lastBackupTime = null;

function ensureBackupDirectory() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

async function createAutomatedBackup() {
  ensureBackupDirectory();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_auto_${timestamp}.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  logger.info(`⏰ [Automated Backup] Starting automated database backup: ${filename}...`);

  try {
    // Gather complete database tables
    const tables = [
      'businesses',
      'saas_clients',
      'saas_companies',
      'saas_settings',
      'orders',
      'customers',
      'products',
      'pricing',
      'team_members',
      'stock_items',
      'stock_transactions',
      'vendors',
      'expenses',
      'settings',
      'saas_audit_logs'
    ];

    const snapshot = {
      app: 'print-ghar-automated-backup',
      version: 2,
      createdAt: new Date().toISOString(),
      type: 'scheduled_daily',
      tables: {}
    };

    for (const table of tables) {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${table}`);
        snapshot.tables[table] = rows;
      } catch (err) {
        // Table may not exist yet or empty
        snapshot.tables[table] = [];
      }
    }

    // Write file atomically
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
    lastBackupTime = new Date();

    const stats = fs.statSync(filePath);
    logger.info(`✅ [Automated Backup] Created snapshot ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);

    // Run retention cleanup
    pruneOldBackups();

    return {
      success: true,
      filename,
      filePath,
      sizeBytes: stats.size,
      createdAt: snapshot.createdAt
    };
  } catch (err) {
    logger.error('❌ [Automated Backup] Backup creation failed:', err);
    throw err;
  }
}

function pruneOldBackups() {
  try {
    ensureBackupDirectory();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_auto_') && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(fullPath);
        return { name: f, path: fullPath, mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Newest first

    if (files.length > MAX_BACKUPS_RETAINED) {
      const toDelete = files.slice(MAX_BACKUPS_RETAINED);
      toDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          logger.info(`🗑️ [Automated Backup] Pruned older backup according to retention policy: ${file.name}`);
        } catch (_) {}
      });
    }
  } catch (err) {
    logger.warn('Failed to prune old backups:', err.message);
  }
}

function listAutomatedBackups() {
  ensureBackupDirectory();
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_auto_') && f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(fullPath);
        return {
          filename: f,
          sizeBytes: stats.size,
          sizeKb: (stats.size / 1024).toFixed(1),
          createdAt: stats.mtime.toISOString(),
          timestampMs: stats.mtime.getTime()
        };
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);

    return files;
  } catch (err) {
    logger.error('Error listing automated backups:', err);
    return [];
  }
}

function getBackupFilePath(filename) {
  ensureBackupDirectory();
  const safeFilename = path.basename(filename);
  if (!safeFilename.startsWith('backup_auto_') || !safeFilename.endsWith('.json')) {
    return null;
  }
  const fullPath = path.join(BACKUP_DIR, safeFilename);
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

function getSchedulerStatus() {
  const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    active: true,
    intervalHours: 24,
    retentionLimit: MAX_BACKUPS_RETAINED,
    lastBackupTime: lastBackupTime ? lastBackupTime.toISOString() : null,
    nextEstimatedRun: nextRun,
    totalStored: listAutomatedBackups().length
  };
}

function initBackupScheduler() {
  ensureBackupDirectory();
  // Check if we already have backups or need an initial one
  const existing = listAutomatedBackups();
  if (existing.length === 0) {
    createAutomatedBackup().catch(err => {
      logger.warn('Initial automated backup deferred:', err.message);
    });
  } else {
    lastBackupTime = new Date(existing[0].createdAt);
  }

  // Schedule to run every 24 hours (86,400,000 ms)
  const INTERVAL_MS = 24 * 60 * 60 * 1000;
  schedulerTimer = setInterval(() => {
    createAutomatedBackup().catch(err => {
      logger.error('Scheduled backup error:', err.message);
    });
  }, INTERVAL_MS);

  if (schedulerTimer.unref) schedulerTimer.unref();
  logger.info('⏰ Automated backup scheduler active (Interval: 24h, Retention: 7 daily snapshots).');
}

module.exports = {
  createAutomatedBackup,
  listAutomatedBackups,
  getBackupFilePath,
  getSchedulerStatus,
  initBackupScheduler
};
