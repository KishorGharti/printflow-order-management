'use strict';

const cloudinary = require('cloudinary').v2;
const { env } = require('./env');
const logger = require('../utils/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Checks if Cloudinary credentials are fully provided.
 */
function isConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/**
 * Upload a Buffer to Cloudinary via upload_stream.
 *
 * @param {Buffer} buffer - File buffer from Multer
 * @param {Object} options - Upload options
 * @param {string} options.folder - Destination folder (e.g., 'printghar/designs/ORD-101')
 * @param {string} [options.publicId] - Custom public ID
 * @param {string} [options.resourceType='auto'] - 'image' | 'raw' | 'video' | 'auto'
 * @param {Array<string>} [options.tags] - Search tags
 * @returns {Promise<Object>} Cloudinary upload result { secure_url, public_id, format, bytes, ... }
 */
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) {
      return reject(new Error('Cloudinary is not fully configured. Please set CLOUDINARY_API_KEY in backend/.env'));
    }

    const uploadOptions = {
      folder: options.folder || 'printghar/uploads',
      resource_type: options.resourceType || 'auto',
      tags: options.tags || ['printghar'],
      overwrite: true,
    };

    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        logger.error('Cloudinary upload stream error:', error);
        return reject(error);
      }
      resolve(result);
    });

    stream.end(buffer);
  });
}

/**
 * Delete a resource from Cloudinary by public ID.
 *
 * @param {string} publicId - Cloudinary public ID
 * @param {string} [resourceType='image'] - 'image' | 'raw' | 'video'
 * @returns {Promise<Object>}
 */
async function deleteResource(publicId, resourceType = 'image') {
  if (!isConfigured()) {
    logger.warn('Cloudinary not configured. Skipping deletion of', publicId);
    return { result: 'skipped_not_configured' };
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    logger.info(`Cloudinary deleted: ${publicId} (${resourceType}) -> result: ${result.result}`);
    return result;
  } catch (err) {
    logger.error(`Cloudinary delete error for ${publicId}:`, err.message);
    throw err;
  }
}

/**
 * Delete multiple resources from Cloudinary by an array of public IDs.
 *
 * @param {Array<string>} publicIds - List of Cloudinary public IDs
 * @param {string} [resourceType='raw'] - 'image' | 'raw' | 'video'
 * @returns {Promise<Object>}
 */
async function deleteResources(publicIds = [], resourceType = 'raw') {
  if (!isConfigured()) {
    logger.warn('Cloudinary not configured. Skipping bulk deletion.');
    return { deleted: {}, deleted_counts: { [resourceType]: 0 } };
  }

  if (!publicIds.length) return { deleted: {}, count: 0 };

  try {
    const result = await cloudinary.api.delete_resources(publicIds, { resource_type: resourceType });
    logger.info(`Cloudinary bulk deleted ${publicIds.length} resources (${resourceType})`);
    return result;
  } catch (err) {
    logger.error('Cloudinary bulk delete error:', err.message);
    // Fallback: destroy one-by-one if admin API fails
    const fallbackResults = {};
    for (const pid of publicIds) {
      try {
        const r = await cloudinary.uploader.destroy(pid, { resource_type: resourceType });
        fallbackResults[pid] = r.result;
      } catch (e) {
        fallbackResults[pid] = 'failed';
      }
    }
    return { deleted: fallbackResults, count: Object.keys(fallbackResults).length };
  }
}

/**
 * Delete all resources in a folder prefix.
 *
 * @param {string} prefix - Cloudinary path prefix (e.g. 'printghar/monthly_reports/2025')
 * @param {string} [resourceType='raw']
 * @returns {Promise<Object>}
 */
async function deleteResourcesByPrefix(prefix, resourceType = 'raw') {
  if (!isConfigured()) {
    return { result: 'skipped_not_configured' };
  }

  try {
    const result = await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: resourceType });
    logger.info(`Cloudinary deleted resources under prefix '${prefix}':`, result);
    return result;
  } catch (err) {
    logger.error(`Cloudinary delete by prefix error for '${prefix}':`, err.message);
    throw err;
  }
}

module.exports = {
  cloudinary,
  isConfigured,
  uploadBuffer,
  deleteResource,
  deleteResources,
  deleteResourcesByPrefix,
};
