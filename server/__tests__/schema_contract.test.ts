import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { runMigrations } from '../migrations.js';
import * as db from '../db.js';

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
  isDbActive: vi.fn().mockReturnValue(true),
}));

vi.mock('../config.js', () => ({
  config: {
    nodeEnv: 'development',
    mockModeAllowed: false,
  },
}));

describe('SQL Schema Contracts & Migration Integration Tests (F27 / SQL Audit)', () => {
  it('all migration files exist and are correctly ordered sequentially', () => {
    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    expect(files.length).toBeGreaterThanOrEqual(17);
    expect(files[0]).toBe('001_initial_schema.sql');
    expect(files[files.length - 1]).toBe('017_notification_queue_updated_at.sql');
  });

  it('migration contract validates table and column definitions across SQL files', () => {
    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    let allSql = '';
    for (const file of files) {
      allSql += fs.readFileSync(path.join(migrationsDir, file), 'utf-8') + '\n';
    }

    // Verify critical tables are created / altered
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS wallets');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS inventory');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS payments');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS seasons');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS season_scores');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS notification_prefs');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS notification_queue');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS notification_logs');

    // Verify critical columns and contracts discussed in SQL audit
    expect(allSql).toContain('language');
    expect(allSql).toContain('language_code');
    expect(allSql).toContain('notifications_enabled');
    expect(allSql).toContain('payment_id');
    expect(allSql).toContain('acquisition_count');
  });

  it('runMigrations executes sequential upgrade successfully with advisory locks', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    vi.mocked(db.pool!.connect).mockResolvedValue(mockClient as any);
    vi.mocked(db.pool!.query).mockResolvedValue({ rows: [{ '?column?': 1 }] } as any);

    // Mock client responses for migration execution
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // lock
      .mockResolvedValueOnce({ rows: [] }) // begin
      .mockResolvedValueOnce({ rows: [] }) // create tracking table
      // For each migration file (15 files): check version, apply sql, insert version
      // Let's mock a generic success for batch queries
      .mockResolvedValue({ rows: [] });

    // For schema verification query at the end
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // lock
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // begin
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // tracking
    
    // Setup generic implementation for remaining calls
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT table_name')) {
        return { rows: [{ table_name: 'schema_migrations' }] };
      }
      return { rows: [] };
    });

    await expect(runMigrations()).resolves.toBeUndefined();
    expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_lock(7483921)');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock(7483921)');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
