import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { Server } from 'http';
import { validateProductionConfig, extractDbHostname, isInternalDatabaseHost } from '../config.js';
import healthRouter from '../routes/health.js';
import * as db from '../db.js';
import * as redis from '../redis.js';
import * as migrations from '../migrations.js';

describe('Docker Compose Production Launch & Readiness Verification Tests', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use('/api', healthRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. DB TLS & DOCKER_LOCAL_DB Configuration Validation', () => {
    it('extracts hostnames accurately from database connection strings', () => {
      expect(extractDbHostname('postgres://neon_user:secret@pgbouncer:6432/neon_orbit')).toBe('pgbouncer');
      expect(extractDbHostname('postgres://user:pass@postgres:5432/db')).toBe('postgres');
      expect(extractDbHostname('postgresql://user:pass@localhost:5432/db')).toBe('localhost');
      expect(extractDbHostname('postgresql://user:pass@127.0.0.1:5432/db')).toBe('127.0.0.1');
      expect(extractDbHostname('postgres://user:pass@ep-cool-project.eu-west-1.neon.tech/neondb')).toBe('ep-cool-project.eu-west-1.neon.tech');
    });

    it('identifies internal database hostnames accurately', () => {
      expect(isInternalDatabaseHost('pgbouncer')).toBe(true);
      expect(isInternalDatabaseHost('postgres')).toBe(true);
      expect(isInternalDatabaseHost('localhost')).toBe(true);
      expect(isInternalDatabaseHost('127.0.0.1')).toBe(true);
      expect(isInternalDatabaseHost('host.docker.internal')).toBe(true);
      expect(isInternalDatabaseHost('my-service.local')).toBe(true);

      expect(isInternalDatabaseHost('ep-cool-project.eu-west-1.neon.tech')).toBe(false);
      expect(isInternalDatabaseHost('db.supabase.co')).toBe(false);
      expect(isInternalDatabaseHost('rds.amazonaws.com')).toBe(false);
    });

    it('allows valid production config with standard TLS enabled', () => {
      const validProdConfig = {
        nodeEnv: 'production',
        jwtSecret: 'secure_jwt_secret_1234567890_valid',
        webhookSecret: 'secure_webhook_secret_1234567890_valid',
        metricsSecret: 'secure_metrics_secret_1234567890_valid',
        databaseUrl: 'postgres://user:pass@ep-cool.neon.tech:5432/neon_orbit',
        botToken: '123456789:VALID_BOT_TOKEN_FORMAT_ABC',
        mockModeAllowed: false,
        dbSslRejectUnauthorized: true,
        dbSsl: true,
        dockerLocalDb: false,
      };

      expect(() => validateProductionConfig(validProdConfig as any)).not.toThrow();
    });

    it('allows DOCKER_LOCAL_DB=true with internal PgBouncer host in production', () => {
      const dockerLocalConfig = {
        nodeEnv: 'production',
        jwtSecret: 'secure_jwt_secret_1234567890_valid',
        webhookSecret: 'secure_webhook_secret_1234567890_valid',
        metricsSecret: 'secure_metrics_secret_1234567890_valid',
        databaseUrl: 'postgres://neon_user:secret_password@pgbouncer:6432/neon_orbit',
        botToken: '123456789:VALID_BOT_TOKEN_FORMAT_ABC',
        mockModeAllowed: false,
        dbSslRejectUnauthorized: true,
        dbSsl: false,
        dockerLocalDb: true,
      };

      expect(() => validateProductionConfig(dockerLocalConfig as any)).not.toThrow();
    });

    it('rejects DOCKER_LOCAL_DB=true when pointing to a remote external database', () => {
      const invalidRemoteConfig = {
        nodeEnv: 'production',
        jwtSecret: 'secure_jwt_secret_1234567890_valid',
        webhookSecret: 'secure_webhook_secret_1234567890_valid',
        metricsSecret: 'secure_metrics_secret_1234567890_valid',
        databaseUrl: 'postgres://user:pass@ep-remote.eu-west-1.neon.tech:5432/db',
        botToken: '123456789:VALID_BOT_TOKEN_FORMAT_ABC',
        mockModeAllowed: false,
        dbSslRejectUnauthorized: true,
        dbSsl: false,
        dockerLocalDb: true,
      };

      expect(() => validateProductionConfig(invalidRemoteConfig as any)).toThrow(
        /DOCKER_LOCAL_DB is only permitted for local\/internal database hosts/i
      );
    });

    it('rejects disabling DB_SSL in production without DOCKER_LOCAL_DB', () => {
      const invalidNoSslConfig = {
        nodeEnv: 'production',
        jwtSecret: 'secure_jwt_secret_1234567890_valid',
        webhookSecret: 'secure_webhook_secret_1234567890_valid',
        metricsSecret: 'secure_metrics_secret_1234567890_valid',
        databaseUrl: 'postgres://user:pass@remote-postgres.com:5432/db',
        botToken: '123456789:VALID_BOT_TOKEN_FORMAT_ABC',
        mockModeAllowed: false,
        dbSslRejectUnauthorized: true,
        dbSsl: false,
        dockerLocalDb: false,
      };

      expect(() => validateProductionConfig(invalidNoSslConfig as any)).toThrow(
        /Disabling database SSL.*is forbidden in production unless running in a validated internal Docker environment/i
      );
    });

    it('rejects disabling SSL certificate validation in production mode unconditionally', () => {
      const invalidRejectUnauthorizedConfig = {
        nodeEnv: 'production',
        jwtSecret: 'secure_jwt_secret_1234567890_valid',
        webhookSecret: 'secure_webhook_secret_1234567890_valid',
        metricsSecret: 'secure_metrics_secret_1234567890_valid',
        databaseUrl: 'postgres://user:pass@remote-postgres.com:5432/db',
        botToken: '123456789:VALID_BOT_TOKEN_FORMAT_ABC',
        mockModeAllowed: false,
        dbSslRejectUnauthorized: false,
      };

      expect(() => validateProductionConfig(invalidRejectUnauthorizedConfig as any)).toThrow(
        /Disabling SSL certificate validation.*is forbidden in production/i
      );
    });
  });

  describe('2. Readiness Probe Verification with DB & Migrations State', () => {
    it('returns 200 OK when DB is healthy, Redis is active, and migrations are completed', async () => {
      vi.spyOn(db, 'checkDbHealth').mockResolvedValue({ status: 'ok', latencyMs: 2 } as any);
      vi.spyOn(redis, 'checkRedisHealth').mockResolvedValue({ status: 'ok', latencyMs: 1 } as any);
      vi.spyOn(migrations, 'getMigrationStatus').mockReturnValue({
        status: 'completed',
        appliedCount: 19,
        lastMigration: '019_payments_reconciliation_queue.sql',
        completedAt: new Date().toISOString(),
      });

      const res = await fetch(`${baseUrl}/api/health/readiness`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.services.database.status).toBe('ok');
      expect(body.services.redis.status).toBe('ok');
      expect(body.services.migrations.status).toBe('completed');
    });

    it('returns 503 Unavailable when database is degraded or temporarily unreachable', async () => {
      vi.spyOn(db, 'checkDbHealth').mockResolvedValue({
        status: 'degraded',
        message: 'connect ECONNREFUSED 127.0.0.1:6432',
      });
      vi.spyOn(redis, 'checkRedisHealth').mockResolvedValue({ status: 'ok' } as any);
      vi.spyOn(migrations, 'getMigrationStatus').mockReturnValue({
        status: 'completed',
      });

      const res = await fetch(`${baseUrl}/api/health/readiness`);
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.status).toBe('unavailable');
      expect(body.services.database.status).toBe('degraded');
      expect(body.services.database.message).toContain('ECONNREFUSED');
    });

    it('returns 503 Unavailable when migrations are still running or pending', async () => {
      vi.spyOn(db, 'checkDbHealth').mockResolvedValue({ status: 'ok' });
      vi.spyOn(redis, 'checkRedisHealth').mockResolvedValue({ status: 'ok' } as any);
      vi.spyOn(migrations, 'getMigrationStatus').mockReturnValue({
        status: 'running',
        startedAt: new Date().toISOString(),
      });

      const res = await fetch(`${baseUrl}/api/health/readiness`);
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.status).toBe('unavailable');
      expect(body.services.migrations.status).toBe('running');
    });

    it('returns 503 Unavailable when migrations have failed', async () => {
      vi.spyOn(db, 'checkDbHealth').mockResolvedValue({ status: 'ok' });
      vi.spyOn(redis, 'checkRedisHealth').mockResolvedValue({ status: 'ok' } as any);
      vi.spyOn(migrations, 'getMigrationStatus').mockReturnValue({
        status: 'failed',
        error: 'Syntax error in 019_migration.sql',
      });

      const res = await fetch(`${baseUrl}/api/health/readiness`);
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.status).toBe('unavailable');
      expect(body.services.migrations.status).toBe('failed');
      expect(body.services.migrations.error).toBe('Syntax error in 019_migration.sql');
    });

    it('recovers to 200 OK after temporary DB unavailability resolves', async () => {
      // 1. Initial degraded state (e.g. Postgres container restarting)
      vi.spyOn(db, 'checkDbHealth').mockResolvedValueOnce({
        status: 'degraded',
        message: 'server closed connection unexpectedly',
      });
      vi.spyOn(redis, 'checkRedisHealth').mockResolvedValue({ status: 'ok' } as any);
      vi.spyOn(migrations, 'getMigrationStatus').mockReturnValue({ status: 'completed' });

      let res = await fetch(`${baseUrl}/api/health/readiness`);
      expect(res.status).toBe(503);

      // 2. Recovery state
      vi.spyOn(db, 'checkDbHealth').mockResolvedValueOnce({ status: 'ok', latencyMs: 3 } as any);

      res = await fetch(`${baseUrl}/api/health/readiness`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.status).toBe('ok');
    });
  });

  describe('3. Multi-role Concurrency & Advisory Lock Mechanics', () => {
    it('uses transaction-scoped advisory locks for PgBouncer compatibility', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql === 'BEGIN') return Promise.resolve();
          if (sql.includes('pg_advisory_xact_lock')) return Promise.resolve();
          if (sql.includes('schema_migrations')) {
            if (sql.includes('SELECT version')) return Promise.resolve({ rows: [{ version: '001_initial_schema.sql' }] });
            if (sql.includes('CREATE TABLE')) return Promise.resolve();
            return Promise.resolve({ rows: [{ table_name: 'schema_migrations' }] });
          }
          if (sql === 'COMMIT') return Promise.resolve();
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      };

      vi.spyOn(db, 'pool', 'get').mockReturnValue({
        query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as any);

      await migrations.runMigrations();

      const calls = mockClient.query.mock.calls.map((c) => c[0]);
      const beginIndex = calls.findIndex((c) => typeof c === 'string' && c.includes('BEGIN'));
      const lockIndex = calls.findIndex((c) => typeof c === 'string' && c.includes('pg_advisory_xact_lock'));

      expect(lockIndex).toBeGreaterThanOrEqual(0);
      expect(beginIndex).toBeGreaterThanOrEqual(0);
      expect(calls).toContain('COMMIT');
      // advisory xact lock unlocks automatically on transaction end
      expect(mockClient.release).toHaveBeenCalledTimes(1);

      const status = migrations.getMigrationStatus();
      expect(status.status).toBe('completed');
    });
  });
});
