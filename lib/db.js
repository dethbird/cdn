import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'cdn',
  password: process.env.DB_PASSWORD || 'P1zzaP4rty!!!',
  database: process.env.DB_NAME || 'cdn',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
});

export async function checkDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { status: 'connected', error: null };
  } catch (error) {
    return { status: 'disconnected', error: error.message };
  }
}

export async function runMigrations() {
  const connection = await pool.getConnection();
  
  try {
    // Create migrations tracking table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        executed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_migration_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Get list of executed migrations
    const [executedRows] = await connection.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executed = new Set(executedRows.map(row => row.name));
    
    // Define migrations in order
    const migrations = [
      '001_create_users_tables.sql',
      '002_create_media_tables.sql',
      '003_add_archive_type.sql'
    ];
    
    // Run pending migrations
    for (const migrationName of migrations) {
      if (executed.has(migrationName)) {
        console.log(`⏭️  Skipping ${migrationName} (already executed)`);
        continue;
      }
      
      console.log(`🔄 Running migration: ${migrationName}`);
      const migrationPath = join(__dirname, 'migrations', migrationName);
      const sql = readFileSync(migrationPath, 'utf8');
      
      await connection.query(sql);
      await connection.query(
        'INSERT INTO migrations (name) VALUES (?)',
        [migrationName]
      );
      
      console.log(`✅ Completed: ${migrationName}`);
    }
    
    console.log('✨ All migrations completed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

export default pool;
