import pool from './db.js';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

/**
 * Calculate SHA256 hash of a file
 * @param {string} filePath - Path to file
 * @returns {Promise<Buffer>} SHA256 hash as binary buffer
 */
export async function calculateSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest()));
    stream.on('error', reject);
  });
}

/**
 * Create a new media record in the database
 * @param {Object} data - Media data
 * @param {number} data.ownerUserId - User ID who owns the media
 * @param {string} data.type - Media type: 'image', 'audio', or 'video'
 * @param {string} data.originalFilename - Original filename
 * @param {string} data.mimeType - MIME type
 * @param {number} data.bytes - File size in bytes
 * @param {Buffer} data.sha256 - SHA256 hash as binary buffer
 * @param {number} [data.width] - Image/video width
 * @param {number} [data.height] - Image/video height
 * @param {number} [data.durationMs] - Audio/video duration in milliseconds
 * @param {string} [data.title] - Optional title
 * @param {string} [data.caption] - Optional caption
 * @param {string} [data.altText] - Optional alt text
 * @returns {Promise<Object>} Created media record with id and public_id
 */
export async function createMediaRecord(data) {
  const publicId = nanoid(24);
  const originalExt = data.originalFilename 
    ? data.originalFilename.split('.').pop().toLowerCase() 
    : null;
  
  const [result] = await pool.query(
    `INSERT INTO media (
      public_id, owner_user_id, type,
      original_filename, original_ext, mime_type,
      bytes, sha256,
      width, height, duration_ms,
      title, caption, alt_text,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded')`,
    [
      publicId,
      data.ownerUserId,
      data.type,
      data.originalFilename,
      originalExt,
      data.mimeType,
      data.bytes,
      data.sha256,
      data.width || null,
      data.height || null,
      data.durationMs || null,
      data.title || null,
      data.caption || null,
      data.altText || null
    ]
  );
  
  return {
    id: result.insertId,
    publicId,
    type: data.type,
    mimeType: data.mimeType
  };
}

/**
 * Get media by public ID
 * @param {string} publicId - Public ID of media
 * @returns {Promise<Object|null>} Media record or null if not found
 */
export async function getMediaByPublicId(publicId) {
  const [rows] = await pool.query(
    `SELECT * FROM media WHERE public_id = ? AND status != 'deleted'`,
    [publicId]
  );
  
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get media by ID
 * @param {number} id - Media ID
 * @returns {Promise<Object|null>} Media record or null if not found
 */
export async function getMediaById(id) {
  const [rows] = await pool.query(
    `SELECT * FROM media WHERE id = ? AND status != 'deleted'`,
    [id]
  );
  
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update media status
 * @param {number} id - Media ID
 * @param {string} status - New status: 'uploaded', 'processing', 'ready', 'failed', 'deleted'
 * @returns {Promise<void>}
 */
export async function updateMediaStatus(id, status) {
  await pool.query(
    'UPDATE media SET status = ?, updated_at = NOW(3) WHERE id = ?',
    [status, id]
  );
}

/**
 * Create a media asset (rendition) record
 * @param {Object} data - Asset data
 * @param {number} data.mediaId - Media ID this asset belongs to
 * @param {string} data.variant - Variant identifier (e.g., '320', '800', '1280', 'og')
 * @param {string} data.format - File format (e.g., 'webp', 'jpg', 'mp4')
 * @param {string} data.path - Relative path under /m/ (e.g., 'i/abc123/800.webp')
 * @param {number} [data.bytes] - File size in bytes
 * @param {Buffer} [data.sha256] - SHA256 hash
 * @param {number} [data.width] - Width for images/video
 * @param {number} [data.height] - Height for images/video
 * @param {number} [data.durationMs] - Duration for audio/video
 * @returns {Promise<Object>} Created asset record with id
 */
export async function createMediaAsset(data) {
  const [result] = await pool.query(
    `INSERT INTO media_asset (
      media_id, variant, format, path,
      bytes, sha256, width, height, duration_ms,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready')`,
    [
      data.mediaId,
      data.variant,
      data.format,
      data.path,
      data.bytes || null,
      data.sha256 || null,
      data.width || null,
      data.height || null,
      data.durationMs || null
    ]
  );
  
  return {
    id: result.insertId,
    mediaId: data.mediaId,
    variant: data.variant,
    format: data.format,
    path: data.path
  };
}

/**
 * Get all assets for a media item
 * @param {number} mediaId - Media ID
 * @returns {Promise<Array>} Array of asset records
 */
export async function getAssetsForMedia(mediaId) {
  const [rows] = await pool.query(
    `SELECT * FROM media_asset WHERE media_id = ? ORDER BY variant, format`,
    [mediaId]
  );
  
  return rows;
}
