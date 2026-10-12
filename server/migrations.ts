import fs from 'fs';
import path from 'path';
import { pool, isDbActive } from './db.js';
import { config } from './config.js';

export async function runMigrations(): Promise<void> {
  if (!pool) {
    if (config.mockModeAllowed) {
      console.warn('⚠️ Database pool not initialized. Skipping migrations as mock mode is allowed.');
      return;
    }
    throw new Error('Database pool not initialized. Cannot run migrations.');
  }

  // Explicitly verify DB connectivity with retries
  let retries = config.nodeEnv === 'production' ? 30 : 3;
  const retryDelay = config.nodeEnv === 'production' ? 5000 : 1000;

  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (err) {
      retries--;
      if (retries === 0) {
        if (config.mockModeAllowed) {
          console.warn('⚠️ Database unreachable after retries. Skipping migrations as mock mode is allowed.');
          return;
        }
        throw new Error(`Database unreachable after ${config.nodeEnv === 'production' ? 30 : 3} retries, cannot run migrations.`);
      }
      console.log(`Database unreachable, retrying in ${retryDelay/1000} seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  const client = await pool.connect();
  try {
    // Acquire session-level advisory lock to prevent concurrent migrations across multiple instances
    await client.query('SELECT pg_advisory_lock(7483921)');

    await client.query('BEGIN');

    // Create schema_migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      await client.query('COMMIT');
      try {
        await client.query('SELECT pg_advisory_unlock(7483921)');
      } catch {}
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [file]
      );

      if (rows.length === 0) {
        console.log(`Applying DB Migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        console.log(`Successfully applied DB Migration: ${file}`);
      }
    }

    await client.query('COMMIT');

    // Verify final schema / critical tables exist
    const schemaCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('schema_migrations')
    `);
    if (schemaCheck.rows.length === 0) {
      throw new Error('Schema verification failed: critical tables missing after migration.');
    }
    console.log('✅ Schema verification passed.');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('Migration failed:', err);
    throw err; // Fail-fast: re-throw error so startup fails immediately on migration error
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(7483921)');
    } catch {}
    client.release();
  }
}
