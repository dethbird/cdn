import 'dotenv/config';
import { runMigrations } from './lib/db.js';

console.log('🚀 Running database migrations...\n');

runMigrations()
  .then(() => {
    console.log('\n✨ Migration process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration process failed:', error);
    process.exit(1);
  });
