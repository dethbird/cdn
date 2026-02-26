import 'dotenv/config';
import pool, { runMigrations } from '../lib/db.js';
import { deletePrefix } from '../lib/r2-service.js';

async function resetDatabase() {
  console.log('🗑️  Resetting entire database and all uploaded media...\n');

  const connection = await pool.getConnection();
  
  try {
    // Get counts before deletion
    console.log('📊 Current database state:');
    try {
      const [mediaCount] = await connection.query('SELECT COUNT(*) as count FROM media');
      const [assetCount] = await connection.query('SELECT COUNT(*) as count FROM media_asset');
      const [collectionCount] = await connection.query('SELECT COUNT(*) as count FROM collection');
      const [usersCount] = await connection.query('SELECT COUNT(*) as count FROM users');
      
      console.log(`   ${mediaCount[0].count} media records`);
      console.log(`   ${assetCount[0].count} asset records`);
      console.log(`   ${collectionCount[0].count} collections`);
      console.log(`   ${usersCount[0].count} users\n`);
    } catch (error) {
      console.log('   (Unable to read current state - tables may not exist)\n');
    }

    // Disable foreign key checks temporarily
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Drop all tables
    console.log('🔄 Dropping all tables...');
    const tables = [
      'collection_item',
      'media_asset',
      'media',
      'collection',
      'user_identities',
      'users',
      'migrations'
    ];

    for (const table of tables) {
      try {
        await connection.query(`DROP TABLE IF EXISTS ${table}`);
        console.log(`   ✓ Dropped ${table}`);
      } catch (error) {
        console.log(`   ⚠️  Could not drop ${table}: ${error.message}`);
      }
    }

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ All tables dropped\n');

    // Delete files from R2 bucket
    console.log('🔄 Deleting all uploaded files from R2...');
    try {
      const count = await deletePrefix('');
      console.log(`✅ ${count} objects deleted from R2\n`);
    } catch (error) {
      console.log(`⚠️  Could not clear R2 bucket: ${error.message}\n`);
    }

    // Release the connection before running migrations
    connection.release();

    // Run migrations to recreate schema
    console.log('🔄 Recreating database schema...\n');
    await runMigrations();
    console.log();

    console.log('✨ Database reset complete!');
    console.log('   All tables dropped and recreated');
    console.log('   All uploaded files deleted');
    console.log('   Fresh database ready to use');

  } catch (error) {
    console.error('❌ Reset failed:', error);
    throw error;
  } finally {
    // Make sure connection is released if still held
    try {
      connection.release();
    } catch (e) {
      // Connection already released
    }
    await pool.end();
  }
}

resetDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
