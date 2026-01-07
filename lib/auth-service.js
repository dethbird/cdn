import pool from './db.js';
import { normalizeEmail } from './utils.js';

/**
 * Find or create user from OAuth profile.
 * Implements the upsert flow:
 * 1. Check for existing identity by (provider, provider_user_id)
 * 2. If not found, create or find user by email_normalized
 * 3. Insert/update identity record
 * 
 * @param {Object} profile - OAuth profile data
 * @param {string} profile.provider - 'google', 'github', etc.
 * @param {string} profile.providerId - Provider's user ID (e.g., Google 'sub')
 * @param {string} profile.email - User's email
 * @param {string} profile.name - User's display name
 * @param {string} profile.picture - User's avatar URL
 * @param {Object} profile.rawProfile - Full provider profile (optional)
 * @returns {Promise<Object>} User object with id, email, display_name, avatar_url
 */
export async function findOrCreateUserFromOAuth(profile) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { provider, providerId, email, name, picture, rawProfile } = profile;
    const emailNorm = normalizeEmail(email);
    
    // Step 1: Try to find existing identity
    const [identityRows] = await connection.query(
      `SELECT user_id FROM user_identities 
       WHERE provider = ? AND provider_user_id = ?`,
      [provider, providerId]
    );
    
    let userId;
    
    if (identityRows.length > 0) {
      // Existing identity found - use that user_id
      userId = identityRows[0].user_id;
      
      // Update identity record
      await connection.query(
        `UPDATE user_identities 
         SET provider_email = ?,
             provider_email_norm = ?,
             profile_json = ?,
             last_login_at = NOW(3),
             updated_at = NOW(3)
         WHERE provider = ? AND provider_user_id = ?`,
        [email, emailNorm, JSON.stringify(rawProfile), provider, providerId]
      );
      
    } else {
      // New identity - find or create user
      
      // Try to find existing user by normalized email
      const [userRows] = await connection.query(
        `SELECT id FROM users WHERE email_normalized = ?`,
        [emailNorm]
      );
      
      if (userRows.length > 0) {
        // User exists with this email
        userId = userRows[0].id;
      } else {
        // Create new user
        const [result] = await connection.query(
          `INSERT INTO users (email, email_normalized, display_name, avatar_url, last_login_at)
           VALUES (?, ?, ?, ?, NOW(3))`,
          [email, emailNorm, name, picture]
        );
        userId = result.insertId;
      }
      
      // Insert new identity
      await connection.query(
        `INSERT INTO user_identities 
         (user_id, provider, provider_user_id, provider_email, provider_email_norm, profile_json, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [userId, provider, providerId, email, emailNorm, JSON.stringify(rawProfile)]
      );
    }
    
    // Update user's last_login_at
    await connection.query(
      `UPDATE users SET last_login_at = NOW(3) WHERE id = ?`,
      [userId]
    );
    
    // Fetch and return complete user record
    const [users] = await connection.query(
      `SELECT id, email, display_name, avatar_url, status, last_login_at
       FROM users WHERE id = ?`,
      [userId]
    );
    
    await connection.commit();
    return users[0];
    
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
