import { vi, describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations.js';
import * as db from '../db.js';
import { config } from '../config.js';
import fs from 'fs';

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
  isDbActive: vi.fn(),
  setDbConnected: vi.fn(),
}));

vi.mock('../config.js', () => ({
  config: {
    nodeEnv: 'development',
    mockModeAllowed: true,
  },
}));

describe('Migrations Fail-Fast & Deployment Safety (F10 / NE-09)', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    vi.mocked(db.pool!.connect).mockResolvedValue(mockClient);
    vi.mocked(db.pool!.query).mockResolvedValue({ rows: [{ '?column?': 1 }] } as any);
  });

  it('runMigrations function is defined and exported', () => {
    expect(typeof runMigrations).toBe('function');
  });

  it('skips migrations when pool is null in mock mode', async () => {
    const originalPool = db.pool;
    // Temporarily set pool to null
    (db as any).pool = null;
    config.mockModeAllowed = true;

    try {
      await expect(runMigrations()).resolves.toBeUndefined();
    } finally {
      (db as any).pool = originalPool;
    }
  });

  it('fails fast when database is unreachable and mock mode is forbidden', async () => {
    vi.mocked(db.pool!.query).mockRejectedValue(new Error('Connection failed'));
    config.mockModeAllowed = false;
    
    await expect(runMigrations()).rejects.toThrow('Database unreachable after 3 retries, cannot run migrations.');
  });

  it('executes migrations successfully on a clean database with advisory locks and schema verification', async () => {
    config.mockModeAllowed = false;
    
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['001_initial_schema.sql'] as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('CREATE TABLE test (id int);');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // lock
      .mockResolvedValueOnce({ rows: [] }) // begin
      .mockResolvedValueOnce({ rows: [] }) // create tracking
      .mockResolvedValueOnce({ rows: [] }) // check version
      .mockResolvedValueOnce({ rows: [] }) // apply migration sql
      .mockResolvedValueOnce({ rows: [] }) // insert version
      .mockResolvedValueOnce({ rows: [] }) // commit
      .mockResolvedValueOnce({ rows: [{ table_name: 'schema_migrations' }] }); // schema check

    await runMigrations();

    expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_lock(7483921)');
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock(7483921)');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('rolls back transaction and releases advisory lock on migration execution error', async () => {
    config.mockModeAllowed = false;
    
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['001_initial_schema.sql'] as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('INVALID SQL;');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // lock
      .mockResolvedValueOnce({ rows: [] }) // begin
      .mockResolvedValueOnce({ rows: [] }) // create tracking
      .mockResolvedValueOnce({ rows: [] }) // check version
      .mockRejectedValueOnce(new Error('Syntax error')); // apply migration fail

    await expect(runMigrations()).rejects.toThrow('Syntax error');

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock(7483921)');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
