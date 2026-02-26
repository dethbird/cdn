import 'dotenv/config';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import pool from '../lib/db.js';
import { uploadObject, objectExists } from '../lib/r2-service.js';

const FORMAT_TO_CONTENT_TYPE = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  zip: 'application/zip',
};

const dryRun = process.argv.includes('--dry-run');
const uploadsPath = process.env.LOCAL_UPLOADS_PATH;

if (!uploadsPath) {
  console.error('❌ LOCAL_UPLOADS_PATH is not set in .env');
  process.exit(1);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function migrate() {
  console.log(`🔄 Migrating local uploads to R2${dryRun ? ' (DRY RUN)' : ''}...\n`);

  // Query all media_asset rows
  const [assets] = await pool.query(
    `SELECT ma.id, ma.path, ma.format, m.type AS media_type
     FROM media_asset ma
     JOIN media m ON ma.media_id = m.id
     ORDER BY ma.id ASC`
  );

  console.log(`📊 Found ${assets.length} asset(s) in database\n`);

  let uploaded = 0;
  let skippedR2 = 0;
  let missingLocal = 0;
  let failed = 0;

  for (const asset of assets) {
    const localPath = join(uploadsPath, 'processed', asset.path);
    const key = asset.path;
    const label = `[${asset.id}] ${key}`;

    // Check if file exists on local disk
    if (!(await fileExists(localPath))) {
      console.log(`   ⚠️  ${label} — not on disk, skipping`);
      missingLocal++;
      continue;
    }

    // Check if already in R2
    if (!dryRun) {
      try {
        if (await objectExists(key)) {
          console.log(`   ⏭️  ${label} — already in R2, skipping`);
          skippedR2++;
          continue;
        }
      } catch (err) {
        console.error(`   ❌ ${label} — R2 head check failed: ${err.message}`);
        failed++;
        continue;
      }
    }

    // Determine content type
    const contentType = FORMAT_TO_CONTENT_TYPE[asset.format] || 'application/octet-stream';

    if (dryRun) {
      console.log(`   📦 ${label} — would upload (${contentType})`);
      uploaded++;
      continue;
    }

    // Read and upload
    try {
      const buffer = await readFile(localPath);
      await uploadObject(key, buffer, contentType);
      console.log(`   ✅ ${label} — uploaded (${(buffer.length / 1024).toFixed(1)} KB)`);
      uploaded++;
    } catch (err) {
      console.error(`   ❌ ${label} — upload failed: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✨ Migration ${dryRun ? 'dry run ' : ''}complete!`);
  console.log(`   ${uploaded} uploaded`);
  console.log(`   ${skippedR2} already in R2`);
  console.log(`   ${missingLocal} missing from disk`);
  console.log(`   ${failed} failed`);

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to execute the migration.');
  }
}

migrate()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    pool.end();
    process.exit(1);
  });
