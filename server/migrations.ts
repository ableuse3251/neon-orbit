import fs from 'fs';
import path from 'path';
import { pool, isDbActive, setDbConnected } from './db.js';
import { config } from './config.js';

export type MigrationState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface MigrationStatus {
  status: MigrationState;
  appliedCount?: number;
  lastMigration?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

let currentMigrationStatus: MigrationStatus = {
  status: 'pending',
};

export function getMigrationStatus(): MigrationStatus {
  return { ...currentMigrationStatus };
}

export function setMigrationStatus(status: MigrationStatus): void {
  currentMigrationStatus = { ...status };
}

export async function runMigrations(): Promise<void> {
  if (!pool) {
    if (config.mockModeAllowed) {
      console.warn('⚠️ Database pool not initialized. Skipping migrations as mock mode is allowed.');
      setDbConnected(false);
      currentMigrationStatus = { status: 'skipped' };
      return;
    }
    currentMigrationStatus = { status: 'failed', error: 'Database pool not initialized. Cannot run migrations.' };
    throw new Error('Database pool not initialized. Cannot run migrations.');
  }

  currentMigrationStatus = {
    status: 'running',
    startedAt: new Date().toISOString(),
  };

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
          setDbConnected(false);
          currentMigrationStatus = { status: 'skipped', error: (err as Error).message };
          return;
        }
        currentMigrationStatus = { status: 'failed', error: (err as Error).message };
        throw new Error(`Database unreachable after ${config.nodeEnv === 'production' ? 30 : 3} retries, cannot run migrations.`);
      }
      console.log(`Database unreachable, retrying in ${retryDelay / 1000} seconds... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  const client = await pool.connect();
  try {
    // Acquire advisory lock to serialize migrations across concurrent instances
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
      setDbConnected(true);
      currentMigrationStatus = {
        status: 'completed',
        appliedCount: 0,
        completedAt: new Date().toISOString(),
      };
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
    let latestApplied: string | undefined = undefined;

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
        appliedCount++;
        latestApplied = file;
      } else {
        latestApplied = file;
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
    setDbConnected(true);

    currentMigrationStatus = {
      status: 'completed',
      appliedCount,
      lastMigration: latestApplied,
      completedAt: new Date().toISOString(),
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    currentMigrationStatus = {
      status: 'failed',
      error: (err as Error).message,
    };
    console.error('Migration failed:', err);
    throw err; // Fail-fast: re-throw error so startup fails immediately on migration error
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(7483921)');
    } catch {}
    client.release();
  }
}
