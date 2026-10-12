# 🚀 Neon Orbit Deployment & BotFather Guide

Complete deployment instructions for Neon Orbit (Full-Stack Node.js + Express + React + PostgreSQL + Redis + Telegram Bot Mini App).

---

## 📋 1. Prerequisites & Environment Variables

Make sure the following environment variables are set in production:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server HTTP port | `3000` |
| `APP_URL` | Public HTTPS domain of your deployment | `https://neon-orbit.up.railway.app` |
| `TELEGRAM_BOT_TOKEN` | Bot API Token from @BotFather | `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ` |
| `BOT_USERNAME` | Telegram Bot username (without `@`) | `NeonOrbitBot` |
| `ADMIN_TELEGRAM_IDS` | Comma-separated admin Telegram IDs | `12345678,98765432` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/dbname` |
| `REDIS_URL` | Redis connection URL | `redis://default:pass@host:6379` |
| `WEBHOOK_SECRET` | Secret token for Telegram Webhook security | `random_secret_hash_key_123` |
| `JWT_SECRET` | Secret key for auth token signing | `random_jwt_secret_456` |

---

## 🛠️ 2. BotFather Setup (Telegram Mini App)

1. Open Telegram and search for **[@BotFather](https://t.me/BotFather)**.
2. Send `/newbot` or select your existing bot using `/mybots`.
3. **Configure Mini App Button:**
   - Select `/setmenubutton` -> Choose your bot -> Enter URL: `https://your-app-domain.com`.
4. **Configure WebApp Settings:**
   - Select `Bot Settings` -> `Menu Button` -> `Configure menu button`.
   - Set Title: `🎮 Play Neon Orbit`
   - Set WebApp URL: `https://your-app-domain.com`
5. **Enable Inline Mode (For Score Card Sharing):**
   - Select `/setinline` -> Choose your bot -> Set placeholder text: `Share high score...`
6. **Configure Commands List:**
   - Send `/setcommands` -> Choose your bot and paste the following list:
     ```text
     start - Launch Neon Orbit Mini App
     top - View chat & global leaderboards
     help - View game rules & pilot guide
     paysupport - Payment support for Telegram Stars
     privacy - Privacy policy & data management
     delete_me - Permanently delete personal account data
     ```
7. **Enable Telegram Stars Payments:**
   - Send `/mybots` -> Select Bot -> `Payments` -> Enable **Telegram Stars (XTR)**.

---

## 🚂 3. Deploying to Railway.app

1. Fork or push this repository to GitHub.
2. Log into [Railway.app](https://railway.app) and create a **New Project**.
3. **Add PostgreSQL & Redis Databases:**
   - Click **+ New** -> Database -> Add **PostgreSQL**.
   - Click **+ New** -> Database -> Add **Redis**.
4. **Deploy GitHub Repository:**
   - Click **+ New** -> **GitHub Repo** -> Select `neon-orbit`.
5. **Configure Variables in Railway:**
   - Go to your app service -> **Variables**.
   - Add `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - Add `REDIS_URL` = `${{Redis.REDIS_URL}}`
   - Add `TELEGRAM_BOT_TOKEN`, `BOT_USERNAME`, `ADMIN_TELEGRAM_IDS`, `APP_URL`, `WEBHOOK_SECRET`.
6. Railway automatically detects `Dockerfile` and deploys the unified server and bot!

---

## 🛸 4. Deploying to Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Launch Fly app: `fly launch`
3. Provision Postgres and Redis on Fly:
   - `fly postgres create`
   - `fly redis create`
4. Set secret variables:
   - `fly secrets set TELEGRAM_BOT_TOKEN="your_token" APP_URL="https://your-app.fly.dev" ADMIN_TELEGRAM_IDS="123456"`
5. Deploy: `fly deploy`

---

## 🐳 5. Running via Docker Compose Locally

```bash
# Clone and configure .env
cp .env.example .env

# Build and start all services (App + Postgres + Redis)
docker-compose up --build -d

# Check logs
docker-compose logs -f app
```

---

## 💾 6. Database Backups & Disaster Recovery

An automated snapshot script is located at `server/scripts/backup.sh`:

```bash
# Run manual compressed database backup
DATABASE_URL="postgresql://user:pass@host:5432/dbname" ./server/scripts/backup.sh

# Restore from a backup snapshot (e.g., in a test environment):
# 1. Ensure the database is clean or you are restoring to a fresh instance
# 2. Run the following command:
gunzip -c backups/neon_orbit_YYYYMMDD_HHMMSS.sql.gz | psql "${DATABASE_URL}"

# 3. Verification:
# After restoration, verify connectivity and table counts:
psql "${DATABASE_URL}" -c "\dt"
psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM users;"
```

For production (Railway / Fly.io / Cloud SQL), automate nightly backups using a cron job or Railway scheduled tasks with 7-day retention.

---

## ⚡ 7. Load Testing for 1,000 Concurrent Players (k6)

A complete scenario simulating 1,000 active pilots running full game cycles is provided in `load-test.js`.

### How to Run:
```bash
# 1. Install k6 (macOS: brew install k6, Linux: snap install k6)
# Or run with Docker:
docker run --rm -i -e TARGET_URL="http://host.docker.internal:3000" grafana/k6 run - <load-test.js

# 2. Run directly against local or staging server:
TARGET_URL="https://your-staging-domain.com" k6 run load-test.js
```

### Identified Bottlenecks & Architectural Mitigations:
1. **PostgreSQL Connection Starvation:**
   - *Risk:* 1,000 players submitting rounds simultaneously will exhaust standard `pg.Pool` (10 connections).
   - *Mitigation:* We made `DB_POOL_MAX` configurable (default 25–50) and recommend PgBouncer (session/transaction pooling) in production.
2. **Leaderboard Heavy Queries:**
   - *Risk:* `SELECT ... ORDER BY score DESC` on a large table with 1,000 concurrent requests creates severe disk I/O and query lag.
   - *Mitigation:* Handled via **Redis Sorted Sets** (`ZREVRANGE`, `ZREVRANK`). Leaderboard reads hit Redis cache in < 1ms; Postgres is only queried on cache misses.
3. **Crypto HMAC Overhead:**
   - *Risk:* Cryptographic SHA-256 HMAC verification of `initData` on every request consumes CPU cycles.
   - *Mitigation:* Validated sessions are cached in memory/Redis so repeat queries from the same user bypass repetitive HMAC hashing.
4. **Rate Limiting Protection:**
   - *Risk:* Burst attacks or autoclickers flooding round submissions.
   - *Mitigation:* Dedicated `roundSubmitLimiter` (max 30 submissions per 5 min) and `starsInvoiceLimiter` (max 30 per 15 min).

---

## ✅ 8. Pre-Launch Operations & Security Checklist

- [x] **Telegram Stars:** Verified `createInvoiceLink` uses authoritative server prices (no client tampering possible).
- [x] **Anti-Cheat:** Server-side `recalculateRound` validates target seed, tap frequency (<= 18 cps), tap rhythm stddev, and round duration (38–55s).
- [x] **Transactions:** Critical operations (`claimDaily`, `buyCosmetic`, `claimReferralTier`, `fulfillPayment`) execute inside `BEGIN ... FOR UPDATE ... COMMIT` transactions with row locking.
- [x] **Webhook Security:** Webhook secret token is verified by grammY using `WEBHOOK_SECRET` on `/telegram/webhook`.
- [x] **Input Validation:** All endpoints validate schemas via `zod` before processing.
- [x] **Privacy & GDPR:** `/delete_me` in bot and `/api/user/delete-account` in app cascade-delete user records and clean Redis cache.

