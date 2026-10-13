# Neon Orbit — Target Production Environment Configuration & Audit (Prompt 16)

This document details the production environment settings, environment variables, security assertions, and step-by-step verification commands for the public launch of **Neon Orbit**.

---

## 1. Production Environment Variables Table

| Variable / Setting | Mandatory? | Environment | Secure Storage Method | Effect if Missing / Misconfigured | Verification Method (Without Revealing Secret) |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | Production / Staging | Platform Secret Manager / Vercel / Docker Env | Defaults to development; mock modes or dev bypasses might remain active. | `curl -s https://api.neonorbit.com/health/readiness | jq .` (checks readiness status) |
| `PORT` | **Yes** | Production | Platform Default | Defaults to 3000; container might fail to bind if port mismatch. | Check container logs for `Server running on port ...` |
| `APP_URL` | **Yes** | Production | Platform Secret / Vercel Env | Telegram WebApp redirect URL and webhook callback domain mismatch. | Verify WebApp button opens correct domain in Telegram. |
| `DATABASE_URL` | **Yes** | Production | Cloud Provider Secret (Railway/Neon/Supabase) | **Fail-fast crash on startup:** Application cannot connect to PostgreSQL. | Run health readiness check `/health/readiness` -> database status `ok`. |
| `DB_SSL` & `DB_SSL_REJECT_UNAUTHORIZED` | **Yes** | Production | Platform Env | Insecure DB connection or TLS handshake failure. | Inspect connection initialization logs for SSL handshake success. |
| `REDIS_URL` | **Conditional** | Production | Cloud Provider Secret (Upstash/Redis Cloud) | Leaderboards fall back to in-memory mode; cache persistence disabled. | Run `npm run test` or check `/health/readiness` redis service status. |
| `TELEGRAM_BOT_TOKEN` | **Yes** | Production | Encrypted Secrets Manager | **Fail-fast crash on startup:** Telegram bot authentication and initData verification fail. | Check bot polling/webhook initialization logs. |
| `WEBHOOK_SECRET` | **Yes** | Production | Encrypted Secrets Manager | Telegram webhook requests rejected or unverified. | Send signed test webhook and verify 200 OK response. |
| `JWT_SECRET` | **Yes** | Production | Encrypted Secrets Manager (Min 32 random chars) | **Fail-fast crash on startup:** Session JWT signature verification fails. | Inspect startup configuration validation test logs. |
| `METRICS_SECRET` | **Yes** | Production | Encrypted Secrets Manager | `/api/metrics` endpoint returns 403 Forbidden. | `curl -H "X-Metrics-Token: <SECRET>" https://api.neonorbit.com/metrics` |
| `CORS_ORIGIN` | **Yes** | Production | Platform Env | Cross-origin requests from frontend domain blocked or too permissive. | Test CORS header in OPTIONS response from API domain. |

---

## 2. Production Security & Infrastructure Assertions

### 2.1 No Test Keys in Production
- **Assertion:** `TELEGRAM_BOT_TOKEN` and `JWT_SECRET` must not be default or test values (`123456789:ABC...`, `default_jwt_secret`).
- **Verification:** The server implements fail-fast configuration checks (`server/config.ts`) that throw an uncatchable startup error if test/default secrets are detected when `NODE_ENV === 'production'`.

### 2.2 Test Environment Isolation
- **Assertion:** Test and staging environments must never point to the production PostgreSQL database or Redis cluster.
- **Verification:** Test environment uses isolated ephemeral test databases (`neon_orbit_test`) configured in Vitest setup files.

### 2.3 Public Client Secret Isolation
- **Assertion:** Client-side Vite build bundles only public variables prefixed with `VITE_`. Server-side secrets (`JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`) are never exposed to the browser.
- **Verification:** Inspect compiled frontend JS bundle in `dist/assets/*.js` for occurrence of secret keys (must be zero matches).

### 2.4 TLS & Trusted Proxies
- **Assertion:** Production terminates TLS at the ingress load balancer / Vercel / Cloud Run with valid certificates. Express trusts proxy headers (`app.set('trust proxy', 1)`) for secure cookie handling and correct client IP rate-limiting.
- **Verification:** `curl -Iv https://neon-orbit-omega.vercel.app` (checks valid TLS certificate and HSTS headers).

### 2.5 Telegram Stars Safety
- **Assertion:** Payment verification endpoints enforce server-side validation of Telegram Stars pre-checkout queries and charge IDs. Test mode assertions cannot trigger real Telegram wallet deductions.
- **Verification:** Run payment integration test suite (`npm test -- server/__tests__/stars_integration.test.ts`).

### 2.6 Migration Safety
- **Assertion:** Database migrations (`npm run db:push` or drizzle-kit migration runner) execute cleanly against clean schemas and do not drop existing tables.
- **Verification:** Run migration lifecycle tests (`npm test -- server/__tests__/db_lifecycle.test.ts`).

---

## 3. Step-by-Step Production Verification Commands

Execute the following read-only commands to verify production readiness:

```bash
# 1. Verify TypeScript compilation and type safety
npm run typecheck

# 2. Run dependency vulnerability audit
npm audit --audit-level=high --omit=dev

# 3. Run full test suite (193 tests including DB, Redis, Auth, Payments, Economy)
npm test

# 4. Verify production build output
npm run build

# 5. Verify health readiness endpoint of deployed app
curl -s https://neon-orbit-omega.vercel.app/api/health/readiness | jq .
```
