import pool from './db.js';
import { customAlphabet } from 'nanoid';
import { getPublicUrl } from './r2-service.js';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

/**
 * Create a new collection
 */
async function createCollection({ userId, kind, title, description = null }) {
  const publicId = nanoid();
  
  const [result] = await pool.query(
    `INSERT INTO collection (public_id, owner_user_id, kind, title, description)
     VALUES (?, ?, ?, ?, ?)`,
    [publicId, userId, kind, title, description]
  );
  
  return {
    id: result.insertId,
    publicId,
    userId,
    kind,
    title,
    description
  };
}

/**
 * Find or create a default collection for a user
 */
async function findOrCreateDefaultCollection(userId) {
  // Try to find existing default collection
  const [rows] = await pool.query(
    `SELECT id, public_id, kind, title, description
     FROM collection
     WHERE owner_user_id = ? AND kind = 'stack'
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId]
  );
  
  if (rows.length > 0) {
    return rows[0];
  }
  
  // Create a new default collection
  return createCollection({
    userId,
    kind: 'stack',
    title: 'My Uploads'
  });
}

/**
 * Add media to a collection
 */
async function addMediaToCollection(collectionId, mediaId, position = null) {
  // If no position specified, append to end
  if (position === null) {
    const [rows] = await pool.query(
      `SELECT COALESCE(MAX(position), 0) + 10 AS next_position
       FROM collection_item
       WHERE collection_id = ?`,
      [collectionId]
    );
    position = rows[0].next_position;
  }
  
  const [result] = await pool.query(
    `INSERT INTO collection_item (collection_id, media_id, position)
     VALUES (?, ?, ?)`,
    [collectionId, mediaId, position]
  );
  
  return {
    id: result.insertId,
    collectionId,
    mediaId,
    position
  };
}

/**
 * Get collection with media items
 */
async function getCollectionWithMedia(collectionId, userId) {
  // Get collection info
  const [collectionRows] = await pool.query(
    `SELECT id, public_id, kind, title, description, created_at, updated_at
     FROM collection
     WHERE id = ? AND owner_user_id = ?`,
    [collectionId, userId]
  );
  
  if (collectionRows.length === 0) {
    return null;
  }
  
  const collection = collectionRows[0];
  
  // Get media items with all variants
  const [itemRows] = await pool.query(
    `SELECT 
      m.id, m.public_id, m.type, m.title, m.caption, m.original_filename,
      m.width, m.height, m.created_at,
      ma.id AS asset_id, ma.variant, ma.format, ma.path, 
      ma.bytes, ma.width AS asset_width, ma.height AS asset_height
     FROM collection_item ci
     JOIN media m ON ci.media_id = m.id
     JOIN media_asset ma ON m.id = ma.media_id
     WHERE ci.collection_id = ?
     ORDER BY m.created_at DESC, ma.variant ASC`,
    [collectionId]
  );
  
  // Group assets by media
  const mediaMap = new Map();
  
  for (const row of itemRows) {
    if (!mediaMap.has(row.id)) {
      mediaMap.set(row.id, {
        id: row.id,
        publicId: row.public_id,
        type: row.type,
        title: row.title,
        caption: row.caption,
        originalFilename: row.original_filename,
        width: row.width,
        height: row.height,
        createdAt: row.created_at,
        variants: []
      });
    }
    
    const media = mediaMap.get(row.id);
    media.variants.push({
      id: row.asset_id,
      variant: row.variant,
      format: row.format,
      url: getPublicUrl(row.path),
      bytes: row.bytes,
      width: row.asset_width,
      height: row.asset_height
    });
  }
  
  collection.media = Array.from(mediaMap.values());
  
  return collection;
}

/**
 * Get user's default collection with media
 */
async function getDefaultCollectionWithMedia(userId) {
  const collection = await findOrCreateDefaultCollection(userId);
  return getCollectionWithMedia(collection.id, userId);
}

/**
 * Get all collections for a user
 */
async function getUserCollections(userId) {
  const [rows] = await pool.query(
    `SELECT id, public_id, kind, title, description, created_at, updated_at
     FROM collection
     WHERE owner_user_id = ?
     ORDER BY title ASC`,
    [userId]
  );
  
  return rows;
}

/**
 * Update a collection
 */
async function updateCollection(collectionId, userId, { title, description }) {
  const [result] = await pool.query(
    `UPDATE collection
     SET title = ?, description = ?
     WHERE id = ? AND owner_user_id = ?`,
    [title, description, collectionId, userId]
  );
  
  if (result.affectedRows === 0) {
    return null;
  }
  
  // Fetch and return the updated collection
  const [rows] = await pool.query(
    `SELECT id, public_id, kind, title, description, created_at, updated_at
     FROM collection
     WHERE id = ? AND owner_user_id = ?`,
    [collectionId, userId]
  );
  
  return rows[0] || null;
}

/**
 * Delete a collection (only if empty)
 */
async function deleteCollection(collectionId, userId) {
  // First check if the collection is empty
  const [itemRows] = await pool.query(
    `SELECT COUNT(*) as count
     FROM collection_item
     WHERE collection_id = ?`,
    [collectionId]
  );
  
  if (itemRows[0].count > 0) {
    return { success: false, error: 'Collection is not empty' };
  }
  
  // Delete the collection
  const [result] = await pool.query(
    `DELETE FROM collection
     WHERE id = ? AND owner_user_id = ?`,
    [collectionId, userId]
  );
  
  if (result.affectedRows === 0) {
    return { success: false, error: 'Collection not found' };
  }
  
  return { success: true };
}

export {
  createCollection,
  findOrCreateDefaultCollection,
  addMediaToCollection,
  getCollectionWithMedia,
  getDefaultCollectionWithMedia,
  getUserCollections,
  updateCollection,
  deleteCollection
};
