# 🚀 Neon Orbit Production Deployment Guide (Option A: Vercel Frontend + Persistent Express Docker Backend)

This guide provides deploy-ready instructions for deploying **Neon Orbit** using **Option A**:
- **Frontend**: Vite/React SPA hosted on **Vercel** CDN.
- **Backend**: Express Node.js API, Telegram Bot, and Background Notification Worker hosted on a **Persistent Node/Docker Host** (Railway, Fly.io, Cloud Run, Render, or Dedicated VPS).

---

## 🛑 1. Why Express / Bot / Workers CANNOT Run in Vercel Serverless Functions

Attempting to run `server.ts` or `bot.ts` inside Vercel Serverless Functions results in HTTP `500 FUNCTION_INVOCATION_FAILED` errors due to fundamental architectural mismatches:

1. **`process.listen()` Conflict**:
   - Vercel Serverless Functions are ephemeral AWS Lambda micro-containers invoked per incoming request.
   - Vercel manages request routing externally at the edge. Calling `app.listen(PORT)` inside a serverless handler attempts to bind a TCP port, causing permission denied or socket hangup errors.

2. **Telegram Long Polling (`bot.start()`) Failure**:
   - Telegram long polling requires a continuous, open TCP connection to `api.telegram.org/bot<TOKEN>/getUpdates`.
   - Vercel Serverless Functions freeze or terminate execution as soon as the HTTP response closes. Any active polling loop is frozen or severed, resulting in dropped updates, 409 Conflict errors, or duplicate polling instances.

3. **Background Worker (`setInterval`) Destruction**:
   - Background workers (e.g. `processNotificationQueue()` running on a 30-second loop) rely on persistent Node event loops.
   - Serverless instances scale to zero when idle. In-memory timers or background loops freeze, causing scheduled notifications and database queue processing to stall indefinitely.

4. **Database & Redis Connection Exhaustion**:
   - Serverless functions create new database connection pools on cold starts. Under high traffic, hundreds of concurrent serverless lambdas will instantly exhaust PostgreSQL's `max_connections` (100–200 limit) without persistent connection pooling like PgBouncer.

---

## 🏗️ 2. Option A Architecture & Service Topology

The system is decomposed into distinct, isolated services communicating over secure internal networks and HTTPS:

```
                  ┌─────────────────────────────────────┐
                  │          Vercel Edge CDN            │
                  │   Vite/React SPA (Neon Orbit Web)   │
                  └──────────────────┬──────────────────┘
                                     │ HTTPS
                                     ▼
                  ┌─────────────────────────────────────┐
                  │    HTTPS Proxy / Load Balancer      │
                  │       (Caddy / Nginx / Railway)     │
                  └──────────────────┬──────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │ (Internal Docker Network / Private VPC - Isolated)   │
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     web_api      │       │   bot_handler    │       │notification_worker│
│ (APP_ROLE=web-api)       │ (APP_ROLE=bot)   │       │(APP_ROLE=worker) │
│ Express REST API │       │ Telegram Polling │       │ Queue Processor  │
└────────┬─────────┘       └────────┬─────────┘       └────────┬─────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │    PgBouncer Pooler (6432)   │
                    └───────────────┬──────────────┘
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
               ┌──────────────────┐  ┌──────────────────┐
               │ PostgreSQL 16 DB │  │   Redis 7 Cache  │
               │ (Private 5432)   │  │  (Private 6379)  │
               └──────────────────┘  └──────────────────┘
```

### Application Roles (`APP_ROLE` Environment Variable)

1. **`web_api` (`APP_ROLE=web-api`)**:
   - Serves all REST endpoints (`/api/*`), CORS middleware, rate limiting, and HMAC authentication.
   - Exposes `/api/health/liveness` and `/api/health/readiness`.
   - Skips Telegram bot long-polling and background worker intervals.

2. **`bot_handler` (`APP_ROLE=telegram-bot`)**:
   - Executes grammY Telegram Bot long-polling (`bot.start()`).
   - Processes `/start`, `/top`, `/help`, `/season`, `/delete_me` commands and Telegram Stars pre-checkout validation (`pre_checkout_query`).

3. **`notification_worker` (`APP_ROLE=worker`)**:
   - Executes `processNotificationQueue()` every 30 seconds.
   - Claims pending notifications atomically using PostgreSQL `FOR UPDATE SKIP LOCKED`.
   - Respects quiet hours, retry exponential backoff, and Telegram rate limits (~25 msg/sec).

4. **Monolithic Mode (`APP_ROLE=all`)**:
   - Runs Web API, Telegram Bot, and Notification Worker inside a single process (ideal for local development or lightweight single-container hosts).

---

## 🔒 3. Network, Port & Security Settings

### Port Allocations (Internal Only)
- **Web API**: Port `3000` (configurable via `PORT`).
- **PgBouncer**: Port `6432` (Internal Docker Network).
- **PostgreSQL**: Port `5432` (Internal Docker Network).
- **Redis**: Port `6379` (Internal Docker Network).

### Security Rules
- ⚠️ **CRITICAL**: **Do NOT expose PostgreSQL (`5432`) or Redis (`6379`) host ports to `0.0.0.0` on the public internet.** Bind database services exclusively to `127.0.0.1` or internal Docker overlay networks (`docker-compose.yml` internal service name).
- **HTTPS Termination**: Public access MUST route through an SSL/TLS terminating reverse proxy (Cloudflare, Caddy, Railway Ingress, or Nginx) providing valid TLS certificates.

---

## 🛠️ 4. Deploying Frontend to Vercel

1. Log into [Vercel Dashboard](https://vercel.com) and click **Add New Project**.
2. Select your GitHub repository (`neon-orbit`).
3. Set Framework Preset: **Vite**.
4. Set Build Command: `npm run build`
5. Set Output Directory: `dist`
6. **Configure Environment Variables in Vercel Dashboard**:
   - `VITE_API_BASE_URL`: The public HTTPS URL of your persistent Express backend (e.g. `https://api.neonorbit.com` or `https://neon-orbit-api.up.railway.app`).
7. Deploy. Vercel automatically builds and distributes the static bundle across its global Edge Network.

---

## 🐳 5. Deploying Backend with Docker / Docker Compose

### Prerequisites & Secrets Management
All secrets MUST be supplied via host environment variables or dashboard secret managers (Railway, Fly.io, AWS Secrets Manager, GitHub Secrets). **Never commit production secrets to Git.**

### Step 1: Prepare Production `.env`
Create a `.env` file on your server (or configure environment variables in your deployment cloud provider dashboard) using `.env.example` as a template:

```bash
# Frontend Public URL
APP_URL="https://neon-orbit.vercel.app"

# Server Settings
NODE_ENV="production"
PORT="3000"

# CORS Allowlist
CORS_ORIGIN="https://neon-orbit.vercel.app,https://web.telegram.org"

# Telegram Bot Credentials
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_FROM_BOTFATHER"
BOT_USERNAME="NeonOrbitBot"
ADMIN_TELEGRAM_IDS="123456789,987654321"

# Production Secrets (Generated random 32+ char hashes)
WEBHOOK_SECRET="generate_random_hash_secret_here_32chars"
JWT_SECRET="generate_random_jwt_hmac_secret_here_32chars"
METRICS_SECRET="generate_random_metrics_bearer_token"
POSTGRES_PASSWORD="generate_secure_db_password_here"

# Database Connection (Routed through PgBouncer connection pooler)
DATABASE_URL="postgres://neon_user:${POSTGRES_PASSWORD}@pgbouncer:6432/neon_orbit"

# Redis Cache URL
REDIS_URL="redis://redis:6379"
```

### Step 2: Start Containers with Docker Compose
```bash
# Build and start all services in detached mode
docker-compose up --build -d

# Verify running container status
docker-compose ps
```

---

## 🩺 6. Health Probes & Monitoring

The Express backend includes built-in liveness and readiness health endpoints:

### Liveness Probe (`GET /api/health/liveness`)
- **URL**: `http://localhost:3000/api/health/liveness`
- **Purpose**: Verifies that the Express HTTP server process is running and accepting sockets.
- **Expected Status**: `200 OK`
- **Response**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-12T10:00:00.000Z"
  }
  ```

### Readiness Probe (`GET /api/health/readiness`)
- **URL**: `http://localhost:3000/api/health/readiness`
- **Purpose**: Verifies active database connection pool health and Redis cache responsiveness.
- **Expected Status**: `200 OK` (or `503 Service Unavailable` if database is down).
- **Response**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-12T10:00:00.000Z",
    "services": {
      "database": { "status": "ok", "latencyMs": 2 },
      "redis": { "status": "ok", "latencyMs": 1 }
    }
  }
  ```

---

## 🧪 7. Smoke Testing Verification Commands

After deploying, run the following smoke tests against your persistent Express backend API:

### Test 1: Liveness Check
```bash
curl -i -X GET https://your-backend-api.com/api/health/liveness
# Expected: HTTP/1.1 200 OK
```

### Test 2: Readiness Check (DB & Redis Health)
```bash
curl -i -X GET https://your-backend-api.com/api/health/readiness
# Expected: HTTP/1.1 200 OK
```

### Test 3: Public Configuration Endpoint
```bash
curl -i -X GET https://your-backend-api.com/api/config
# Expected: HTTP/1.1 200 OK with botUsername, gameVersion, and features
```

### Test 4: Leaderboard Endpoint
```bash
curl -i -X GET "https://your-backend-api.com/api/leaderboard?scope=global"
# Expected: HTTP/1.1 200 OK with global leaderboard entries
```

### Test 5: Session Endpoint with Telegram Authorization
```bash
curl -i -X GET https://your-backend-api.com/api/auth/session \
  -H "Authorization: tma query_id=STAGING_TEST_QUERY_ID&user=%7B%22id%22%3A12345678%2C%22first_name%22%3A%22Test%22%2C%22username%22%3A%22tester%22%7D&auth_date=1700000000&hash=mock_hash"
# Expected: HTTP/1.1 200 OK (or 401 Unauthorized if invalid HMAC hash in production mode)
```

### Test 6: Round Start Endpoint
```bash
curl -i -X POST https://your-backend-api.com/api/round/start \
  -H "Content-Type: application/json" \
  -H "Authorization: tma query_id=STAGING_TEST_QUERY_ID..." \
  -d '{"mode":"classic"}'
# Expected: HTTP/1.1 200 OK with roundId, seed, and target parameters
```

---

## ✅ 8. Pre-Launch Operations Checklist

- [x] **Vercel Frontend**: `VITE_API_BASE_URL` points to persistent HTTPS backend API domain without trailing slashes.
- [x] **Express API**: `APP_ROLE=web-api` instance is running and listening on port 3000.
- [x] **Telegram Bot**: `APP_ROLE=telegram-bot` instance is active in long-polling mode (or webhook mode).
- [x] **Notification Worker**: `APP_ROLE=worker` instance is active and processing queue jobs every 30s.
- [x] **Database Isolation**: PostgreSQL (port 5432) and Redis (port 6379) ports are strictly bound to internal docker networks.
- [x] **Connection Pooling**: PgBouncer is configured in transaction pooling mode on port 6432.
- [x] **CORS Allowlist**: `CORS_ORIGIN` contains your exact Vercel frontend URL and Telegram WebView domains (`https://web.telegram.org`).
- [x] **Bot Menu Button**: Linked to your frontend Vercel URL via BotFather (`/setmenubutton`).
- [x] **GDPR Compliance**: `/delete_me` command in bot and `/api/user/delete-account` endpoint wipe user data and clear Redis cache.

---

## 🔄 9. Emergency Rollback Procedures

### Frontend Rollback (Vercel)
1. Go to [Vercel Dashboard](https://vercel.com) -> **Neon Orbit Project** -> **Deployments**.
2. Locate the previous stable deployment commit.
3. Click the **...** menu next to the stable deployment and select **Promote to Production**.
4. Traffic routes instantly (< 5 seconds) to the previous static build.

### Backend Rollback (Docker / Express Host)
1. Identify the previous stable Git commit SHA or Docker image tag:
   ```bash
   git log -n 5 --oneline
   ```
2. Revert code to the previous stable release:
   ```bash
   git checkout <PREVIOUS_STABLE_COMMIT_SHA>
   ```
3. Rebuild and restart backend Docker services:
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```
4. Verify backend health probes:
   ```bash
   curl -i http://localhost:3000/api/health/readiness
   ```
5. Check service logs for any migration or connection issues:
   ```bash
   docker-compose logs -f web_api
   ```
