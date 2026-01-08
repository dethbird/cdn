import 'dotenv/config';
import pool from '../lib/db.js';
import { rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function resetMedia() {
  console.log('🗑️  Resetting all media...\n');

  const connection = await pool.getConnection();
  
  try {
    // Get counts before deletion
    const [mediaCount] = await connection.query('SELECT COUNT(*) as count FROM media');
    const [assetCount] = await connection.query('SELECT COUNT(*) as count FROM media_asset');
    
    console.log(`Found ${mediaCount[0].count} media records`);
    console.log(`Found ${assetCount[0].count} asset records\n`);

    // Delete from database (assets will cascade delete due to FK)
    console.log('🔄 Deleting database records...');
    await connection.query('DELETE FROM media');
    console.log('✅ Database records deleted\n');

    // Delete files from uploads directory
    const uploadsPath = process.env.UPLOADS_PATH || join(__dirname, '..', 'uploads');
    const processedPath = join(uploadsPath, 'processed');
    
    console.log('🔄 Deleting uploaded files...');
    try {
      await rm(processedPath, { recursive: true, force: true });
      console.log('✅ Uploaded files deleted\n');
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('⚠️  No uploads directory found (already clean)\n');
      } else {
        throw error;
      }
    }

    console.log('✨ Media reset complete!');
    console.log(`   Deleted ${mediaCount[0].count} media records`);
    console.log(`   Deleted ${assetCount[0].count} asset records`);
    console.log('   Deleted all uploaded files');

  } catch (error) {
    console.error('❌ Reset failed:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

resetMedia()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
