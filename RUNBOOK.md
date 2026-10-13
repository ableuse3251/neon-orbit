# Neon Orbit — Operations, Observability & Disaster Recovery Runbook (Prompt 15)

This runbook defines operational procedures, monitoring architecture, backup/restore verification, target metrics (RPO/RTO), and incident response runbooks for the production launch of **Neon Orbit**.

---

## 1. Target Objectives (RPO & RTO)

Given the managed cloud infrastructure (PostgreSQL / Neon / Cloud SQL, Redis / Upstash, and stateless Node.js / Docker backend):

- **RPO (Recovery Point Objective):** **1 Hour**
  - *Definition:* Maximum acceptable data loss in the event of a catastrophic failure.
  - *Implementation:* Automated hourly compressed `pg_dump` snapshots stored in a secure isolated object storage bucket (e.g., AWS S3 / Google Cloud Storage with strict IAM ACLs and object versioning), combined with point-in-time recovery (PITR) enabled on managed PostgreSQL.
- **RTO (Recovery Time Objective):** **15 Minutes**
  - *Definition:* Maximum acceptable downtime / recovery duration.
  - *Implementation:* Automated deployment pipelines via Docker & GitHub Actions, readiness/liveness probes with automatic container restart policies, and tested restore scripts (`server/scripts/backup.sh`).

---

## 2. Backup & Disaster Recovery Architecture

### 2.1 Backup Execution
Backups are created via the automated backup script (`server/scripts/backup.sh`):
```bash
# Manual snapshot creation
DATABASE_URL="postgres://..." BACKUP_DIR="./backups" ./server/scripts/backup.sh
```
- **Compression:** Streamed via `pg_dump --clean --if-exists --no-owner --no-privileges | gzip -9`.
- **Retention:** Backups older than 7 days (`RETENTION_DAYS=7`) are automatically pruned.

### 2.2 Storage & Isolation
- Backups must be uploaded immediately to a dedicated, encrypted backup bucket separate from the primary database server disk.
- Access to backup storage is restricted via IAM roles allowing only automated backup service accounts and Lead DevOps.

### 2.3 Verification & Restore Testing
A backup is invalid until successfully restored on an isolated staging database.
```bash
# Restore procedure on staging / test DB
gunzip -c backups/neon_orbit_YYYYMMDD_HHMMSS.sql.gz | psql "${TEST_DATABASE_URL}"
```
- Automated integration tests (`server/__tests__/db_lifecycle.test.ts`) verify database health, schema migrations, and active queries.

---

## 3. Observability & Monitoring

### 3.1 Health Endpoints
- **Liveness Probe:** `GET /health/liveness`
  - Returns `{ status: 'ok', timestamp }` (HTTP 200). Used by orchestrators to determine if the container process is alive.
- **Readiness Probe:** `GET /health/readiness`
  - Inspects PostgreSQL connectivity (`checkDbHealth`), Redis cache status (`checkRedisHealth`), and database migrations (`getMigrationStatus`).
  - Returns HTTP 200 if all services are operational; HTTP 503 if any core dependency is degraded.

### 3.2 Prometheus-Compatible Metrics (`GET /metrics`)
- Protected by token authentication (`Authorization: Bearer <METRICS_SECRET>` or `X-Metrics-Token`). Query parameter tokens are explicitly rejected to prevent log leaks.
- Key metrics exposed:
  - `neon_orbit_http_requests_total`: Total HTTP requests.
  - `neon_orbit_http_errors_total`: Total HTTP 5xx errors.
  - `neon_orbit_payment_failures_total`: Failed Telegram Stars payment reconciliations.
  - `neon_orbit_active_sessions`: Active player game sessions gauge.
  - `neon_orbit_queue_pending_jobs`: Pending background worker jobs.
  - `neon_orbit_db_connected`: PostgreSQL connectivity status (1 = connected, 0 = disconnected).

### 3.3 Secure Logging
- **Rule:** Never log raw Telegram `initData`, API keys, bearer tokens, or payment webhook sensitive payloads.
- Structured logs output JSON with masked user IDs (e.g., `user ***1001`) and sanitized charge IDs.

---

## 4. Incident Response Runbooks

### Incident 1: PostgreSQL Unavailable
- **Symptom:** `/health/readiness` returns 503; HTTP 500 errors on database routes; log shows connection refused or timeout.
- **Action Plan:**
  1. Check database server status and disk space.
  2. Verify `DATABASE_URL` environment variable.
  3. Inspect PgBouncer connection pool limits.
  4. If database instance is down, initiate failover to standby replica or restore latest snapshot if corrupted.

### Incident 2: Redis Unavailable
- **Symptom:** Redis operations fail; logs show `CRITICAL REDIS OUTAGE`.
- **Action Plan:**
  1. Neon Orbit implements graceful fallback for leaderboards and non-critical caches when Redis is unreachable, but session/rate-limiting features may be impacted.
  2. Restart Redis service or check Upstash / Redis Cloud dashboard.
  3. Verify `REDIS_URL` connection string.

### Incident 3: PgBouncer Refusing Connections
- **Symptom:** Connection pool exhaustion errors; API latency spikes.
- **Action Plan:**
  1. Check max client connections on PgBouncer and PostgreSQL (`max_connections`).
  2. Restart PgBouncer service or increase pool size in configuration.
  3. Inspect slow queries via PostgreSQL `pg_stat_activity`.

### Incident 4: Application Crash Loop (Restart Loop)
- **Symptom:** Container repeatedly exits and restarts (CrashLoopBackOff).
- **Action Plan:**
  1. Inspect container crash logs: `docker logs <container_id> --tail 100`.
  2. Common causes: Missing environment variables, database migration failure on startup, or unhandled exception in `server.ts`.
  3. Roll back to previous stable Docker image if caused by recent deployment.

### Incident 5: Migration Failed
- **Symptom:** Application fails readiness check due to pending or failed migration status.
- **Action Plan:**
  1. Inspect migration logs.
  2. Run `npm run db:push` or check migration lock state in `drizzle_migrations` table.
  3. If migration is corrupt, restore database from latest pre-migration snapshot or apply manual corrective SQL fix.

### Incident 6: Vulnerability Discovered
- **Symptom:** Security advisory in dependencies or reported exploit.
- **Action Plan:**
  1. Run `npm audit` to identify affected packages.
  2. Update package version in `package.json`, run `npm ci` and `npm test`.
  3. Deploy hotfix immediately via CI/CD pipeline.

### Incident 7: Payment Didn't Grant Reward (Telegram Stars)
- **Symptom:** User paid Stars (`pre_checkout_query` / `successful_payment`), but item/stardust was not credited.
- **Action Plan:**
  1. Check payment logs for `chargeId` and payment status in database `purchases` table.
  2. Use admin audit tool or execute idempotent credit query manually using the verified charge ID.
  3. Verify Telegram webhook endpoint availability (`/api/telegram/webhook`).

### Incident 8: Version Rollback Required
- **Symptom:** New deployment introduces critical regression.
- **Action Plan:**
  1. Trigger immediate rollback in hosting platform (Vercel / Cloud Run / Docker) to the previous Git tag / Docker image hash.
  2. Verify `/health/readiness` and core game loop on rolled-back version.

### Incident 9: Data Loss or Database Corruption
- **Symptom:** Missing records or corrupted tables.
- **Action Plan:**
  1. Stop application write traffic (or put app in maintenance mode).
  2. Provision temporary staging database and restore latest clean backup snapshot (`neon_orbit_YYYYMMDD_HHMMSS.sql.gz`).
  3. Verify data integrity with test suite (`npm test`).
  4. Promote restored database to production.
