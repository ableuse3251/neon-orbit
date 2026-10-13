import { runMigrations } from '../migrations.js';
import { pool } from '../db.js';

async function main() {
  console.log('Running database migrations for CI test environment...');
  await runMigrations();
  console.log('Database migrations completed successfully.');
  if (pool) {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
