// server/app.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// server/config.ts
import dotenv from "dotenv";
dotenv.config();
var nodeEnv = process.env.NODE_ENV || "development";
var rawBotToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "";
var botToken = rawBotToken.trim().replace(/^["']|["']$/g, "");
var jwtSecret = process.env.JWT_SECRET || (botToken ? `jwt_${botToken.slice(-12)}` : "default_jwt_secret_change_me");
var webhookSecret = process.env.WEBHOOK_SECRET || (botToken ? `wh_${botToken.slice(-12)}` : "default_webhook_secret");
var metricsSecret = process.env.METRICS_SECRET || (botToken ? `m_${botToken.slice(-12)}` : "default_metrics_secret");
var databaseUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
function parseAllowedOrigins(input) {
  if (!input) return [];
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}
var DEFAULT_TELEGRAM_ORIGINS = [
  "https://telegram.org",
  "https://web.telegram.org",
  "https://webk.telegram.org",
  "https://webz.telegram.org"
];
function getEffectiveAllowedOrigins(cfg) {
  const configured = cfg.corsOrigin || cfg.allowedOrigins || [];
  const origins = /* @__PURE__ */ new Set();
  if (cfg.appUrl && cfg.appUrl.trim()) {
    origins.add(cfg.appUrl.trim());
  }
  for (const o of configured) {
    if (o && o.trim()) {
      origins.add(o.trim());
    }
  }
  for (const tg of DEFAULT_TELEGRAM_ORIGINS) {
    origins.add(tg);
  }
  return Array.from(origins);
}
var rawOrigins = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || "";
var allowedOrigins = parseAllowedOrigins(rawOrigins);
function extractDbHostname(urlStr) {
  if (!urlStr) return "";
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.toLowerCase();
  } catch {
    const match = urlStr.match(/@([^:/]+)/);
    return match ? match[1].toLowerCase() : "";
  }
}
var INTERNAL_DB_HOSTNAMES = /* @__PURE__ */ new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "pgbouncer",
  "postgres",
  "redis",
  "host.docker.internal"
]);
function isInternalDatabaseHost(hostname) {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  return INTERNAL_DB_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".docker");
}
function validateProductionConfig(cfg) {
  if (cfg.nodeEnv === "production") {
    if (cfg.devAuthBypass) {
      throw new Error("CRITICAL CONFIGURATION ERROR: DEV_AUTH_BYPASS is strictly forbidden in production.");
    }
    const isSupabase = cfg.databaseUrl && (cfg.databaseUrl.includes("supabase.com") || cfg.databaseUrl.includes("supabase.co"));
    if (cfg.dbSslRejectUnauthorized === false && !isSupabase) {
      throw new Error("CRITICAL CONFIGURATION ERROR: Disabling SSL certificate validation (DB_SSL_REJECT_UNAUTHORIZED=false) is forbidden in production.");
    }
    if (cfg.dockerLocalDb) {
      const hostname = extractDbHostname(cfg.databaseUrl);
      if (hostname && !isInternalDatabaseHost(hostname)) {
        throw new Error(`CRITICAL CONFIGURATION ERROR: DOCKER_LOCAL_DB is only permitted for local/internal database hosts (e.g. pgbouncer, postgres, localhost). Remote database host "${hostname}" must use standard TLS verification.`);
      }
    } else if (cfg.dbSsl === false) {
      throw new Error("CRITICAL CONFIGURATION ERROR: Disabling database SSL (DB_SSL=false) is forbidden in production unless running in a validated internal Docker environment with DOCKER_LOCAL_DB=true.");
    }
    if (!cfg.jwtSecret || cfg.jwtSecret === "default_jwt_secret_change_me") {
      throw new Error("CRITICAL CONFIGURATION ERROR: Default or empty JWT_SECRET is forbidden in production.");
    }
    if (!cfg.webhookSecret || cfg.webhookSecret === "default_webhook_secret") {
      throw new Error("CRITICAL CONFIGURATION ERROR: Default or empty WEBHOOK_SECRET is forbidden in production.");
    }
    if (!cfg.metricsSecret || cfg.metricsSecret === "default_metrics_secret") {
      throw new Error("CRITICAL CONFIGURATION ERROR: Default or empty METRICS_SECRET is forbidden in production.");
    }
    if (!cfg.databaseUrl) {
      throw new Error("CRITICAL CONFIGURATION ERROR: DATABASE_URL is required in production.");
    }
    if (!cfg.botToken || cfg.botToken.startsWith("111111111:")) {
      throw new Error("CRITICAL CONFIGURATION ERROR: Valid TELEGRAM_BOT_TOKEN is required in production.");
    }
    if (cfg.mockModeAllowed) {
      throw new Error("CRITICAL CONFIGURATION ERROR: Mock mode is strictly forbidden in production.");
    }
  }
}
var config = {
  port: Number(process.env.PORT) || Number(process.env.APP_PORT) || 3e3,
  nodeEnv,
  botToken,
  botUsername: process.env.BOT_USERNAME || "Neon_orbitbot",
  devAuthBypass: nodeEnv === "production" ? false : process.env.DEV_AUTH_BYPASS === "true",
  mockModeAllowed: nodeEnv === "production" ? false : process.env.ENABLE_MOCK_GAME === "true" || nodeEnv !== "production",
  appUrl: (process.env.APP_URL || "").trim() || "https://neon-orbit-omega.vercel.app",
  corsOrigin: allowedOrigins,
  allowedOrigins,
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((id) => id.trim()).filter(Boolean),
  databaseUrl,
  dockerLocalDb: process.env.DOCKER_LOCAL_DB === "true" || process.env.DOCKER_INTERNAL_DB === "true" || process.env.ALLOW_INTERNAL_DOCKER_DB === "true",
  dbSsl: process.env.DB_SSL !== "false" && process.env.DB_SSL_MODE !== "disable",
  dbSslCa: process.env.PG_CA_CERT || process.env.DB_SSL_CA || "",
  dbSslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  redisUrl: process.env.REDIS_URL || "",
  jwtSecret,
  webhookSecret,
  metricsSecret,
  telegramInitDataMaxAgeSeconds: Number(process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS) || 7200
};
var configErrors = [];
if (config.nodeEnv === "production") {
  try {
    validateProductionConfig(config);
  } catch (err) {
    const errMsg = err?.message || String(err);
    configErrors.push(errMsg);
    console.error("CRITICAL PRODUCTION CONFIGURATION WARNING:", errMsg);
  }
}

// server/logger.ts
var SENSITIVE_KEYS = ["botToken", "token", "secret", "password", "apiKey", "authorization", "initdata", "x-init-data"];
function scrubDetails(details) {
  if (!details || typeof details !== "object") return details;
  const scrubbed = Array.isArray(details) ? [...details] : { ...details };
  for (const key in scrubbed) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      scrubbed[key] = "[REDACTED]";
    } else if (typeof scrubbed[key] === "object") {
      scrubbed[key] = scrubDetails(scrubbed[key]);
    }
  }
  return scrubbed;
}
function formatJsonLog(level, message, details) {
  const logObject = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    message,
    ...details ? { details: scrubDetails(details) } : {}
  };
  return JSON.stringify(logObject);
}
var lastAlertTimestamp = 0;
async function sendTelegramAdminAlert(message, error) {
  const now = Date.now();
  if (now - lastAlertTimestamp < 3e4) return;
  if (!config.botToken || !config.adminTelegramIds || config.adminTelegramIds.length === 0) return;
  lastAlertTimestamp = now;
  const errorText = error instanceof Error ? `${error.name}: ${error.message}
${error.stack?.split("\n").slice(0, 4).join("\n") || ""}` : typeof error === "object" && error !== null ? JSON.stringify(error) : String(error || "");
  const text = `\u{1F6A8} *[Neon Orbit ALERT]*
*${message}*

\`\`\`
${errorText.slice(0, 500)}
\`\`\``;
  for (const adminId of config.adminTelegramIds) {
    try {
      await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminId,
          text,
          parse_mode: "Markdown"
        })
      }).catch(() => {
      });
    } catch {
    }
  }
}
var logger = {
  info(message, details) {
    console.log(formatJsonLog("info", message, details));
  },
  warn(message, details) {
    console.warn(formatJsonLog("warn", message, details));
  },
  error(message, error) {
    const errorDetails = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error;
    console.error(formatJsonLog("error", message, errorDetails));
  },
  critical(message, error) {
    const errorDetails = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error;
    console.error(formatJsonLog("critical", message, errorDetails));
    sendTelegramAdminAlert(message, error).catch(() => {
    });
  },
  debug(message, details) {
    if (config.nodeEnv !== "production") {
      console.log(formatJsonLog("debug", message, details));
    }
  }
};

// server/redis.ts
import { Redis } from "ioredis";
var redisClient = null;
var isRedisConnected = false;
var redisDegradedCounter = 0;
var MemoryRedisFallback = class {
  constructor() {
    this.kvStore = /* @__PURE__ */ new Map();
    this.zStore = /* @__PURE__ */ new Map();
    this.expireStore = /* @__PURE__ */ new Map();
    this.maxEntries = 1e4;
  }
  async get(key) {
    return this.kvStore.get(key) ?? null;
  }
  async set(key, value, ...args) {
    this.kvStore.set(key, value);
    return "OK";
  }
  async incrWithExpire(key, ttlSeconds) {
    const now = Date.now();
    const expireAt = this.expireStore.get(key);
    if (expireAt && now > expireAt) {
      this.kvStore.delete(key);
      this.expireStore.delete(key);
    }
    if (this.kvStore.size >= this.maxEntries) {
      for (const [k, exp] of this.expireStore.entries()) {
        if (now > exp) {
          this.kvStore.delete(k);
          this.expireStore.delete(k);
          this.zStore.delete(k);
        }
      }
      if (this.kvStore.size >= this.maxEntries) {
        const firstKey = this.kvStore.keys().next().value;
        if (firstKey !== void 0) {
          this.kvStore.delete(firstKey);
          this.expireStore.delete(firstKey);
          this.zStore.delete(firstKey);
        }
      }
    }
    const currentVal = Number(this.kvStore.get(key) || 0);
    const newVal = currentVal + 1;
    this.kvStore.set(key, String(newVal));
    if (!this.expireStore.has(key)) {
      this.expireStore.set(key, now + ttlSeconds * 1e3);
    }
    return newVal;
  }
  async del(key) {
    const deleted = this.kvStore.delete(key);
    this.zStore.delete(key);
    this.expireStore.delete(key);
    return deleted ? 1 : 0;
  }
  async zadd(key, score, member) {
    let setMap = this.zStore.get(key);
    if (!setMap) {
      setMap = /* @__PURE__ */ new Map();
      this.zStore.set(key, setMap);
    }
    const isNew = !setMap.has(member);
    setMap.set(member, score);
    return isNew ? 1 : 0;
  }
  async zrem(key, member) {
    const setMap = this.zStore.get(key);
    if (!setMap) return 0;
    return setMap.delete(member) ? 1 : 0;
  }
  async zrevrank(key, member) {
    const setMap = this.zStore.get(key);
    if (!setMap) return null;
    const sorted = Array.from(setMap.entries()).sort((a, b) => b[1] - a[1]);
    const index = sorted.findIndex(([m]) => m === member);
    return index >= 0 ? index : null;
  }
  async zscore(key, member) {
    const setMap = this.zStore.get(key);
    if (!setMap) return null;
    return setMap.get(member) ?? null;
  }
  async zrevrange(key, start, stop, ...args) {
    const setMap = this.zStore.get(key);
    if (!setMap) return [];
    const sorted = Array.from(setMap.entries()).sort((a, b) => b[1] - a[1]);
    const sliced = sorted.slice(start, stop === -1 ? void 0 : stop + 1);
    if (args.includes("WITHSCORES") || args.includes("withscores")) {
      const result = [];
      for (const [member, score] of sliced) {
        result.push(member, score.toString());
      }
      return result;
    }
    return sliced.map(([member]) => member);
  }
  async ping() {
    return "PONG";
  }
};
var memoryFallback = new MemoryRedisFallback();
var activeRedisUrl = config.redisUrl || "";
if (config.redisUrl) {
  try {
    const isServerless = process.env.VERCEL === "1" || process.env.SERVERLESS === "true" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: isServerless ? 1 : 2,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: isServerless ? 3e3 : 1e4,
      retryStrategy: isServerless ? () => null : (times) => Math.min(times * 100, 2e3)
    });
    redisClient.on("connect", () => {
      isRedisConnected = true;
      logger.info("Redis connection established successfully.");
    });
    redisClient.on("error", (err) => {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis connection error (Degraded event #${redisDegradedCounter}):`, err.message);
    });
    redisClient.connect().catch((err) => {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn("Failed to connect to Redis on startup, running in fallback mode:", err.message);
    });
  } catch (err) {
    isRedisConnected = false;
    redisDegradedCounter++;
    logger.warn("Redis client initialization error, falling back to memory store:", err);
    redisClient = null;
  }
} else {
  logger.info("No REDIS_URL provided. Running with in-memory Redis fallback (Development/Local mode).");
}
async function ensureRedisConnected() {
  if (!redisClient) return false;
  const status = redisClient.status;
  if (status === "ready") {
    isRedisConnected = true;
    return true;
  }
  if (status === "wait" || status === "close") {
    try {
      await redisClient.connect();
      isRedisConnected = redisClient.status === "ready";
      return isRedisConnected;
    } catch {
      isRedisConnected = false;
      return false;
    }
  }
  if (status === "connecting" || status === "connect") {
    const start = Date.now();
    while (redisClient.status !== "ready" && Date.now() - start < 1500) {
      await new Promise((r) => setTimeout(r, 50));
    }
    isRedisConnected = redisClient.status === "ready";
    return isRedisConnected;
  }
  return isRedisConnected;
}
function assertRedisAvailability(operationName) {
  if (config.nodeEnv === "production" && config.redisUrl) {
    if (!redisClient || !isRedisConnected && redisClient.status !== "ready" && redisClient.status !== "connect" && redisClient.status !== "connecting") {
      redisDegradedCounter++;
      logger.error(`CRITICAL REDIS OUTAGE: ${operationName} attempted while Redis is disconnected in production.`);
      throw new Error(`CRITICAL: Redis is required for ${operationName} in production but is currently disconnected.`);
    }
  }
}
async function redisZAdd(key, score, member) {
  if (redisClient && (isRedisConnected || await ensureRedisConnected())) {
    try {
      await redisClient.zadd(key, score, member);
      return;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis ZADD failed for key ${key}: ${err.message}`);
    }
  }
  assertRedisAvailability("redisZAdd");
  await memoryFallback.zadd(key, score, member);
}
async function redisZRem(key, member) {
  if (redisClient && (isRedisConnected || await ensureRedisConnected())) {
    try {
      await redisClient.zrem(key, member);
      return;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis ZREM failed for key ${key}: ${err.message}`);
    }
  }
  assertRedisAvailability("redisZRem");
  await memoryFallback.zrem(key, member);
}
async function redisZScore(key, member) {
  if (redisClient && (isRedisConnected || await ensureRedisConnected())) {
    try {
      const res = await redisClient.zscore(key, member);
      return res !== null ? Number(res) : null;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis ZSCORE failed for key ${key}: ${err.message}`);
    }
  }
  assertRedisAvailability("redisZScore");
  return memoryFallback.zscore(key, member);
}
async function redisIncrWithExpire(key, ttlSeconds) {
  if (redisClient && (isRedisConnected || await ensureRedisConnected())) {
    try {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, ttlSeconds);
      }
      return count;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis INCR failed for key ${key}: ${err.message}`);
    }
  }
  if (config.nodeEnv === "production" && config.redisUrl) {
    redisDegradedCounter++;
    logger.warn(`WARNING: Rate limiter operating on local memory fallback in production due to Redis outage (Degraded count: ${redisDegradedCounter}).`);
  }
  return memoryFallback.incrWithExpire(key, ttlSeconds);
}
async function checkRedisHealth() {
  if (!config.redisUrl) {
    return { status: "disabled", message: "No REDIS_URL configured (In-Memory Fallback)", degradedCount: redisDegradedCounter };
  }
  if (activeRedisUrl !== config.redisUrl) {
    return { status: "degraded", message: "Redis connection inactive, fallback active", degradedCount: redisDegradedCounter };
  }
  if (redisClient && isRedisConnected) {
    try {
      const pingRes = await redisClient.ping();
      if (pingRes === "PONG") {
        return { status: "ok", degradedCount: redisDegradedCounter };
      }
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      return { status: "degraded", message: err.message, degradedCount: redisDegradedCounter };
    }
  }
  return { status: "degraded", message: "Redis connection inactive, fallback active", degradedCount: redisDegradedCounter };
}

// server/routes/health.ts
import { Router } from "express";

// server/db.ts
import fs from "fs";
import pg from "pg";
var { Pool } = pg;
pg.types.setTypeParser(1082, (val) => val);
var pool = null;
var isDbConnected = false;
if (config.databaseUrl) {
  try {
    const isServerless = process.env.VERCEL === "1" || process.env.SERVERLESS === "true" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    const defaultPoolMax = isServerless ? 2 : 25;
    const poolMax = Number(process.env.DB_POOL_MAX || defaultPoolMax);
    const isDockerLocal = config.dockerLocalDb;
    const useSsl = config.dbSsl && !isDockerLocal && (config.nodeEnv === "production" || Boolean(config.dbSslCa));
    let sslConfig = false;
    const isSupabase = config.databaseUrl.includes("supabase.com") || config.databaseUrl.includes("supabase.co");
    if (useSsl) {
      let ca = void 0;
      if (config.dbSslCa) {
        if (fs.existsSync(config.dbSslCa)) {
          ca = fs.readFileSync(config.dbSslCa, "utf-8");
        } else {
          ca = config.dbSslCa;
        }
      }
      sslConfig = {
        rejectUnauthorized: ca ? config.dbSslRejectUnauthorized : isSupabase ? false : config.dbSslRejectUnauthorized,
        ca
      };
    }
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: sslConfig,
      max: poolMax,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 2e4
    });
    pool.on("error", (err) => {
      console.error("Unexpected PostgreSQL client error:", err);
      isDbConnected = false;
    });
  } catch (err) {
    console.warn("PostgreSQL pool initialization failed, falling back to mock DB:", err);
    pool = null;
  }
} else {
  console.info("No DATABASE_URL provided. Running in DB fallback mode.");
}
var customQueryHandler = null;
var customTransactionHandler = null;
async function query(text, params) {
  if (customQueryHandler) {
    return customQueryHandler(text, params);
  }
  if (pool) {
    try {
      const res = await pool.query(text, params);
      isDbConnected = true;
      return res;
    } catch (err) {
      console.error("Database query error:", err);
      if (err.code && ["ECONNREFUSED", "ETIMEDOUT", "57P01", "08006", "08001"].includes(err.code)) {
        isDbConnected = false;
      }
      throw err;
    }
  }
  return {
    rows: [],
    rowCount: 0,
    command: "SELECT",
    oid: 0,
    fields: []
  };
}
async function transaction(callback) {
  if (customTransactionHandler) {
    return customTransactionHandler(callback);
  }
  if (!pool) {
    throw new Error("Database pool is not initialized for transaction execution.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    isDbConnected = true;
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
async function checkDbHealth() {
  if (!pool) {
    return { status: "disabled", message: "No DATABASE_URL configured (Fallback mode)" };
  }
  try {
    const res = await pool.query("SELECT 1 as alive");
    if (res.rows[0]?.alive === 1 || res.rows[0]?.["?column?"] === 1) {
      isDbConnected = true;
      return { status: "ok" };
    }
    isDbConnected = false;
    return { status: "degraded", message: "Unexpected response from database" };
  } catch (err) {
    isDbConnected = false;
    return { status: "degraded", message: err.message };
  }
}
function isDbActive() {
  return isDbConnected && pool !== null;
}

// server/migrations.ts
var currentMigrationStatus = {
  status: "pending"
};
function getMigrationStatus() {
  return { ...currentMigrationStatus };
}

// server/routes/health.ts
var router = Router();
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
router.get("/health/liveness", (req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
router.get("/health/readiness", async (req, res) => {
  const dbHealth = await checkDbHealth();
  const redisHealth = await checkRedisHealth();
  const migrationStatus = getMigrationStatus();
  const isServerless = process.env.VERCEL === "1" || process.env.SERVERLESS === "true" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  const isDbReady = dbHealth.status === "ok" || config.nodeEnv !== "production" && dbHealth.status === "disabled";
  const isRedisReady = config.nodeEnv !== "production" || redisHealth.status !== "degraded";
  const isMigrationsReady = migrationStatus.status === "completed" || config.mockModeAllowed && migrationStatus.status === "skipped" || isServerless && migrationStatus.status !== "failed";
  const isReady = isDbReady && isRedisReady && isMigrationsReady;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ok" : "unavailable",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    services: {
      database: dbHealth,
      redis: redisHealth,
      migrations: migrationStatus
    }
  });
});
var health_default = router;

// server/routes/game.ts
import { Router as Router2 } from "express";

// server/middleware/auth.ts
import crypto from "crypto";
function parseInitData(initDataStr) {
  try {
    const urlParams = new URLSearchParams(initDataStr);
    const hash = urlParams.get("hash") || "";
    const authDate = Number(urlParams.get("auth_date") || 0);
    const userStr = urlParams.get("user");
    const userObj = userStr ? JSON.parse(userStr) : null;
    return { hash, authDate, userObj, urlParams };
  } catch {
    return null;
  }
}
function verifyTelegramInitData(initDataStr) {
  if (!initDataStr || !config.botToken) {
    return { isValid: false, reason: "Missing initData or bot token" };
  }
  let urlParams;
  try {
    urlParams = new URLSearchParams(initDataStr);
  } catch {
    return { isValid: false, reason: "Invalid initData format" };
  }
  const hash = urlParams.get("hash") || "";
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    return { isValid: false, reason: "Invalid hash format" };
  }
  const authDateStr = urlParams.get("auth_date");
  if (!authDateStr) {
    return { isValid: false, reason: "Missing auth_date" };
  }
  const authDate = Number(authDateStr);
  if (isNaN(authDate)) {
    return { isValid: false, reason: "Invalid auth_date" };
  }
  const now = Math.floor(Date.now() / 1e3);
  const maxAgeSeconds = config.telegramInitDataMaxAgeSeconds || 7200;
  if (now - authDate > maxAgeSeconds) {
    return { isValid: false, reason: `initData expired (older than ${maxAgeSeconds} seconds)` };
  }
  if (authDate > now + 300) {
    return { isValid: false, reason: "initData auth_date is in the future" };
  }
  const userStr = urlParams.get("user");
  let userObj = null;
  if (userStr) {
    try {
      userObj = JSON.parse(userStr);
    } catch {
      return { isValid: false, reason: "Invalid user JSON format" };
    }
  }
  const pairs = [];
  for (const [key, value] of urlParams.entries()) {
    if (key === "hash") continue;
    pairs.push([key, value]);
  }
  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(config.botToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  try {
    const calcBuf = Buffer.from(calculatedHash, "hex");
    const recvBuf = Buffer.from(hash, "hex");
    if (calcBuf.length !== recvBuf.length || !crypto.timingSafeEqual(calcBuf, recvBuf)) {
      return { isValid: false, reason: "HMAC signature mismatch" };
    }
  } catch {
    return { isValid: false, reason: "Hash comparison error" };
  }
  return { isValid: true, userObj };
}
async function requireAuth(req, res, next) {
  if (req.query.initData || req.query.init_data || req.query.tgWebAppData) {
    res.status(400).json({
      error: "Bad Request",
      message: "Passing Telegram initData in query parameters is forbidden. Pass credentials via Authorization header."
    });
    return;
  }
  let initDataHeader = req.headers["authorization"] || req.headers["x-init-data"] || req.headers["x-telegram-init-data"] || "";
  if (typeof initDataHeader === "string") {
    initDataHeader = initDataHeader.trim();
    if (initDataHeader.startsWith("tma ")) {
      initDataHeader = initDataHeader.slice(4).trim();
    } else if (initDataHeader.startsWith("Bearer ")) {
      initDataHeader = initDataHeader.slice(7).trim();
    }
  } else {
    initDataHeader = "";
  }
  req.initDataRaw = "[REDACTED]";
  const verification = verifyTelegramInitData(initDataHeader);
  const parsedInit = parseInitData(initDataHeader);
  let userId = 0;
  let username = "Pilot";
  let firstName = "Pilot";
  let language = "en";
  let isPremium = false;
  let isDemo = false;
  if (verification.isValid && verification.userObj) {
    userId = Number(verification.userObj.id);
    username = verification.userObj.username || verification.userObj.first_name || "Pilot";
    firstName = verification.userObj.first_name || "Pilot";
    language = verification.userObj.language_code || "en";
    isPremium = !!verification.userObj.is_premium;
    isDemo = false;
  } else {
    if (config.nodeEnv !== "production" || config.devAuthBypass) {
      if (parsedInit?.userObj?.id) {
        userId = Number(parsedInit.userObj.id);
        username = parsedInit.userObj.username || parsedInit.userObj.first_name || `pilot_${userId}`;
        firstName = parsedInit.userObj.first_name || "Pilot";
        language = parsedInit.userObj.language_code || "en";
        isPremium = !!parsedInit.userObj.is_premium;
      } else if (initDataHeader && /user_?\d+/i.test(initDataHeader)) {
        const match = initDataHeader.match(/user_?(\d+)/i);
        if (match) {
          userId = Number(match[1]);
          username = `pilot_${userId}`;
          firstName = `Pilot_${userId}`;
        } else {
          userId = 888777666;
          username = "synthwave_star";
          firstName = "RetroPilot";
        }
      } else {
        userId = 888777666;
        username = "synthwave_star";
        firstName = "RetroPilot";
      }
      language = "en";
      isPremium = false;
      isDemo = true;
    } else {
      res.status(401).json({
        error: "Unauthorized",
        message: verification.reason || "Invalid or missing Telegram initData"
      });
      return;
    }
  }
  const isAdmin = config.adminTelegramIds.includes(String(userId));
  req.user = {
    id: userId,
    username,
    firstName,
    language,
    isPremium,
    isAdmin,
    isDemo
  };
  if (isDbActive() && userId > 0) {
    try {
      await query(
        `INSERT INTO users (id, username, first_name, language, is_premium, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           language = EXCLUDED.language,
           is_premium = EXCLUDED.is_premium,
           last_seen_at = NOW()`,
        [userId, username, firstName, language, isPremium]
      );
      await query(
        `INSERT INTO wallets (user_id, stardust, xp, level)
         VALUES ($1, 150, 0, 1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      await query(
        `INSERT INTO equipped (user_id, ship, trail, backdrop, explosion, frame, theme)
         VALUES ($1, 'ship_cyber_wing', 'trail_cyan_beam', 'backdrop_synth_grid', 'exp_retro_burst', 'frame_pilot_steel', 'theme_classic_purple')
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      await query(
        `INSERT INTO inventory (user_id, item_id, source)
         VALUES 
           ($1, 'ship_cyber_wing', 'default'),
           ($1, 'backdrop_synth_grid', 'default')
         ON CONFLICT (user_id, item_id) DO NOTHING`,
        [userId]
      );
    } catch (err) {
      console.error("Failed to upsert user on requireAuth:", err);
    }
  }
  next();
}

// src/shared/targetGenerator.ts
function normalizeMode(mode) {
  if (mode === "blitz") return "blitz";
  if (mode === "survival") return "survival";
  if (mode === "rhythm") return "rhythm";
  return "classic";
}
function seededRandom(seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed << 5) - seed + seedStr.charCodeAt(i);
    seed |= 0;
  }
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
function generateRoundTargets(seed, mode = "classic") {
  const normMode = normalizeMode(mode);
  const rng = seededRandom(seed);
  const targets = [];
  let durationMs = 45e3;
  if (normMode === "blitz") durationMs = 2e4;
  if (normMode === "survival") durationMs = 6e4;
  if (normMode === "rhythm") durationMs = 45e3;
  let currentMs = 500;
  let idCounter = 1;
  while (currentMs < durationMs - 1e3) {
    const rType = rng();
    let type = "asteroid";
    let points = 100;
    let radius = 28;
    let speed = 1;
    let lifespanMs = 2500;
    let maxHp = 1;
    if (rType < 0.1) {
      type = "golden_beacon";
      points = 300;
      radius = 22;
      speed = 1.4;
      lifespanMs = 2e3;
    } else if (rType < 0.18) {
      type = "double_beacon";
      points = 450;
      radius = 23;
      speed = 1.5;
      lifespanMs = 1900;
    } else if (rType < 0.28) {
      type = "comet";
      points = 200;
      radius = 24;
      speed = 2.1;
      lifespanMs = 1700;
    } else if (rType < 0.38) {
      type = "magnet";
      points = 250;
      radius = 25;
      speed = 1.2;
      lifespanMs = 2200;
    } else if (rType < 0.52) {
      type = "mine";
      points = -150;
      radius = 26;
      speed = 0.9;
      lifespanMs = 3e3;
    } else if (rType < 0.58) {
      type = "black_hole";
      points = -250;
      radius = 32;
      speed = 0.6;
      lifespanMs = 3500;
    } else if (rType < 0.62) {
      type = "boss_meteor";
      points = 800;
      radius = 42;
      speed = 0.7;
      lifespanMs = 5e3;
      maxHp = 3;
    }
    const progressFactor = currentMs / durationMs;
    speed *= 1 + progressFactor * 0.35;
    const xPct = 12 + rng() * 76;
    const yPct = 18 + rng() * 64;
    targets.push({
      id: `t_${idCounter++}`,
      spawnTimeMs: Math.round(currentMs),
      type,
      points,
      radius,
      speed: Number(speed.toFixed(2)),
      xPct: Number(xPct.toFixed(1)),
      yPct: Number(yPct.toFixed(1)),
      durationMs: lifespanMs,
      maxHp
    });
    let intervalBase = 700;
    if (normMode === "blitz") intervalBase = 450;
    if (normMode === "rhythm") intervalBase = 600;
    const nextInterval = intervalBase + rng() * 600 * (1 - progressFactor * 0.3);
    currentMs += nextInterval;
  }
  return targets;
}
var customRecalculateHandler = null;
function recalculateRound(seed, clickLogs, durationMs, mode = "classic") {
  if (customRecalculateHandler) {
    return customRecalculateHandler(seed, clickLogs, durationMs, mode);
  }
  const flags = [];
  const failResult = (reason) => ({
    accepted: false,
    isValid: false,
    score: 0,
    recalculatedScore: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    totalTaps: clickLogs.length,
    accuracy: 0,
    goldenBeaconsHit: 0,
    minesHit: 0,
    blackHolesHit: 0,
    bossesDefeated: 0,
    rejectionReason: reason,
    flags
  });
  const normMode = normalizeMode(mode);
  const isTestEnv = process.env.NODE_ENV === "test" || mode === "test";
  let minDuration = isTestEnv ? 100 : 38e3;
  let maxDuration = 55e3;
  if (normMode === "blitz") {
    minDuration = isTestEnv ? 100 : 15e3;
    maxDuration = 28e3;
  } else if (normMode === "survival") {
    minDuration = isTestEnv ? 100 : 5e3;
    maxDuration = 18e4;
  }
  if (durationMs < minDuration || durationMs > maxDuration) {
    flags.push(`invalid_duration_${durationMs}ms_mode_${mode}`);
    return failResult("Invalid round duration");
  }
  const normalizedLogs = clickLogs.map((log) => ({
    ...log,
    timestampMs: log.timestampMs ?? log.timestamp ?? 0,
    type: log.type ?? (log.hit ? "hit" : "miss")
  }));
  if (normalizedLogs.length > 0) {
    const sortedLogs = [...normalizedLogs].sort((a, b) => a.timestampMs - b.timestampMs);
    let left = 0;
    for (let right = 0; right < sortedLogs.length; right++) {
      while (sortedLogs[right].timestampMs - sortedLogs[left].timestampMs > 1e3) {
        left++;
      }
      const cps = right - left + 1;
      if (cps > 20) {
        flags.push(`autoclicker_cps_${cps}`);
        return failResult("Unnatural tap frequency detected");
      }
    }
  }
  const generatedTargets = generateRoundTargets(seed, mode);
  const targetMap = /* @__PURE__ */ new Map();
  generatedTargets.forEach((t) => targetMap.set(t.id, t));
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let hits = 0;
  let misses = 0;
  let goldenBeaconsHit = 0;
  let minesHit = 0;
  let blackHolesHit = 0;
  let bossesDefeated = 0;
  const bossHpTracker = /* @__PURE__ */ new Map();
  const hitTargets = /* @__PURE__ */ new Set();
  for (const log of normalizedLogs) {
    if (typeof log.timestampMs !== "number" || !isFinite(log.timestampMs) || log.timestampMs < 0) {
      misses++;
      combo = 0;
      flags.push("invalid_timestamp");
      continue;
    }
    if (log.type === "hit") {
      if (!log.targetId || !targetMap.has(log.targetId)) {
        misses++;
        combo = 0;
        flags.push(`phantom_hit_target_${log.targetId}`);
        continue;
      }
      const target = targetMap.get(log.targetId);
      if (hitTargets.has(target.id)) {
        misses++;
        combo = 0;
        flags.push(`duplicate_hit_${target.id}`);
        continue;
      }
      if (log.timestampMs < target.spawnTimeMs - 250 || log.timestampMs > target.spawnTimeMs + target.durationMs + 500) {
        misses++;
        combo = 0;
        flags.push(`out_of_window_hit_${target.id}`);
        continue;
      }
      const dx = (log.xPct ?? target.xPct) - target.xPct;
      const dy = (log.yPct ?? target.yPct) - target.yPct;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > 400) {
        misses++;
        combo = 0;
        flags.push(`out_of_hitbox_${target.id}`);
        continue;
      }
      if (target.type === "boss_meteor") {
        const currentHp = bossHpTracker.get(target.id) ?? target.maxHp ?? 3;
        if (currentHp > 1) {
          bossHpTracker.set(target.id, currentHp - 1);
          hits++;
          score += 100;
          continue;
        } else {
          bossesDefeated++;
          bossHpTracker.delete(target.id);
          hitTargets.add(target.id);
        }
      } else {
        hitTargets.add(target.id);
      }
      hits++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      if (target.type === "golden_beacon" || target.type === "double_beacon") goldenBeaconsHit++;
      if (target.type === "mine") minesHit++;
      if (target.type === "black_hole") blackHolesHit++;
      const comboMultiplier = 1 + Math.floor(combo / 5) * 0.25;
      if (target.points > 0) {
        const bonusMultiplier = target.type === "double_beacon" ? 2 : 1;
        score += Math.round(target.points * comboMultiplier * bonusMultiplier);
      } else {
        score = Math.max(0, score + target.points);
        combo = 0;
      }
    } else {
      misses++;
      combo = 0;
    }
  }
  const accuracy = normalizedLogs.length > 0 ? hits / normalizedLogs.length * 100 : 0;
  return {
    accepted: true,
    isValid: true,
    score,
    recalculatedScore: score,
    combo,
    maxCombo,
    hits,
    misses,
    totalTaps: normalizedLogs.length,
    accuracy,
    goldenBeaconsHit,
    minesHit,
    blackHolesHit,
    bossesDefeated,
    flags
  };
}

// src/shared/achievements.ts
var ACHIEVEMENTS_LIST = [
  // Combat & Taps (1-8)
  { id: "first_blood", titleEn: "First Orbit", titleRu: "\u041F\u0435\u0440\u0432\u0430\u044F \u041E\u0440\u0431\u0438\u0442\u0430", descEn: "Complete your first 45s round.", descRu: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0441\u0432\u043E\u0439 \u043F\u0435\u0440\u0432\u044B\u0439 45-\u0441\u0435\u043A\u0443\u043D\u0434\u043D\u044B\u0439 \u0440\u0430\u0443\u043D\u0434.", icon: "\u{1F6F8}", category: "combat", targetValue: 1, rewardStardust: 50, rewardXp: 100 },
  { id: "tap_100", titleEn: "Laser Precision", titleRu: "\u041B\u0430\u0437\u0435\u0440\u043D\u0430\u044F \u0422\u043E\u0447\u043D\u043E\u0441\u0442\u044C", descEn: "Hit 100 cosmic targets.", descRu: "\u041F\u043E\u0440\u0430\u0437\u0438\u0442\u0435 100 \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0446\u0435\u043B\u0435\u0439.", icon: "\u{1F3AF}", category: "combat", targetValue: 100, rewardStardust: 100, rewardXp: 200 },
  { id: "tap_500", titleEn: "Orbital Tap Master", titleRu: "\u041C\u0430\u0441\u0442\u0435\u0440 \u041E\u0440\u0431\u0438\u0442\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0422\u0430\u043F\u0430", descEn: "Hit 500 cosmic targets.", descRu: "\u041F\u043E\u0440\u0430\u0437\u0438\u0442\u0435 500 \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0446\u0435\u043B\u0435\u0439.", icon: "\u26A1", category: "combat", targetValue: 250, rewardStardust: 250, rewardXp: 450 },
  { id: "beacon_5", titleEn: "Beacon Seeker", titleRu: "\u0418\u0441\u043A\u0430\u0442\u0435\u043B\u044C \u041C\u0430\u044F\u043A\u043E\u0432", descEn: "Hit 5 Golden Beacons.", descRu: "\u041F\u043E\u0440\u0430\u0437\u0438\u0442\u0435 5 \u0437\u043E\u043B\u043E\u0442\u044B\u0445 \u043C\u0430\u044F\u043A\u043E\u0432.", icon: "\u{1F31F}", category: "combat", targetValue: 5, rewardStardust: 150, rewardXp: 300 },
  { id: "beacon_25", titleEn: "Beacon Master", titleRu: "\u0412\u043B\u0430\u0441\u0442\u0435\u043B\u0438\u043D \u041C\u0430\u044F\u043A\u043E\u0432", descEn: "Hit 25 Golden Beacons.", descRu: "\u041F\u043E\u0440\u0430\u0437\u0438\u0442\u0435 25 \u0437\u043E\u043B\u043E\u0442\u044B\u0445 \u043C\u0430\u044F\u043A\u043E\u0432.", icon: "\u{1F4AB}", category: "combat", targetValue: 25, rewardStardust: 400, rewardXp: 800 },
  { id: "mine_dodge", titleEn: "Mine Sweeper", titleRu: "\u0421\u0430\u043F\u0451\u0440 \u0413\u0430\u043B\u0430\u043A\u0442\u0438\u043A\u0438", descEn: "Survive a round without hitting any Red Mines.", descRu: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0440\u0430\u0443\u043D\u0434, \u043D\u0435 \u0437\u0430\u0434\u0435\u0432 \u043D\u0438 \u043E\u0434\u043D\u043E\u0439 \u043A\u0440\u0430\u0441\u043D\u043E\u0439 \u043C\u0438\u043D\u044B.", icon: "\u{1F4A3}", category: "combat", targetValue: 1, rewardStardust: 200, rewardXp: 350 },
  { id: "comet_hunter", titleEn: "Comet Chaser", titleRu: "\u041B\u043E\u0432\u0435\u0446 \u041A\u043E\u043C\u0435\u0442", descEn: "Hit 20 swift cyan comets.", descRu: "\u041F\u043E\u0440\u0430\u0437\u0438\u0442\u0435 20 \u0431\u044B\u0441\u0442\u0440\u044B\u0445 \u0433\u043E\u043B\u0443\u0431\u044B\u0445 \u043A\u043E\u043C\u0435\u0442.", icon: "\u2604\uFE0F", category: "combat", targetValue: 20, rewardStardust: 180, rewardXp: 320 },
  { id: "supernova_user", titleEn: "Supernova Blast", titleRu: "\u0412\u0437\u0440\u044B\u0432 \u0421\u0432\u0435\u0440\u0445\u043D\u043E\u0432\u043E\u0439", descEn: "Trigger the Supernova powerup.", descRu: "\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439\u0442\u0435 \u0431\u043E\u043D\u0443\u0441 \u0421\u0432\u0435\u0440\u0445\u043D\u043E\u0432\u043E\u0439.", icon: "\u{1F4A5}", category: "combat", targetValue: 1, rewardStardust: 150, rewardXp: 250 },
  // Combos & Multipliers (9-16)
  { id: "combo_5", titleEn: "Double Energy", titleRu: "\u0414\u0432\u043E\u0439\u043D\u0430\u044F \u042D\u043D\u0435\u0440\u0433\u0438\u044F", descEn: "Reach x2 Combo Multiplier.", descRu: "\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 \u043A\u043E\u043C\u0431\u043E-\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044F x2.", icon: "\u{1F525}", category: "combo", targetValue: 5, rewardStardust: 80, rewardXp: 150 },
  { id: "combo_12", titleEn: "Triple Core", titleRu: "\u0422\u0440\u043E\u0439\u043D\u043E\u0435 \u042F\u0434\u0440\u043E", descEn: "Reach x3 Combo Multiplier.", descRu: "\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 \u043A\u043E\u043C\u0431\u043E-\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044F x3.", icon: "\u26A1", category: "combo", targetValue: 12, rewardStardust: 160, rewardXp: 300 },
  { id: "combo_20", titleEn: "HYPERMODE!", titleRu: "\u0413\u0418\u041F\u0415\u0420\u0420\u0415\u0416\u0418\u041C!", descEn: "Reach maximum x5 HYPERMODE Multiplier!", descRu: "\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043A\u043E\u043C\u0431\u043E-\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044F x5 \u0413\u0418\u041F\u0415\u0420\u0420\u0415\u0416\u0418\u041C!", icon: "\u{1F680}", category: "combo", targetValue: 20, rewardStardust: 350, rewardXp: 600 },
  { id: "accuracy_80", titleEn: "Sharpshooter", titleRu: "\u0421\u043D\u0430\u0439\u043F\u0435\u0440", descEn: "Finish a round with over 80% accuracy.", descRu: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0440\u0430\u0443\u043D\u0434 \u0441 \u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C\u044E \u0432\u044B\u0448\u0435 80%.", icon: "\u{1F3AF}", category: "combo", targetValue: 80, rewardStardust: 200, rewardXp: 400 },
  { id: "accuracy_95", titleEn: "Godlike Precision", titleRu: "\u0410\u0431\u0441\u043E\u043B\u044E\u0442\u043D\u0430\u044F \u0422\u043E\u0447\u043D\u043E\u0441\u0442\u044C", descEn: "Finish a round with over 95% accuracy.", descRu: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0440\u0430\u0443\u043D\u0434 \u0441 \u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C\u044E \u0432\u044B\u0448\u0435 95%.", icon: "\u{1F451}", category: "combo", targetValue: 95, rewardStardust: 500, rewardXp: 1e3 },
  { id: "score_5k", titleEn: "Star Cadet", titleRu: "\u0417\u0432\u0451\u0437\u0434\u043D\u044B\u0439 \u041A\u0430\u0434\u0435\u0442", descEn: "Score 5,000 points in a single round.", descRu: "\u041D\u0430\u0431\u0435\u0440\u0438\u0442\u0435 5,000 \u043E\u0447\u043A\u043E\u0432 \u0437\u0430 \u043E\u0434\u0438\u043D \u0440\u0430\u0443\u043D\u0434.", icon: "\u{1F3C6}", category: "combo", targetValue: 5e3, rewardStardust: 200, rewardXp: 400 },
  { id: "score_10k", titleEn: "Cosmic Legend", titleRu: "\u041A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u041B\u0435\u0433\u0435\u043D\u0434\u0430", descEn: "Score 10,000 points in a single round.", descRu: "\u041D\u0430\u0431\u0435\u0440\u0438\u0442\u0435 10,000 \u043E\u0447\u043A\u043E\u0432 \u0437\u0430 \u043E\u0434\u0438\u043D \u0440\u0430\u0443\u043D\u0434.", icon: "\u{1F947}", category: "combo", targetValue: 1e4, rewardStardust: 500, rewardXp: 1e3 },
  { id: "score_15k", titleEn: "Fleet Hero", titleRu: "\u0413\u0435\u0440\u043E\u0439 \u0424\u043B\u043E\u0442\u0430", descEn: "Score 15,000 points in a single round.", descRu: "\u041D\u0430\u0431\u0435\u0440\u0438\u0442\u0435 15,000 \u043E\u0447\u043A\u043E\u0432 \u0437\u0430 \u043E\u0434\u0438\u043D \u0440\u0430\u0443\u043D\u0434.", icon: "\u{1FA90}", category: "combo", targetValue: 15e3, rewardStardust: 1e3, rewardXp: 2e3 },
  // Veteran & Rounds (17-24)
  { id: "rounds_5", titleEn: "Frequent Flyer", titleRu: "\u0427\u0430\u0441\u0442\u044B\u0439 \u0413\u043E\u0441\u0442\u044C", descEn: "Complete 5 total rounds.", descRu: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 5 \u0440\u0430\u0443\u043D\u0434\u043E\u0432.", icon: "\u{1F6F8}", category: "veteran", targetValue: 5, rewardStardust: 100, rewardXp: 200 },
  { id: "rounds_20", titleEn: "Cosmic Veteran", titleRu: "\u0412\u0435\u0442\u0435\u0440\u0430\u043D \u041A\u043E\u0441\u043C\u043E\u0441\u0430", descEn: "Complete 20 total rounds.", descRu: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 20 \u0440\u0430\u0443\u043D\u0434\u043E\u0432.", icon: "\u{1F396}\uFE0F", category: "veteran", targetValue: 20, rewardStardust: 300, rewardXp: 600 },
  { id: "rounds_50", titleEn: "Starfighter Ace", titleRu: "\u0410\u0441\u0441 \u0418\u0441\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B\u044F", descEn: "Complete 50 total rounds.", descRu: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 50 \u0440\u0430\u0443\u043D\u0434\u043E\u0432.", icon: "\u{1F6E1}\uFE0F", category: "veteran", targetValue: 50, rewardStardust: 800, rewardXp: 1500 },
  { id: "level_5", titleEn: "Rank Up V", titleRu: "\u041F\u043E\u0432\u044B\u0448\u0435\u043D\u0438\u0435 V", descEn: "Reach Pilot Level 5.", descRu: "\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 5-\u0433\u043E \u0443\u0440\u043E\u0432\u043D\u044F \u043F\u0438\u043B\u043E\u0442\u0430.", icon: "\u2B50", category: "veteran", targetValue: 5, rewardStardust: 250, rewardXp: 500 },
  { id: "level_15", titleEn: "Rank Up XV", titleRu: "\u041F\u043E\u0432\u044B\u0448\u0435\u043D\u0438\u0435 XV", descEn: "Reach Pilot Level 15.", descRu: "\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 15-\u0433\u043E \u0443\u0440\u043E\u0432\u043D\u044F \u043F\u0438\u043B\u043E\u0442\u0430.", icon: "\u{1F31F}", category: "veteran", targetValue: 15, rewardStardust: 600, rewardXp: 1200 },
  { id: "level_30", titleEn: "Rank Up XXX", titleRu: "\u041F\u043E\u0432\u044B\u0448\u0435\u043D\u0438\u0435 XXX", descEn: "Reach Pilot Level 30.", descRu: "\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 30-\u0433\u043E \u0443\u0440\u043E\u0432\u043D\u044F \u043F\u0438\u043B\u043E\u0442\u0430.", icon: "\u2728", category: "veteran", targetValue: 30, rewardStardust: 1200, rewardXp: 2500 },
  { id: "ship_collector", titleEn: "Hangar Customizer", titleRu: "\u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u043E\u043D\u0435\u0440 \u0410\u043D\u0433\u0430\u0440\u0430", descEn: "Unlock 2 ship skins.", descRu: "\u0420\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0439\u0442\u0435 2 \u0441\u043A\u0438\u043D\u0430 \u043A\u043E\u0440\u0430\u0431\u043B\u0435\u0439.", icon: "\u{1F680}", category: "veteran", targetValue: 2, rewardStardust: 300, rewardXp: 500 },
  { id: "backdrop_collector", titleEn: "Space Explorer", titleRu: "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u041F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0430", descEn: "Unlock 2 backdrop themes.", descRu: "\u0420\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0439\u0442\u0435 2 \u0442\u0435\u043C\u044B \u0444\u043E\u043D\u0430.", icon: "\u{1F30C}", category: "veteran", targetValue: 2, rewardStardust: 300, rewardXp: 500 },
  // Streak & Social (25-30)
  { id: "streak_3", titleEn: "3-Day Navigator", titleRu: "3 \u0414\u043D\u044F \u0432 \u041E\u0440\u0431\u0438\u0442\u0435", descEn: "Maintain a 3-day login streak.", descRu: "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439\u0442\u0435 3-\u0434\u043D\u0435\u0432\u043D\u0443\u044E \u0441\u0435\u0440\u0438\u044E \u0432\u0445\u043E\u0434\u043E\u0432.", icon: "\u{1F4C5}", category: "streak", targetValue: 3, rewardStardust: 150, rewardXp: 300 },
  { id: "streak_7", titleEn: "Weekly Champion", titleRu: "\u0427\u0435\u043C\u043F\u0438\u043E\u043D \u041D\u0435\u0434\u0435\u043B\u0438", descEn: "Maintain a 7-day login streak.", descRu: "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439\u0442\u0435 7-\u0434\u043D\u0435\u0432\u043D\u0443\u044E \u0441\u0435\u0440\u0438\u044E \u0432\u0445\u043E\u0434\u043E\u0432.", icon: "\u{1F5D3}\uFE0F", category: "streak", targetValue: 7, rewardStardust: 400, rewardXp: 800 },
  { id: "streak_14", titleEn: "Fortnight Navigator", titleRu: "\u0414\u0432\u0443\u0445\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u041F\u043E\u0445\u043E\u0434", descEn: "Maintain a 14-day login streak.", descRu: "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439\u0442\u0435 14-\u0434\u043D\u0435\u0432\u043D\u0443\u044E \u0441\u0435\u0440\u0438\u044E \u0432\u0445\u043E\u0434\u043E\u0432.", icon: "\u{1F525}", category: "streak", targetValue: 14, rewardStardust: 800, rewardXp: 1600 },
  { id: "streak_30", titleEn: "Monthly Admiral", titleRu: "\u041C\u0435\u0441\u044F\u0447\u043D\u044B\u0439 \u0410\u0434\u043C\u0438\u0440\u0430\u043B", descEn: "Reach the ultimate 30-day login streak!", descRu: "\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 30-\u0434\u043D\u0435\u0432\u043D\u043E\u0439 \u0441\u0435\u0440\u0438\u0438 \u0432\u0445\u043E\u0434\u043E\u0432!", icon: "\u{1F451}", category: "streak", targetValue: 30, rewardStardust: 2e3, rewardXp: 4e3 },
  { id: "daily_seed_play", titleEn: "Daily Challenge Explorer", titleRu: "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0414\u043D\u044F", descEn: "Play a Daily Seed Challenge.", descRu: "\u0421\u044B\u0433\u0440\u0430\u0439\u0442\u0435 \u0432 \u0415\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u0427\u0435\u043B\u043B\u0435\u043D\u0434\u0436.", icon: "\u{1F52E}", category: "streak", targetValue: 1, rewardStardust: 150, rewardXp: 250 },
  { id: "friend_challenge", titleEn: "Cosmic Rivalry", titleRu: "\u041A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0414\u0443\u044D\u043B\u044C", descEn: "Challenge a friend to beat your score.", descRu: "\u0411\u0440\u043E\u0441\u044C\u0442\u0435 \u0432\u044B\u0437\u043E\u0432 \u0434\u0440\u0443\u0433\u0443 \u043D\u0430 \u043F\u043E\u0435\u0434\u0438\u043D\u043E\u043A.", icon: "\u2694\uFE0F", category: "streak", targetValue: 1, rewardStardust: 200, rewardXp: 350 }
];

// src/utils/progression.ts
var getXpForLevel = (level) => {
  if (level <= 1) return 0;
  return Math.floor(180 * Math.pow(level - 1, 1.32));
};
var getLevelFromXp = (totalXp) => {
  let level = 1;
  while (level < 50 && totalXp >= getXpForLevel(level + 1)) {
    level++;
  }
  const currentLevelXp = getXpForLevel(level);
  const nextLevelXp = getXpForLevel(Math.min(50, level + 1));
  const xpInCurrentLevel = totalXp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progressPercent = level >= 50 ? 100 : Math.min(100, Math.floor(xpInCurrentLevel / (xpNeededForNext || 1) * 100));
  return {
    level,
    currentXp: xpInCurrentLevel,
    nextLevelXp: xpNeededForNext,
    progressPercent
  };
};
var calculateRoundRewards = (stats) => {
  const baseXp = Math.floor(stats.score * 0.1) + Math.floor(stats.accuracy * 2);
  const baseStardust = Math.floor(stats.score * 0.05) + stats.maxCombo * 3 + stats.goldenBeaconsHit * 15;
  return {
    earnedXp: Math.max(25, baseXp),
    earnedStardust: Math.max(10, baseStardust)
  };
};

// server/services/leaderboard.ts
function getRankTitle(score) {
  if (score >= 15e3) return "Fleet Admiral";
  if (score >= 8e3) return "Commander";
  return "Pilot";
}
async function recordUserChat(userId, chatId) {
  if (!isDbActive() || !chatId) return;
  try {
    await query(
      `INSERT INTO user_chats (user_id, chat_id, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, chat_id) DO UPDATE SET updated_at = NOW()`,
      [userId, chatId]
    );
  } catch (err) {
    console.error("Error recording user chat:", err);
  }
}
async function updateLeaderboardOnRoundSubmit(userId, score, mode, chatId) {
  if (!isDbActive()) return;
  try {
    const uRes = await query(
      `SELECT is_banned, shadow_banned, hide_from_leaderboard FROM users WHERE id = $1`,
      [userId]
    );
    if (uRes.rows.length === 0) return;
    const userRow = uRes.rows[0];
    if (userRow.is_banned || userRow.shadow_banned || userRow.hide_from_leaderboard) {
      await redisZRem("leaderboard:global", String(userId));
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      await redisZRem(`leaderboard:daily:${todayStr}`, String(userId));
      return;
    }
    const userIdStr = String(userId);
    const currentGlobalScore = await redisZScore("leaderboard:global", userIdStr);
    if (currentGlobalScore === null || score > currentGlobalScore) {
      await redisZAdd("leaderboard:global", score, userIdStr);
    }
    if (mode === "daily") {
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const dailyKey = `leaderboard:daily:${todayStr}`;
      const currentDailyScore = await redisZScore(dailyKey, userIdStr);
      if (currentDailyScore === null || score > currentDailyScore) {
        await redisZAdd(dailyKey, score, userIdStr);
      }
    }
    if (chatId) {
      await recordUserChat(userId, chatId);
      const chatKey = `leaderboard:chat:${chatId}`;
      const currentChatScore = await redisZScore(chatKey, userIdStr);
      if (currentChatScore === null || score > currentChatScore) {
        await redisZAdd(chatKey, score, userIdStr);
      }
    }
    const chatsRes = await query(`SELECT chat_id FROM user_chats WHERE user_id = $1`, [userId]);
    for (const row of chatsRes.rows) {
      const cKey = `leaderboard:chat:${row.chat_id}`;
      const cScore = await redisZScore(cKey, userIdStr);
      if (cScore === null || score > cScore) {
        await redisZAdd(cKey, score, userIdStr);
      }
    }
  } catch (err) {
    console.error("Error updating leaderboard on round submit:", err);
  }
}
async function removeUserFromAllLeaderboards(userId) {
  const userIdStr = String(userId);
  try {
    await redisZRem("leaderboard:global", userIdStr);
    for (let i = 0; i < 7; i++) {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      await redisZRem(`leaderboard:daily:${dateStr}`, userIdStr);
    }
    if (isDbActive()) {
      const chatsRes = await query(`SELECT chat_id FROM user_chats WHERE user_id = $1`, [userId]);
      for (const row of chatsRes.rows) {
        await redisZRem(`leaderboard:chat:${row.chat_id}`, userIdStr);
      }
    }
  } catch (err) {
    console.error("Error removing user from leaderboards:", err);
    if (config.nodeEnv === "production") {
      throw err;
    }
  }
}
async function deleteUserAccount(userId) {
  if (!isDbActive()) {
    return { success: false, error: "Database inactive" };
  }
  try {
    await removeUserFromAllLeaderboards(userId);
    await query(`UPDATE payments SET user_id = NULL WHERE user_id = $1`, [userId]);
    const res = await query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
    if (res.rowCount === 0) {
      return { success: false, error: "User not found or already deleted" };
    }
    return { success: true };
  } catch (err) {
    console.error("Error deleting user account:", err);
    return { success: false, error: "Internal database error during account deletion" };
  }
}
async function getLeaderboard(scope, currentUserId, options = {}) {
  let seasonTitle = "Season 1: Neon Storm";
  const currentUserIdStr = String(currentUserId);
  if (isDbActive()) {
    try {
      const seasonRes = await query(
        `SELECT title_en, title_ru FROM seasons WHERE is_active = true ORDER BY starts_at DESC LIMIT 1`
      );
      if (seasonRes.rows.length > 0) {
        seasonTitle = options.lang === "ru" ? seasonRes.rows[0].title_ru : seasonRes.rows[0].title_en;
      }
    } catch (err) {
      console.error("Error fetching active season:", err);
    }
  }
  let hideFromLeaderboard = false;
  if (isDbActive()) {
    try {
      const uRes = await query(
        `SELECT hide_from_leaderboard FROM users WHERE id = $1`,
        [currentUserId]
      );
      if (uRes.rows.length > 0) {
        hideFromLeaderboard = !!uRes.rows[0].hide_from_leaderboard;
      }
    } catch (err) {
      console.error("Error fetching user privacy state:", err);
    }
  }
  let dbRows = [];
  if (isDbActive()) {
    try {
      if (scope === "daily") {
        const res = await query(
          `SELECT u.id, u.username, u.first_name, u.avatar_url, MAX(r.score) as score
           FROM users u
           JOIN rounds r ON u.id = r.user_id
           WHERE r.status = 'submitted'
             AND r.mode = 'daily'
             AND r.started_at >= CURRENT_DATE
             AND u.is_banned = FALSE
             AND u.shadow_banned = FALSE
             AND u.hide_from_leaderboard = FALSE
           GROUP BY u.id, u.username, u.first_name, u.avatar_url
           ORDER BY score DESC
           LIMIT 50`,
          []
        );
        dbRows = res.rows;
      } else if (scope === "friends") {
        const res = await query(
          `SELECT u.id, u.username, u.first_name, u.avatar_url, MAX(r.score) as score
           FROM users u
           JOIN rounds r ON u.id = r.user_id
           WHERE r.status = 'submitted'
             AND u.is_banned = FALSE
             AND u.shadow_banned = FALSE
             AND u.hide_from_leaderboard = FALSE
             AND (
               u.id = $1
               OR u.id IN (SELECT invitee_id FROM referrals WHERE inviter_id = $1)
               OR u.id IN (SELECT inviter_id FROM referrals WHERE invitee_id = $1)
             )
           GROUP BY u.id, u.username, u.first_name, u.avatar_url
           ORDER BY score DESC
           LIMIT 50`,
          [currentUserId]
        );
        dbRows = res.rows;
      } else if (scope === "chat" && options.chatId) {
        const res = await query(
          `SELECT u.id, u.username, u.first_name, u.avatar_url, MAX(r.score) as score
           FROM users u
           JOIN rounds r ON u.id = r.user_id
           JOIN user_chats uc ON u.id = uc.user_id
           WHERE r.status = 'submitted'
             AND uc.chat_id = $1
             AND u.is_banned = FALSE
             AND u.shadow_banned = FALSE
             AND u.hide_from_leaderboard = FALSE
           GROUP BY u.id, u.username, u.first_name, u.avatar_url
           ORDER BY score DESC
           LIMIT 50`,
          [options.chatId]
        );
        dbRows = res.rows;
      } else {
        const res = await query(
          `SELECT u.id, u.username, u.first_name, u.avatar_url, MAX(r.score) as score
           FROM users u
           JOIN rounds r ON u.id = r.user_id
           WHERE r.status = 'submitted'
             AND u.is_banned = FALSE
             AND u.shadow_banned = FALSE
             AND u.hide_from_leaderboard = FALSE
           GROUP BY u.id, u.username, u.first_name, u.avatar_url
           ORDER BY score DESC
           LIMIT 50`,
          []
        );
        dbRows = res.rows;
      }
    } catch (err) {
      console.error("Database leaderboard query error:", err);
    }
  }
  const entries = dbRows.map((row, idx) => {
    const scoreVal = Number(row.score || 0);
    const userIdStr = String(row.id);
    return {
      rank: idx + 1,
      userId: userIdStr,
      username: row.username || void 0,
      firstName: row.first_name || row.username || "Pilot",
      score: scoreVal,
      rankTitle: getRankTitle(scoreVal),
      isCurrentUser: userIdStr === currentUserIdStr,
      avatarUrl: row.avatar_url || void 0
    };
  });
  let userRank = null;
  let userScore = 0;
  if (isDbActive()) {
    try {
      let scoreRes;
      if (scope === "daily") {
        scoreRes = await query(
          `SELECT MAX(score) as max_score FROM rounds WHERE user_id = $1 AND mode = 'daily' AND status = 'submitted' AND started_at >= CURRENT_DATE`,
          [currentUserId]
        );
      } else if (scope === "chat" && options.chatId) {
        scoreRes = await query(
          `SELECT MAX(r.score) as max_score FROM rounds r JOIN user_chats uc ON r.user_id = uc.user_id WHERE r.user_id = $1 AND uc.chat_id = $2 AND r.status = 'submitted'`,
          [currentUserId, options.chatId]
        );
      } else {
        scoreRes = await query(
          `SELECT MAX(score) as max_score FROM rounds WHERE user_id = $1 AND status = 'submitted'`,
          [currentUserId]
        );
      }
      if (scoreRes.rows.length > 0 && scoreRes.rows[0].max_score !== null) {
        userScore = Number(scoreRes.rows[0].max_score);
      }
      const inTopEntry = entries.find((e) => e.isCurrentUser);
      if (inTopEntry) {
        userRank = inTopEntry.rank;
      } else if (userScore > 0 && !hideFromLeaderboard) {
        let rankRes;
        if (scope === "daily") {
          rankRes = await query(
            `WITH user_scores AS (
               SELECT u.id, MAX(r.score) as score
               FROM users u JOIN rounds r ON u.id = r.user_id
               WHERE r.status = 'submitted' AND r.mode = 'daily' AND r.started_at >= CURRENT_DATE
                 AND u.is_banned = FALSE AND u.shadow_banned = FALSE AND u.hide_from_leaderboard = FALSE
               GROUP BY u.id
             )
             SELECT COUNT(*) + 1 as rank FROM user_scores WHERE score > $1`,
            [userScore]
          );
        } else if (scope === "friends") {
          rankRes = await query(
            `WITH user_scores AS (
               SELECT u.id, MAX(r.score) as score
               FROM users u JOIN rounds r ON u.id = r.user_id
               WHERE r.status = 'submitted' AND u.is_banned = FALSE AND u.shadow_banned = FALSE AND u.hide_from_leaderboard = FALSE
                 AND (u.id = $1 OR u.id IN (SELECT invitee_id FROM referrals WHERE inviter_id = $1) OR u.id IN (SELECT inviter_id FROM referrals WHERE invitee_id = $1))
               GROUP BY u.id
             )
             SELECT COUNT(*) + 1 as rank FROM user_scores WHERE score > $2`,
            [currentUserId, userScore]
          );
        } else if (scope === "chat" && options.chatId) {
          rankRes = await query(
            `WITH user_scores AS (
               SELECT u.id, MAX(r.score) as score
               FROM users u JOIN rounds r ON u.id = r.user_id JOIN user_chats uc ON u.id = uc.user_id
               WHERE r.status = 'submitted' AND uc.chat_id = $1 AND u.is_banned = FALSE AND u.shadow_banned = FALSE AND u.hide_from_leaderboard = FALSE
               GROUP BY u.id
             )
             SELECT COUNT(*) + 1 as rank FROM user_scores WHERE score > $2`,
            [options.chatId, userScore]
          );
        } else {
          rankRes = await query(
            `WITH user_scores AS (
               SELECT u.id, MAX(r.score) as score
               FROM users u JOIN rounds r ON u.id = r.user_id
               WHERE r.status = 'submitted' AND u.is_banned = FALSE AND u.shadow_banned = FALSE AND u.hide_from_leaderboard = FALSE
               GROUP BY u.id
             )
             SELECT COUNT(*) + 1 as rank FROM user_scores WHERE score > $1`,
            [userScore]
          );
        }
        if (rankRes.rows.length > 0) {
          userRank = Number(rankRes.rows[0].rank);
        }
      }
    } catch (err) {
      console.error("Error calculating user rank:", err);
    }
  }
  return {
    success: true,
    scope,
    seasonTitle,
    entries,
    currentUser: {
      rank: userRank,
      score: userScore,
      rankTitle: getRankTitle(userScore),
      hideFromLeaderboard
    }
  };
}

// server/validators.ts
import { z } from "zod";
var startRoundSchema = z.object({
  mode: z.enum(["normal", "daily", "challenge"]).default("normal"),
  seed: z.string().trim().max(100).optional()
});
var clickLogSchema = z.object({
  timestampMs: z.number().nonnegative().default(0),
  xPct: z.number().min(0).max(100).default(50),
  yPct: z.number().min(0).max(100).default(50),
  type: z.enum(["hit", "miss"]).default("miss"),
  targetId: z.string().max(100).optional(),
  targetType: z.string().max(50).optional(),
  scoreGained: z.number().optional(),
  // Legacy / UI compatibility fields
  timestamp: z.number().optional(),
  hit: z.boolean().optional(),
  x: z.number().optional(),
  y: z.number().optional()
});
var submitRoundSchema = z.object({
  roundId: z.string().trim().min(1, "roundId is required").max(100),
  clickLogs: z.array(clickLogSchema).max(1200, "Too many tap logs in round").default([]),
  chatId: z.union([z.string().max(50), z.number()]).optional()
});
var createInvoiceSchema = z.object({
  itemId: z.string().trim().min(1, "itemId is required").max(100)
});
var buyCosmeticSchema = z.object({
  itemId: z.string().trim().min(1, "itemId is required").max(100)
});
var equipCosmeticSchema = z.object({
  category: z.enum(["ship", "trail", "backdrop", "explosion", "frame", "theme"]),
  itemId: z.string().trim().min(1, "itemId is required").max(100)
});
var claimAchievementSchema = z.object({
  achievementId: z.string().trim().min(1, "achievementId is required").max(100)
});
var claimReferralTierSchema = z.object({
  tierLevel: z.coerce.number().int().min(1).max(50)
});
var updateUserSettingsSchema = z.object({
  hideFromLeaderboard: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional()
});
var adminPlayerActionSchema = z.object({
  userId: z.union([z.string().trim().min(1), z.number()]),
  action: z.enum(["ban", "unban", "shadow_ban", "unshadow_ban", "reset_score"])
});
var updatePlayerStatusSchema = z.object({
  isBanned: z.boolean().optional(),
  shadowBanned: z.boolean().optional(),
  resetScore: z.boolean().optional(),
  addStardust: z.number().int().optional()
});
var updateLiveConfigSchema = z.object({
  config: z.object({
    id: z.string().max(100),
    titleEn: z.string().max(200),
    titleRu: z.string().max(200),
    bannerSubtitleEn: z.string().max(300).optional(),
    bannerSubtitleRu: z.string().max(300).optional(),
    eventType: z.string().max(50),
    badgeLabel: z.string().max(100).optional(),
    bannerColor: z.string().max(50).optional(),
    isGoldenHourActive: z.boolean().optional(),
    goldenHourMultiplier: z.number().min(1).max(10).optional(),
    endDateISO: z.string().max(50).optional()
  })
});
var broadcastMessageSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(4e3, "Message cannot exceed 4000 characters"),
  targetGroup: z.enum(["all", "premium", "active_today"]).default("all"),
  includePlayButton: z.boolean().default(true)
});
var refundPaymentSchema = z.object({
  chargeId: z.string().trim().min(1, "chargeId is required").max(255),
  userId: z.union([z.string(), z.number()])
});
var createChallengeSchema = z.object({
  score: z.number().int().nonnegative().max(1e9).default(0),
  combo: z.number().int().min(1).max(100).default(1),
  seed: z.union([z.string().max(100), z.number()]).optional()
});
var viralChatContributionSchema = z.object({
  chatId: z.union([z.string().max(50), z.number()]),
  roundId: z.string().trim().min(1).max(100)
});
var notificationPrefsSchema = z.object({
  enabled: z.boolean().optional(),
  quietStart: z.number().int().min(0).max(23).optional(),
  quietEnd: z.number().int().min(0).max(23).optional(),
  timezone: z.string().trim().max(100).optional()
});
var analyticsBatchSchema = z.object({
  events: z.array(
    z.object({
      name: z.string().trim().min(1).max(64),
      timestamp: z.number().optional(),
      props: z.record(z.string(), z.any()).optional()
    })
  ).min(1).max(50)
});
var checkNicknameSchema = z.object({
  nickname: z.string().trim().min(2, "\u041D\u0438\u043A\u043D\u0435\u0439\u043C \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432").max(20, "\u041D\u0438\u043A\u043D\u0435\u0439\u043C \u043D\u0435 \u0434\u043E\u043B\u0436\u0435\u043D \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0442\u044C 20 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432").regex(/^[a-zA-Z0-9а-яА-ЯёЁ_ -]+$/, "\u041D\u0438\u043A\u043D\u0435\u0439\u043C \u043C\u043E\u0436\u0435\u0442 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0431\u0443\u043A\u0432\u044B (RU/EN), \u0446\u0438\u0444\u0440\u044B, \u043F\u0440\u043E\u0431\u0435\u043B \u0438 \u043F\u043E\u0434\u0447\u0451\u0440\u043A\u0438\u0432\u0430\u043D\u0438\u0435")
});
var registerUserSchema = z.object({
  nickname: z.string().trim().min(2, "\u041D\u0438\u043A\u043D\u0435\u0439\u043C \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432").max(20, "\u041D\u0438\u043A\u043D\u0435\u0439\u043C \u043D\u0435 \u0434\u043E\u043B\u0436\u0435\u043D \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0442\u044C 20 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432").regex(/^[a-zA-Z0-9а-яА-ЯёЁ_ -]+$/, "\u041D\u0438\u043A\u043D\u0435\u0439\u043C \u043C\u043E\u0436\u0435\u0442 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0431\u0443\u043A\u0432\u044B (RU/EN), \u0446\u0438\u0444\u0440\u044B, \u043F\u0440\u043E\u0431\u0435\u043B \u0438 \u043F\u043E\u0434\u0447\u0451\u0440\u043A\u0438\u0432\u0430\u043D\u0438\u0435"),
  avatarUrl: z.string().max(25e4).optional()
});
var updateAvatarSchema = z.object({
  avatarUrl: z.string().min(1, "Avatar URL/data required").max(25e4)
});

// server/services/events.ts
var DEFAULT_LIVE_EVENT = {
  id: "season_1",
  titleEn: "Season 1: Neon Storm",
  titleRu: "\u0421\u0435\u0437\u043E\u043D 1: \u041D\u0435\u043E\u043D\u043E\u0432\u044B\u0439 \u0428\u0442\u043E\u0440\u043C",
  eventType: "golden_hour",
  isGoldenHourActive: false,
  goldenHourMultiplier: 2,
  endDateISO: "2026-12-31T23:59:59Z"
};
async function getActiveEventConfig() {
  if (isDbActive()) {
    try {
      const res = await query(`SELECT value FROM app_config WHERE key = 'live_event'`);
      if (res.rows.length > 0 && res.rows[0].value) {
        return { ...DEFAULT_LIVE_EVENT, ...res.rows[0].value };
      }
    } catch (err) {
      console.error("Error reading active event config from DB:", err);
    }
  }
  return DEFAULT_LIVE_EVENT;
}
async function isGoldenHourActiveServer() {
  const cfg = await getActiveEventConfig();
  if (!cfg.isGoldenHourActive) {
    return { isActive: false, multiplier: 1 };
  }
  if (cfg.endDateISO) {
    const endMs = new Date(cfg.endDateISO).getTime();
    if (!isNaN(endMs) && Date.now() > endMs) {
      return { isActive: false, multiplier: 1 };
    }
  }
  const multiplier = Number(cfg.goldenHourMultiplier) || 2;
  return { isActive: true, multiplier };
}

// src/shared/dailyQuests.ts
var DAILY_QUESTS_POOL = [
  {
    id: "quest_rounds_3",
    titleEn: "Play 3 Arcade Rounds",
    titleRu: "\u0421\u044B\u0433\u0440\u0430\u0439\u0442\u0435 3 \u0430\u0440\u043A\u0430\u0434\u043D\u044B\u0445 \u0440\u0430\u0443\u043D\u0434\u0430",
    descEn: "Launch into orbit and complete 3 full arcade rounds.",
    descRu: "\u0412\u044B\u0439\u0434\u0438\u0442\u0435 \u043D\u0430 \u043E\u0440\u0431\u0438\u0442\u0443 \u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 3 \u043F\u043E\u043B\u043D\u044B\u0445 \u0430\u0440\u043A\u0430\u0434\u043D\u044B\u0445 \u0440\u0430\u0443\u043D\u0434\u0430.",
    type: "rounds",
    targetValue: 3,
    rewardDust: 50,
    rewardXp: 100,
    icon: "\u{1F6F8}"
  },
  {
    id: "quest_score_4000",
    titleEn: "Score 4,000 Points",
    titleRu: "\u041D\u0430\u0431\u0435\u0440\u0438\u0442\u0435 4,000 \u043E\u0447\u043A\u043E\u0432",
    descEn: "Score at least 4,000 points in a single round.",
    descRu: "\u041D\u0430\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 4,000 \u043E\u0447\u043A\u043E\u0432 \u0437\u0430 \u043E\u0434\u0438\u043D \u0440\u0430\u0443\u043D\u0434.",
    type: "score",
    targetValue: 4e3,
    rewardDust: 60,
    rewardXp: 120,
    icon: "\u{1F3C6}"
  },
  {
    id: "quest_score_8000",
    titleEn: "Score 8,000 Points",
    titleRu: "\u041D\u0430\u0431\u0435\u0440\u0438\u0442\u0435 8,000 \u043E\u0447\u043A\u043E\u0432",
    descEn: "Show pilot mastery and reach 8,000 points in a round.",
    descRu: "\u041F\u043E\u043A\u0430\u0436\u0438\u0442\u0435 \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u0442\u0432\u043E \u0438 \u043D\u0430\u0431\u0435\u0440\u0438\u0442\u0435 8,000 \u043E\u0447\u043A\u043E\u0432 \u0437\u0430 \u0440\u0430\u0443\u043D\u0434.",
    type: "score",
    targetValue: 8e3,
    rewardDust: 90,
    rewardXp: 180,
    icon: "\u2B50"
  },
  {
    id: "quest_combo_6",
    titleEn: "Achieve x6 Combo",
    titleRu: "\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 \u043A\u043E\u043C\u0431\u043E x6",
    descEn: "Maintain unbroken rhythm and reach x6 combo multiplier.",
    descRu: "\u0414\u0435\u0440\u0436\u0438\u0442\u0435 \u0442\u043E\u0447\u043D\u044B\u0439 \u0440\u0438\u0442\u043C \u0438 \u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 \u043A\u043E\u043C\u0431\u043E-\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044F x6.",
    type: "combo",
    targetValue: 6,
    rewardDust: 50,
    rewardXp: 100,
    icon: "\u{1F525}"
  },
  {
    id: "quest_combo_12",
    titleEn: "Achieve x12 Combo",
    titleRu: "\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 \u043A\u043E\u043C\u0431\u043E x12",
    descEn: "Unleash blistering speed and hit x12 combo multiplier.",
    descRu: "\u0420\u0430\u0437\u0433\u043E\u043D\u0438\u0442\u0435 \u0440\u0435\u0430\u043A\u0446\u0438\u044E \u0438 \u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0438\u0442\u0435 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044F x12.",
    type: "combo",
    targetValue: 12,
    rewardDust: 80,
    rewardXp: 160,
    icon: "\u26A1"
  },
  {
    id: "quest_targets_40",
    titleEn: "Hit 40 Cosmic Targets",
    titleRu: "\u041F\u043E\u0440\u0430\u0437\u0438\u0442\u0435 40 \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0446\u0435\u043B\u0435\u0439",
    descEn: "Tap and destroy 40 targets across your flights today.",
    descRu: "\u041F\u043E\u0440\u0430\u0437\u0438\u0442\u0435 40 \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0446\u0435\u043B\u0435\u0439 \u0437\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F\u0448\u043D\u0438\u0435 \u043F\u043E\u043B\u0451\u0442\u044B.",
    type: "targets",
    targetValue: 40,
    rewardDust: 50,
    rewardXp: 100,
    icon: "\u{1F3AF}"
  },
  {
    id: "quest_targets_100",
    titleEn: "Hit 100 Cosmic Targets",
    titleRu: "\u041F\u043E\u0440\u0430\u0437\u0438\u0442\u0435 100 \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0446\u0435\u043B\u0435\u0439",
    descEn: "Demonstrate laser focus by hitting 100 targets today.",
    descRu: "\u041F\u0440\u043E\u044F\u0432\u0438\u0442\u0435 \u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u0438 \u0441\u0431\u0435\u0439\u0442\u0435 100 \u0446\u0435\u043B\u0435\u0439 \u0437\u0430 \u0434\u0435\u043D\u044C.",
    type: "targets",
    targetValue: 100,
    rewardDust: 90,
    rewardXp: 180,
    icon: "\u{1F4A5}"
  },
  {
    id: "quest_beacons_3",
    titleEn: "Collect 3 Gold Beacons",
    titleRu: "\u0421\u043E\u0431\u0435\u0440\u0438\u0442\u0435 3 \u0437\u043E\u043B\u043E\u0442\u044B\u0445 \u043C\u0430\u044F\u043A\u0430",
    descEn: "Catch 3 rare golden navigation beacons during flight.",
    descRu: "\u041F\u043E\u0439\u043C\u0430\u0439\u0442\u0435 3 \u0440\u0435\u0434\u043A\u0438\u0445 \u0437\u043E\u043B\u043E\u0442\u044B\u0445 \u043C\u0430\u044F\u043A\u0430 \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u043F\u043E\u043B\u0451\u0442\u0430.",
    type: "beacon",
    targetValue: 3,
    rewardDust: 70,
    rewardXp: 140,
    icon: "\u{1F31F}"
  },
  {
    id: "quest_daily_challenge_1",
    titleEn: "Play Daily Challenge",
    titleRu: "\u0421\u044B\u0433\u0440\u0430\u0439\u0442\u0435 \u0427\u0435\u043B\u043B\u0435\u043D\u0434\u0436 \u0414\u043D\u044F",
    descEn: "Test your reflexes in today's seeded global challenge.",
    descRu: "\u0418\u0441\u043F\u044B\u0442\u0430\u0439\u0442\u0435 \u0440\u0435\u0430\u043A\u0446\u0438\u044E \u0432 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u043E\u043C \u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u043E\u043C \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0435.",
    type: "daily_challenge",
    targetValue: 1,
    rewardDust: 75,
    rewardXp: 150,
    icon: "\u{1F52E}"
  },
  {
    id: "quest_rounds_5",
    titleEn: "Complete 5 Arcade Rounds",
    titleRu: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 5 \u0440\u0430\u0443\u043D\u0434\u043E\u0432",
    descEn: "Log 5 completed flights in the galactic flight recorder.",
    descRu: "\u0417\u0430\u043F\u0438\u0448\u0438\u0442\u0435 5 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u044B\u0445 \u0432\u044B\u043B\u0435\u0442\u043E\u0432 \u0432 \u0431\u043E\u0440\u0442\u043E\u0432\u043E\u0439 \u0436\u0443\u0440\u043D\u0430\u043B.",
    type: "rounds",
    targetValue: 5,
    rewardDust: 80,
    rewardXp: 160,
    icon: "\u{1F680}"
  }
];
function getTodayUtcDate() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
function getDailyQuestsForDate(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);
  const pool2 = [...DAILY_QUESTS_POOL];
  const selected = [];
  for (let i = 0; i < 3 && pool2.length > 0; i++) {
    const index = (seed + i * 3) % pool2.length;
    selected.push(pool2[index]);
    pool2.splice(index, 1);
  }
  return selected;
}

// server/services/dailyContent.ts
var mockUserDailyQuests = /* @__PURE__ */ new Map();
function getMockUserDailyQuests(userId, dateStr = getTodayUtcDate()) {
  const key = `${userId}_${dateStr}`;
  if (!mockUserDailyQuests.has(key)) {
    const dailyDefs = getDailyQuestsForDate(dateStr);
    mockUserDailyQuests.set(
      key,
      dailyDefs.map((q) => ({
        id: q.id,
        title_en: q.titleEn,
        title_ru: q.titleRu,
        type: q.type,
        target_value: q.targetValue,
        reward_dust: q.rewardDust,
        reward_exp: q.rewardXp,
        progress: 0,
        is_completed: false,
        is_claimed: false,
        reset_date: dateStr
      }))
    );
  }
  return mockUserDailyQuests.get(key);
}
async function ensureDailyQuestsCatalog(client) {
  for (const q of DAILY_QUESTS_POOL) {
    await client.query(
      `INSERT INTO daily_quests (id, title_en, title_ru, type, target_value, reward_dust, reward_exp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         title_en = EXCLUDED.title_en,
         title_ru = EXCLUDED.title_ru,
         type = EXCLUDED.type,
         target_value = EXCLUDED.target_value,
         reward_dust = EXCLUDED.reward_dust,
         reward_exp = EXCLUDED.reward_exp`,
      [q.id, q.titleEn, q.titleRu, q.type, q.targetValue, q.rewardDust, q.rewardXp]
    );
  }
}
async function getUserDailyQuests(userId) {
  const today = getTodayUtcDate();
  if (!await isDbActive()) {
    return getMockUserDailyQuests(userId, today);
  }
  await transaction(async (client) => {
    await ensureDailyQuestsCatalog(client);
    const existing = await client.query(
      `SELECT uq.id
       FROM user_daily_quests uq
       WHERE uq.user_id = $1 AND uq.reset_date = $2`,
      [userId, today]
    );
    if (existing.rows.length < 3) {
      const todayDefs = getDailyQuestsForDate(today);
      for (const q of todayDefs) {
        await client.query(
          `INSERT INTO user_daily_quests (user_id, quest_id, progress, target_value, is_completed, is_claimed, reset_date)
           VALUES ($1, $2, 0, $3, false, false, $4)
           ON CONFLICT (user_id, quest_id, reset_date) DO NOTHING`,
          [userId, q.id, q.targetValue, today]
        );
      }
    }
  });
  const res = await query(
    `SELECT q.id, q.title_en, q.title_ru, q.type, q.reward_dust, q.reward_exp,
            uq.progress, uq.target_value, uq.is_completed, uq.is_claimed
     FROM daily_quests q
     JOIN user_daily_quests uq ON q.id = uq.quest_id
     WHERE uq.user_id = $1 AND uq.reset_date = $2
     ORDER BY q.id ASC`,
    [userId, today]
  );
  return res.rows;
}
async function updateQuestProgressForRound(userId, round) {
  const today = getTodayUtcDate();
  if (!await isDbActive()) {
    const quests = getMockUserDailyQuests(userId, today);
    for (const q of quests) {
      if (q.is_claimed) continue;
      let newProgress = q.progress;
      switch (q.type) {
        case "rounds":
          newProgress = q.progress + 1;
          break;
        case "score":
          newProgress = Math.max(q.progress, round.score);
          break;
        case "combo":
          newProgress = Math.max(q.progress, round.maxCombo);
          break;
        case "targets":
          newProgress = q.progress + (round.hits || 0);
          break;
        case "beacon":
          newProgress = q.progress + (round.goldenBeaconsHit || 0);
          break;
        case "daily_challenge":
          if (round.isDailyChallenge) {
            newProgress = q.progress + 1;
          }
          break;
      }
      q.progress = Math.min(q.target_value, newProgress);
      q.is_completed = q.progress >= q.target_value;
    }
    return;
  }
  await transaction(async (client) => {
    const existing = await client.query(
      `SELECT uq.id, uq.quest_id, uq.progress, uq.target_value, q.type
       FROM user_daily_quests uq
       JOIN daily_quests q ON uq.quest_id = q.id
       WHERE uq.user_id = $1 AND uq.reset_date = $2 AND uq.is_claimed = false`,
      [userId, today]
    );
    for (const uq of existing.rows) {
      let newProgress = Number(uq.progress);
      switch (uq.type) {
        case "rounds":
          newProgress = newProgress + 1;
          break;
        case "score":
          newProgress = Math.max(newProgress, round.score);
          break;
        case "combo":
          newProgress = Math.max(newProgress, round.maxCombo);
          break;
        case "targets":
          newProgress = newProgress + (round.hits || 0);
          break;
        case "beacon":
          newProgress = newProgress + (round.goldenBeaconsHit || 0);
          break;
        case "daily_challenge":
          if (round.isDailyChallenge) {
            newProgress = newProgress + 1;
          }
          break;
      }
      const capped = Math.min(Number(uq.target_value), newProgress);
      const isCompleted = capped >= Number(uq.target_value);
      await client.query(
        `UPDATE user_daily_quests
         SET progress = $1, is_completed = $2
         WHERE id = $3`,
        [capped, isCompleted, uq.id]
      );
    }
  });
}
async function claimQuestReward(userId, questId) {
  const today = getTodayUtcDate();
  if (!await isDbActive()) {
    const quests = getMockUserDailyQuests(userId, today);
    const q = quests.find((item) => item.id === questId);
    if (!q) {
      return { success: false, error: "Quest not found" };
    }
    if (!q.is_completed) {
      return { success: false, error: "Quest condition not fulfilled yet" };
    }
    if (q.is_claimed) {
      return { success: false, error: "Already claimed today" };
    }
    q.is_claimed = true;
    return {
      success: true,
      rewardStardust: q.reward_dust,
      rewardXp: q.reward_exp
    };
  }
  return await transaction(async (client) => {
    const uqRes = await client.query(
      `SELECT uq.*, q.reward_dust, q.reward_exp
       FROM user_daily_quests uq
       JOIN daily_quests q ON uq.quest_id = q.id
       WHERE uq.user_id = $1 AND uq.quest_id = $2 AND uq.reset_date = $3
       FOR UPDATE`,
      [userId, questId, today]
    );
    if (uqRes.rows.length === 0) {
      return { success: false, error: "Quest not found" };
    }
    const uq = uqRes.rows[0];
    if (!uq.is_completed) {
      return { success: false, error: "Quest condition not fulfilled yet" };
    }
    if (uq.is_claimed) {
      return { success: false, error: "Already claimed today" };
    }
    const updateRes = await client.query(
      `UPDATE user_daily_quests
       SET is_claimed = true
       WHERE id = $1 AND is_claimed = false
       RETURNING id`,
      [uq.id]
    );
    if (updateRes.rows.length === 0) {
      return { success: false, error: "Already claimed today" };
    }
    await client.query(
      `INSERT INTO wallets (user_id, stardust, xp, level) VALUES ($1, 0, 0, 1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    await client.query(
      `UPDATE wallets
       SET stardust = stardust + $1, xp = xp + $2
       WHERE user_id = $3`,
      [uq.reward_dust, uq.reward_exp, userId]
    );
    return {
      success: true,
      rewardStardust: Number(uq.reward_dust),
      rewardXp: Number(uq.reward_exp)
    };
  });
}
async function getActiveGoldenHour() {
  if (!await isDbActive()) return null;
  const res = await query(
    `SELECT * FROM golden_hours WHERE starts_at <= NOW() AND ends_at >= NOW() ORDER BY starts_at DESC LIMIT 1`
  );
  return res.rows[0] || null;
}
async function getActiveLimitedEvents() {
  if (!await isDbActive()) return [];
  const res = await query(
    `SELECT * FROM limited_events WHERE is_active = true AND starts_at <= NOW() AND ends_at >= NOW()`
  );
  return res.rows;
}
async function getUserStreak(userId) {
  if (!await isDbActive()) return { currentStreak: 1, maxStreak: 1, streakFreezesLeft: 1 };
  const today = getTodayUtcDate();
  let res = await query(`SELECT * FROM user_streaks WHERE user_id = $1`, [userId]);
  if (res.rows.length === 0) {
    await query(
      `INSERT INTO user_streaks (user_id, current_streak, max_streak, last_activity_date, streak_freezes_left)
       VALUES ($1, 1, 1, $2, 1) ON CONFLICT (user_id) DO NOTHING`,
      [userId, today]
    );
    res = await query(`SELECT * FROM user_streaks WHERE user_id = $1`, [userId]);
  }
  return res.rows[0];
}

// server/routes/game.ts
var router2 = Router2();
var activeRoundsMemory = /* @__PURE__ */ new Map();
var handleStartRound = async (req, res) => {
  const parsed = startRoundSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { mode, seed: customSeed } = parsed.data;
  const user = req.user;
  if (isDbActive()) {
    try {
      const txResult = await transaction(async (client) => {
        await client.query(
          `INSERT INTO users (id, username, first_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
          [user.id, user.username || null, user.firstName || null]
        );
        await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [user.id]);
        const activeRoundRes = await client.query(
          `SELECT id, started_at FROM rounds WHERE user_id = $1 AND status = 'issued' ORDER BY started_at DESC LIMIT 1`,
          [user.id]
        );
        if (activeRoundRes.rows.length > 0) {
          const active = activeRoundRes.rows[0];
          const ageMs = Date.now() - new Date(active.started_at).getTime();
          if (ageMs < 4e4) {
            return {
              status: 429,
              json: {
                error: "Round already in progress",
                activeRoundId: active.id
              }
            };
          } else {
            await client.query(`UPDATE rounds SET status = 'rejected', flags = '{"reason":"abandoned"}' WHERE id = $1`, [active.id]);
          }
        }
        let seed;
        if (mode === "daily") {
          seed = `daily_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`;
        } else if (mode === "challenge") {
          seed = customSeed?.trim() || `challenge_${user.id}_${Date.now()}`;
        } else {
          seed = `norm_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
        }
        const roundRes = await client.query(
          `INSERT INTO rounds (user_id, seed, mode, status, started_at) VALUES ($1, $2, $3, 'issued', NOW()) RETURNING id, started_at`,
          [user.id, seed, mode]
        );
        const newRound = roundRes.rows[0];
        return {
          status: 200,
          json: {
            success: true,
            roundId: newRound.id,
            seed,
            serverStartedAt: new Date(newRound.started_at).getTime(),
            mode
          }
        };
      });
      return res.status(txResult.status).json(txResult.json);
    } catch (err) {
      console.error("Database round start error:", err);
      if (config.nodeEnv === "production" || !config.mockModeAllowed) {
        return res.status(503).json({ error: "Database error starting round", message: "Service temporarily unavailable" });
      }
    }
  }
  if (config.nodeEnv === "production" || !config.mockModeAllowed) {
    return res.status(503).json({
      error: "Database unavailable in production",
      message: "Service temporarily unavailable. Database required."
    });
  }
  let fallbackSeed;
  if (mode === "daily") {
    fallbackSeed = `daily_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`;
  } else if (mode === "challenge") {
    fallbackSeed = customSeed?.trim() || `challenge_demo_${Date.now()}`;
  } else {
    fallbackSeed = `norm_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
  }
  const fallbackRoundId = `rnd_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
  activeRoundsMemory.set(fallbackRoundId, {
    seed: fallbackSeed,
    mode,
    startedAt: Date.now()
  });
  return res.json({
    success: true,
    roundId: fallbackRoundId,
    seed: fallbackSeed,
    serverStartedAt: Date.now(),
    mode
  });
};
router2.post("/round/start", requireAuth, handleStartRound);
router2.post("/game/round/start", requireAuth, handleStartRound);
var handleSubmitRound = async (req, res) => {
  const parsed = submitRoundSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { roundId, clickLogs, chatId } = parsed.data;
  const user = req.user;
  if (!isDbActive()) {
    if (config.nodeEnv === "production" || !config.mockModeAllowed) {
      return res.status(503).json({
        error: "Database unavailable in production",
        message: "Service temporarily unavailable. Database required."
      });
    }
  }
  let confirmedScore = 0;
  let earnedXp = 0;
  let earnedStardust = 0;
  let newLevel = 1;
  let isLevelUp = false;
  let evalResult = null;
  let roundMode = "normal";
  let isShadowBanned = false;
  let alreadySubmittedResult = null;
  if (isDbActive()) {
    try {
      if (!roundId || roundId.startsWith("rnd_")) {
        if (config.nodeEnv === "production" || !config.mockModeAllowed) {
          return res.status(400).json({
            error: "Invalid round ID",
            message: "Server-issued database round ID is required in production."
          });
        }
      }
      const txResult = await transaction(async (client) => {
        const roundRes = await client.query(
          `SELECT id, seed, mode, status, started_at, score FROM rounds WHERE id = $1 AND user_id = $2 FOR UPDATE`,
          [roundId, user.id]
        );
        if (roundRes.rows.length === 0) {
          return { status: 404, json: { error: "Round not found or belongs to another user" } };
        }
        const dbRound = roundRes.rows[0];
        roundMode = dbRound.mode || "normal";
        if (dbRound.status === "submitted") {
          return {
            status: 200,
            json: {
              success: true,
              confirmedScore: dbRound.score || 0,
              alreadySubmitted: true,
              message: "Round was already submitted successfully"
            }
          };
        }
        if (dbRound.status === "rejected") {
          return {
            status: 400,
            json: {
              error: "Round has already been rejected",
              rejected: true,
              message: "This round was previously rejected and cannot be submitted again."
            }
          };
        }
        if (dbRound.status !== "issued") {
          return { status: 400, json: { error: "Round has already been rejected or completed" } };
        }
        const ageMs = Date.now() - new Date(dbRound.started_at).getTime();
        if (ageMs > 12e4) {
          await client.query(`UPDATE rounds SET status = 'rejected', flags = $1, score = 0 WHERE id = $2`, [
            JSON.stringify({ reason: "expired", ageMs }),
            dbRound.id
          ]);
          return { status: 400, json: { error: "Round expired", message: "Round took too long to complete" } };
        }
        const durationMs = ageMs;
        const userRes = await client.query(`SELECT shadow_banned, is_banned FROM users WHERE id = $1 FOR UPDATE`, [user.id]);
        if (userRes.rows.length > 0) {
          if (userRes.rows[0].is_banned) {
            return { status: 403, json: { error: "Account banned" } };
          }
          isShadowBanned = Boolean(userRes.rows[0].shadow_banned);
        }
        const effectiveSeed = dbRound.seed || `norm_${Date.now()}`;
        evalResult = recalculateRound(effectiveSeed, clickLogs, durationMs, roundMode);
        if (!evalResult.isValid) {
          const rejectionInfo = {
            reason: evalResult.rejectionReason || "Round failed server verification check",
            flags: evalResult.flags || [],
            rejectedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          await client.query(
            `UPDATE rounds SET status = 'rejected', flags = $1, score = 0 WHERE id = $2`,
            [JSON.stringify(rejectionInfo), dbRound.id]
          );
          const suspicionRes = await client.query(
            `SELECT COUNT(*) as cnt FROM rounds WHERE user_id = $1 AND status = 'rejected'`,
            [user.id]
          );
          const rejectedCount = Number(suspicionRes.rows[0]?.cnt || 0);
          if (rejectedCount >= 3 && !isShadowBanned) {
            await client.query(`UPDATE users SET shadow_banned = true WHERE id = $1`, [user.id]);
            isShadowBanned = true;
          }
          return {
            status: 403,
            json: {
              success: false,
              rejected: true,
              flags: evalResult.flags,
              reason: rejectionInfo.reason
            }
          };
        }
        const eventStatus = await isGoldenHourActiveServer();
        confirmedScore = eventStatus.isActive ? evalResult.recalculatedScore * eventStatus.multiplier : evalResult.recalculatedScore;
        const rewards = calculateRoundRewards({
          score: confirmedScore,
          accuracy: evalResult.accuracy,
          maxCombo: evalResult.maxCombo,
          goldenBeaconsHit: evalResult.goldenBeaconsHit
        });
        earnedXp = rewards.earnedXp;
        earnedStardust = rewards.earnedStardust;
        await client.query(
          `INSERT INTO wallets (user_id, stardust, xp, level) VALUES ($1, 0, 0, 1) ON CONFLICT (user_id) DO NOTHING`,
          [user.id]
        );
        const wRes = await client.query(`SELECT stardust, xp, level FROM wallets WHERE user_id = $1 FOR UPDATE`, [user.id]);
        let currentXp = 0;
        let currentStardust = 0;
        let currentLevel = 1;
        if (wRes.rows.length > 0) {
          currentXp = Number(wRes.rows[0].xp);
          currentStardust = Number(wRes.rows[0].stardust);
          currentLevel = Number(wRes.rows[0].level);
        }
        const totalXp = currentXp + earnedXp;
        const totalStardust = currentStardust + earnedStardust;
        const levelInfo = getLevelFromXp(totalXp);
        newLevel = levelInfo.level;
        isLevelUp = newLevel > currentLevel;
        await client.query(
          `UPDATE wallets SET xp = $1, stardust = $2, level = $3 WHERE user_id = $4`,
          [totalXp, totalStardust, newLevel, user.id]
        );
        await client.query(
          `UPDATE rounds 
           SET finished_at = NOW(), status = 'submitted', score = $1, taps = $2, hits = $3, max_combo = $4, duration_ms = $5, flags = $6
           WHERE id = $7`,
          [
            confirmedScore,
            evalResult.totalTaps,
            evalResult.hits,
            evalResult.maxCombo,
            durationMs,
            JSON.stringify({ verified: true, goldenHour: eventStatus.isActive, multiplier: eventStatus.multiplier }),
            dbRound.id
          ]
        );
        if (clickLogs.length > 0) {
          await client.query(`INSERT INTO round_events (round_id, payload) VALUES ($1, $2)`, [
            dbRound.id,
            JSON.stringify(clickLogs)
          ]);
        }
        return {
          status: 200,
          json: {
            success: true,
            confirmedScore,
            earnedXp,
            earnedStardust,
            level: newLevel,
            isLevelUp,
            rankTitle: getRankTitle(confirmedScore),
            flags: evalResult.flags
          }
        };
      });
      if (txResult.status === 200 && !txResult.json.alreadySubmitted && !isShadowBanned) {
        try {
          await updateLeaderboardOnRoundSubmit(user.id, confirmedScore, roundMode, chatId);
        } catch (lbErr) {
          console.error("Leaderboard update error after reward credit:", lbErr);
        }
        try {
          await updateQuestProgressForRound(user.id, {
            score: confirmedScore,
            maxCombo: evalResult?.maxCombo || 0,
            hits: evalResult?.hits || 0,
            goldenBeaconsHit: evalResult?.goldenBeaconsHit || 0,
            isDailyChallenge: roundMode === "daily"
          });
        } catch (lbErr) {
          console.error("Leaderboard update error after reward credit:", lbErr);
        }
      }
      return res.status(txResult.status).json(txResult.json);
    } catch (err) {
      console.error("Database round submit transaction error:", err);
      return res.status(500).json({
        error: "Transaction failed",
        message: "Failed to process round submission and allocate rewards securely"
      });
    }
  } else {
    const memRound = activeRoundsMemory.get(roundId);
    if (memRound && memRound.status === "rejected") {
      return res.status(400).json({
        error: "Round has already been rejected",
        rejected: true,
        message: "This round was previously rejected and cannot be submitted again."
      });
    }
    if (memRound && memRound.status === "submitted") {
      return res.json({
        success: true,
        confirmedScore: memRound.score || 0,
        alreadySubmitted: true,
        message: "Round was already submitted successfully"
      });
    }
    const effectiveSeed = memRound?.seed || (roundId.startsWith("rnd_") ? roundId : `norm_${Date.now()}`);
    const durationMs = memRound ? Date.now() - memRound.startedAt : 45e3;
    evalResult = recalculateRound(effectiveSeed, clickLogs, durationMs, memRound?.mode || "classic");
    if (!evalResult.isValid) {
      if (memRound) {
        memRound.status = "rejected";
        memRound.flags = evalResult.flags;
      }
      return res.status(403).json({
        success: false,
        rejected: true,
        flags: evalResult.flags,
        reason: evalResult.rejectionReason || "Round failed verification check"
      });
    }
    if (memRound) {
      memRound.status = "submitted";
      memRound.score = evalResult.recalculatedScore;
    }
    confirmedScore = evalResult.recalculatedScore;
    const rewards = calculateRoundRewards({
      score: confirmedScore,
      accuracy: evalResult.accuracy,
      maxCombo: evalResult.maxCombo,
      goldenBeaconsHit: evalResult.goldenBeaconsHit
    });
    earnedXp = rewards.earnedXp;
    earnedStardust = rewards.earnedStardust;
    try {
      await updateQuestProgressForRound(user.id, {
        score: confirmedScore,
        maxCombo: evalResult?.maxCombo || 0,
        hits: evalResult?.hits || 0,
        goldenBeaconsHit: evalResult?.goldenBeaconsHit || 0,
        isDailyChallenge: (memRound?.mode || roundMode) === "daily"
      });
    } catch (err) {
    }
    newLevel = getLevelFromXp(earnedXp).level;
    isLevelUp = newLevel > 1;
    return res.json({
      success: true,
      confirmedScore,
      earnedXp,
      earnedStardust,
      level: newLevel,
      isLevelUp,
      rankTitle: getRankTitle(confirmedScore),
      flags: evalResult.flags
    });
  }
};
router2.post("/round/submit", requireAuth, handleSubmitRound);
router2.post("/game/round/submit", requireAuth, handleSubmitRound);
var handleGetLeaderboard = async (req, res) => {
  const user = req.user;
  const rawScope = req.query.scope || req.query.mode || "global";
  const scope = ["global", "daily", "friends", "chat"].includes(rawScope) ? rawScope : "global";
  const chatId = req.query.chatId ? String(req.query.chatId) : void 0;
  const result = await getLeaderboard(scope, user.id, { chatId, lang: user.language });
  return res.json(result);
};
router2.get("/leaderboard", requireAuth, handleGetLeaderboard);
router2.get("/game/leaderboard", requireAuth, handleGetLeaderboard);
router2.get("/challenge/info", async (req, res) => {
  const challengeId = String(req.query.id || req.query.seed || "").trim();
  if (!challengeId) {
    return res.status(400).json({ error: "Missing challenge id or seed" });
  }
  let challengerName = "Ace Pilot";
  let challengerScore = 12400;
  let targetSeed = challengeId;
  if (isDbActive()) {
    try {
      const dbRes = await query(
        `SELECT r.seed, r.score, COALESCE(u.first_name, u.username, 'Pilot') as name
         FROM rounds r
         JOIN users u ON r.user_id = u.id
         WHERE (r.id::text = $1 OR r.seed = $1) AND r.status = 'submitted'
         ORDER BY r.score DESC LIMIT 1`,
        [challengeId]
      );
      if (dbRes.rows.length > 0) {
        targetSeed = dbRes.rows[0].seed;
        challengerScore = Number(dbRes.rows[0].score);
        challengerName = dbRes.rows[0].name;
      }
    } catch (err) {
      console.error("Error fetching challenge info:", err);
    }
  }
  return res.json({
    success: true,
    challenge: {
      id: challengeId,
      challengerName,
      challengerScore,
      targetSeed,
      expiresInSeconds: 86400
    }
  });
});
var game_default = router2;

// server/routes/stars.ts
import { Router as Router3 } from "express";
import crypto2 from "crypto";

// src/shared/stars-catalog.ts
var STARS_CATALOG = [
  {
    id: "bundle_synth_legend",
    titleEn: "Cosmetic Premium Bundle",
    titleRu: "\u041F\u0440\u0435\u043C\u0438\u0443\u043C \u041A\u043E\u0441\u043C\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u041D\u0430\u0431\u043E\u0440",
    descEn: "Includes Plasma Crusher ship and +1,000 Stardust!",
    descRu: "\u0412\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u043A\u043E\u0440\u0430\u0431\u043B\u044C \u041F\u043B\u0430\u0437\u043C\u0435\u043D\u043D\u044B\u0439 \u041A\u0440\u0443\u0448\u0438\u0442\u0435\u043B\u044C \u0438 +1,000 \u041F\u044B\u043B\u0438!",
    priceStars: 250,
    icon: "\u{1F381}",
    type: "bundle",
    rewardStardustBonus: 1e3,
    rewardShipId: "ship_plasma_crusher"
  },
  {
    id: "skin_plasma_crusher",
    titleEn: "Legendary Plasma Crusher",
    titleRu: "\u041B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0439 \u041F\u043B\u0430\u0437\u043C\u0435\u043D\u043D\u044B\u0439 \u041A\u0440\u0443\u0448\u0438\u0442\u0435\u043B\u044C",
    descEn: "Exclusive dreadnought skin with solar core particle aura.",
    descRu: "\u042D\u043A\u0441\u043A\u043B\u044E\u0437\u0438\u0432\u043D\u044B\u0439 \u0441\u043A\u0438\u043D \u0434\u0440\u0435\u0434\u043D\u043E\u0443\u0442\u0430 \u0441 \u0430\u0443\u0440\u043E\u0439 \u0441\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0445 \u0447\u0430\u0441\u0442\u0438\u0446.",
    priceStars: 100,
    icon: "\u{1F451}",
    type: "skin",
    rewardShipId: "ship_plasma_crusher"
  },
  {
    id: "streak_shield",
    titleEn: "Streak Insurance (Shield)",
    titleRu: "\u0421\u0442\u0440\u0430\u0445\u043E\u0432\u043A\u0430 \u0421\u0442\u0440\u0438\u043A\u0430",
    descEn: "Protects your daily login streak from resetting if you miss a day.",
    descRu: "\u0417\u0430\u0449\u0438\u0449\u0430\u0435\u0442 \u0432\u0430\u0448 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u0441\u0442\u0440\u0438\u043A \u043E\u0442 \u0441\u0431\u0440\u043E\u0441\u0430 \u043F\u0440\u0438 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0435 \u0434\u043D\u044F.",
    priceStars: 50,
    icon: "\u{1F6E1}\uFE0F",
    type: "insurance"
  },
  {
    id: "stardust_vault_2500",
    titleEn: "Stardust Mega-Vault",
    titleRu: "\u0421\u0443\u043D\u0434\u0443\u043A \u0417\u0432\u0451\u0437\u0434\u043D\u043E\u0439 \u041F\u044B\u043B\u0438",
    descEn: "+2,500 Stardust to unlock any cosmetics in the hangar immediately!",
    descRu: "+2,500 \u0417\u0432\u0451\u0437\u0434\u043D\u043E\u0439 \u041F\u044B\u043B\u0438 \u0434\u043B\u044F \u043C\u043E\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u043E\u0439 \u043F\u043E\u043A\u0443\u043F\u043A\u0438 \u043B\u044E\u0431\u044B\u0445 \u0444\u043E\u043D\u043E\u0432 \u0438 \u0440\u0430\u043C\u043E\u043A!",
    priceStars: 75,
    icon: "\u{1F31F}",
    type: "stardust_pack",
    rewardStardustBonus: 2500
  },
  {
    id: "season_pass_paid",
    titleEn: "Season Pass Premium",
    titleRu: "\u041F\u0440\u0435\u043C\u0438\u0443\u043C \u0421\u0435\u0437\u043E\u043D\u043D\u044B\u0439 \u041F\u0440\u043E\u043F\u0443\u0441\u043A",
    descEn: "Unlocks VIP tier rewards across the active season pass.",
    descRu: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 VIP \u043D\u0430\u0433\u0440\u0430\u0434\u044B \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0441\u0435\u0437\u043E\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430.",
    priceStars: 250,
    icon: "\u{1F30C}",
    type: "bundle"
  }
];
function getStarsCatalogItem(itemId) {
  return STARS_CATALOG.find((item) => item.id === itemId);
}

// server/routes/stars.ts
var router3 = Router3();
var inMemoryReconciliationQueue = [];
async function enqueuePaymentReconciliation(paymentId, telegramPaymentChargeId, options) {
  const correlationId = options?.correlationId || `corr_${Date.now()}_${crypto2.randomBytes(4).toString("hex")}`;
  const lastError = options?.error || "TRANSIENT_DB_FAILURE";
  if (isDbActive()) {
    try {
      await query(
        `INSERT INTO payment_reconciliation_queue 
          (payment_id, telegram_payment_charge_id, user_id, stars_amount, item_id, status, attempts, max_attempts, last_error, correlation_id, scheduled_for, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', 0, 5, $6, $7, NOW(), NOW())
         ON CONFLICT (telegram_payment_charge_id) DO UPDATE 
           SET status = CASE WHEN payment_reconciliation_queue.status = 'completed' THEN 'completed' ELSE 'pending' END,
               attempts = payment_reconciliation_queue.attempts,
               last_error = EXCLUDED.last_error,
               correlation_id = EXCLUDED.correlation_id,
               updated_at = NOW()`,
        [
          paymentId,
          telegramPaymentChargeId,
          options?.userId ? Number(options.userId) : null,
          options?.starsAmount ? Number(options.starsAmount) : null,
          options?.itemId || null,
          lastError,
          correlationId
        ]
      );
      logger.info(`[PAYMENTS RECONCILIATION] Enqueued payment ${paymentId} (charge: ${telegramPaymentChargeId}) into DB reconciliation queue`, { correlationId });
      return { success: true, correlationId };
    } catch (dbErr) {
      logger.error(`[PAYMENTS RECONCILIATION] Failed to insert into DB queue: ${dbErr?.message || dbErr}`, { correlationId });
      if (config.nodeEnv === "production") {
        return { success: false, correlationId };
      }
    }
  } else if (config.nodeEnv === "production") {
    logger.error(`[PAYMENTS RECONCILIATION CRITICAL] Database inactive in production when attempting to enqueue payment ${paymentId}`, { correlationId });
    return { success: false, correlationId };
  }
  const existingIdx = inMemoryReconciliationQueue.findIndex((item) => item.telegramPaymentChargeId === telegramPaymentChargeId);
  if (existingIdx === -1) {
    inMemoryReconciliationQueue.push({
      paymentId,
      telegramPaymentChargeId,
      userId: options?.userId,
      starsAmount: options?.starsAmount,
      itemId: options?.itemId,
      attempts: 0,
      maxAttempts: 5,
      lastError,
      correlationId,
      scheduledFor: Date.now()
    });
  } else {
    inMemoryReconciliationQueue[existingIdx].lastError = lastError;
    inMemoryReconciliationQueue[existingIdx].correlationId = correlationId;
  }
  logger.warn(`[PAYMENTS RECONCILIATION] Stored payment in in-memory reconciliation queue (queue size: ${inMemoryReconciliationQueue.length})`, { correlationId, paymentId });
  return { success: true, correlationId };
}
async function reconcilePendingPayments() {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  if (!isDbActive()) {
    return { processed, succeeded, failed };
  }
  while (inMemoryReconciliationQueue.length > 0) {
    const memItem = inMemoryReconciliationQueue.shift();
    if (!memItem) break;
    processed++;
    try {
      const fulfillRes = await fulfillPayment(memItem.paymentId, memItem.telegramPaymentChargeId, {
        expectedUserId: memItem.userId,
        expectedAmount: memItem.starsAmount
      });
      if (fulfillRes.success) {
        succeeded++;
        logger.info(`[RECONCILIATION] Successfully processed in-memory payment ${memItem.paymentId} (charge: ${memItem.telegramPaymentChargeId})`, { correlationId: memItem.correlationId });
      } else {
        failed++;
        memItem.attempts++;
        if (memItem.attempts < memItem.maxAttempts) {
          memItem.scheduledFor = Date.now() + Math.pow(2, memItem.attempts) * 2e3;
          inMemoryReconciliationQueue.push(memItem);
        } else {
          logger.error(`[RECONCILIATION DEAD-LETTER] In-memory payment ${memItem.paymentId} permanently failed: ${fulfillRes.error}`, { correlationId: memItem.correlationId });
        }
      }
    } catch (err) {
      failed++;
      memItem.attempts++;
      if (memItem.attempts < memItem.maxAttempts) {
        inMemoryReconciliationQueue.push(memItem);
      }
    }
  }
  try {
    const { rows } = await query(
      `UPDATE payment_reconciliation_queue
       SET status = 'processing', updated_at = NOW()
       WHERE id IN (
         SELECT q.id
         FROM payment_reconciliation_queue q
         WHERE q.status = 'pending' AND q.scheduled_for <= NOW()
         ORDER BY q.created_at ASC
         LIMIT 10
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, payment_id, telegram_payment_charge_id, user_id, stars_amount, attempts, max_attempts, correlation_id`
    );
    if (rows && rows.length > 0) {
      for (const row of rows) {
        processed++;
        const attempts = Number(row.attempts || 0) + 1;
        const maxAttempts = Number(row.max_attempts || 5);
        try {
          const res = await fulfillPayment(row.payment_id, row.telegram_payment_charge_id, {
            expectedUserId: row.user_id,
            expectedAmount: row.stars_amount
          });
          if (res.success) {
            succeeded++;
            await query(
              `UPDATE payment_reconciliation_queue 
               SET status = 'completed', attempts = $1, updated_at = NOW()
               WHERE id = $2`,
              [attempts, row.id]
            );
            logger.info(`[RECONCILIATION] Completed reconciliation for payment ${row.payment_id}`, { correlationId: row.correlation_id });
          } else {
            failed++;
            if (attempts >= maxAttempts) {
              await query(
                `UPDATE payment_reconciliation_queue 
                 SET status = 'dead_letter', attempts = $1, last_error = $2, updated_at = NOW()
                 WHERE id = $3`,
                [attempts, res.error || "UNKNOWN_ERROR", row.id]
              );
              logger.error(`[RECONCILIATION DEAD-LETTER] Payment ${row.payment_id} exceeded max attempts`, { correlationId: row.correlation_id, error: res.error });
            } else {
              const backoffSec = Math.pow(2, attempts) * 3;
              await query(
                `UPDATE payment_reconciliation_queue 
                 SET status = 'pending', attempts = $1, scheduled_for = NOW() + INTERVAL '1 second' * $2, last_error = $3, updated_at = NOW()
                 WHERE id = $4`,
                [attempts, backoffSec, res.error || "RETRY", row.id]
              );
            }
          }
        } catch (err) {
          failed++;
          const errStr = String(err?.message || err);
          if (attempts >= maxAttempts) {
            await query(
              `UPDATE payment_reconciliation_queue 
               SET status = 'dead_letter', attempts = $1, last_error = $2, updated_at = NOW()
               WHERE id = $3`,
              [attempts, errStr, row.id]
            );
          } else {
            const backoffSec = Math.pow(2, attempts) * 3;
            await query(
              `UPDATE payment_reconciliation_queue 
               SET status = 'pending', attempts = $1, scheduled_for = NOW() + INTERVAL '1 second' * $2, last_error = $3, updated_at = NOW()
               WHERE id = $4`,
              [attempts, backoffSec, errStr, row.id]
            );
          }
        }
      }
    }
  } catch (err) {
    logger.error("[RECONCILIATION] Error processing reconciliation queue:", err);
  }
  return { processed, succeeded, failed };
}
async function fulfillPayment(paymentId, telegramPaymentChargeId, options) {
  if (!isDbActive()) {
    if (config.nodeEnv === "production" || !config.mockModeAllowed) {
      return { success: false, error: "DATABASE_UNAVAILABLE" };
    }
    logger.info(`[PAYMENTS MOCK] DB inactive, fulfilling payment ${paymentId} with charge ${telegramPaymentChargeId}`);
    return { success: true };
  }
  return await transaction(async (client) => {
    const paymentRes = await client.query(
      `SELECT id, user_id, item_id, stars_amount, status, telegram_payment_charge_id
       FROM payments
       WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );
    if (paymentRes.rows.length === 0) {
      const chargeRes = await client.query(
        `SELECT id, user_id, item_id, stars_amount, status, telegram_payment_charge_id
         FROM payments
         WHERE telegram_payment_charge_id = $1 FOR UPDATE`,
        [telegramPaymentChargeId]
      );
      if (chargeRes.rows.length > 0) {
        const matchedPayment = chargeRes.rows[0];
        if (options?.expectedUserId && String(matchedPayment.user_id) !== String(options.expectedUserId)) {
          return { success: false, error: "USER_MISMATCH" };
        }
        return { success: true, alreadyPaid: true };
      }
      return { success: false, error: "PAYMENT_NOT_FOUND" };
    }
    const payment = paymentRes.rows[0];
    if (options?.expectedUserId !== void 0 && options.expectedUserId !== null) {
      if (String(payment.user_id) !== String(options.expectedUserId)) {
        logger.error(`[PAYMENTS SECURITY] User mismatch on payment ${paymentId}: expected ${options.expectedUserId}, found ${payment.user_id}`);
        return { success: false, error: "USER_MISMATCH" };
      }
    }
    if (options?.expectedAmount !== void 0 && options.expectedAmount !== null) {
      if (Number(payment.stars_amount) !== Number(options.expectedAmount)) {
        logger.error(`[PAYMENTS SECURITY] Amount mismatch on payment ${paymentId}: expected ${options.expectedAmount}, order is ${payment.stars_amount}`);
        return { success: false, error: "AMOUNT_MISMATCH" };
      }
    }
    if (options?.expectedCurrency && options.expectedCurrency.toUpperCase() !== "XTR") {
      return { success: false, error: "INVALID_CURRENCY" };
    }
    if (payment.status === "paid") {
      if (payment.telegram_payment_charge_id === telegramPaymentChargeId) {
        logger.info(`[PAYMENTS] Payment ${paymentId} already marked as paid with matching charge ID ${telegramPaymentChargeId}.`);
        return { success: true, alreadyPaid: true };
      } else {
        logger.error(`[PAYMENTS SECURITY ERROR] Order ${paymentId} is already paid under charge ${payment.telegram_payment_charge_id}, but received different charge ID ${telegramPaymentChargeId}. Rejecting second fulfillment.`);
        return { success: false, error: "ORDER_ALREADY_FULFILLED_WITH_DIFFERENT_CHARGE" };
      }
    }
    if (payment.status === "refunded") {
      logger.error(`[PAYMENTS SECURITY ERROR] Order ${paymentId} is marked as refunded. Cannot fulfill.`);
      return { success: false, error: "ORDER_ALREADY_REFUNDED" };
    }
    if (payment.status !== "created") {
      logger.error(`[PAYMENTS ERROR] Payment ${paymentId} has invalid status '${payment.status}' (expected 'created').`);
      return { success: false, error: "INVALID_PAYMENT_STATUS" };
    }
    if (telegramPaymentChargeId) {
      const existingCharge = await client.query(
        `SELECT id, user_id FROM payments WHERE telegram_payment_charge_id = $1`,
        [telegramPaymentChargeId]
      );
      if (existingCharge.rows.length > 0) {
        const matchedPaymentId = existingCharge.rows[0].id;
        if (matchedPaymentId === paymentId) {
          logger.info(`[PAYMENTS] Charge ID ${telegramPaymentChargeId} already recorded for payment ${paymentId}.`);
          return { success: true, alreadyPaid: true };
        } else {
          logger.error(`[PAYMENTS SECURITY ERROR] Charge ID ${telegramPaymentChargeId} already used by different payment ${matchedPaymentId} (attempted on ${paymentId}).`);
          return { success: false, error: "CHARGE_ID_ALREADY_USED_BY_ANOTHER_PAYMENT" };
        }
      }
    }
    const item = getStarsCatalogItem(payment.item_id);
    if (!item) {
      return { success: false, error: "ITEM_NOT_FOUND_IN_CATALOG" };
    }
    if (item.priceStars !== Number(payment.stars_amount)) {
      logger.error(`[PAYMENTS SECURITY] Catalog price mismatch: catalog=${item.priceStars}, recorded=${payment.stars_amount}`);
      return { success: false, error: "CATALOG_PRICE_MISMATCH" };
    }
    await client.query(
      `UPDATE payments
       SET status = 'paid', telegram_payment_charge_id = $1
       WHERE id = $2`,
      [telegramPaymentChargeId, payment.id]
    );
    const userId = payment.user_id;
    if (item.id === "season_pass_paid") {
      const seasonRes = await client.query(`SELECT id FROM seasons WHERE is_active = TRUE LIMIT 1`);
      if (seasonRes.rows.length > 0) {
        const seasonId = seasonRes.rows[0].id;
        await client.query(
          `INSERT INTO season_scores (season_id, user_id, pass_tier) VALUES ($1, $2, 'PAID')
           ON CONFLICT (season_id, user_id) DO UPDATE SET pass_tier = 'PAID'`,
          [seasonId, userId]
        );
      }
    }
    if (item.rewardStardustBonus && item.rewardStardustBonus > 0) {
      await client.query(
        `UPDATE wallets SET stardust = stardust + $1 WHERE user_id = $2`,
        [item.rewardStardustBonus, userId]
      );
    }
    if (item.type === "insurance") {
      await client.query(
        `UPDATE users SET has_streak_insurance = TRUE WHERE id = $1`,
        [userId]
      );
    }
    const shipId = item.rewardShipId || item.rewardCosmeticId;
    if (shipId) {
      await client.query(
        `INSERT INTO inventory (user_id, item_id, source, payment_id, acquisition_count)
         VALUES ($1, $2, 'stars_shop', $3, 1)
         ON CONFLICT (user_id, item_id) 
         DO UPDATE SET acquisition_count = inventory.acquisition_count + 1, payment_id = COALESCE(EXCLUDED.payment_id, inventory.payment_id)`,
        [userId, shipId, payment.id]
      );
    }
    logger.info(`[PAYMENTS SUCCESS] User ${userId} successfully purchased ${item.id} (${item.priceStars} XTR), chargeId: ${telegramPaymentChargeId}`);
    return { success: true };
  });
}
async function refundPayment(userId, telegramPaymentChargeId) {
  if (!isDbActive()) {
    if (config.nodeEnv === "production" || !config.mockModeAllowed) {
      return { success: false, error: "DATABASE_UNAVAILABLE" };
    }
    logger.info(`[REFUND MOCK] DB inactive, refunding user ${userId} charge ${telegramPaymentChargeId}`);
    return { success: true };
  }
  return await transaction(async (client) => {
    const paymentRes = await client.query(
      `SELECT id, user_id, item_id, status
       FROM payments
       WHERE telegram_payment_charge_id = $1 AND user_id = $2 FOR UPDATE`,
      [telegramPaymentChargeId, userId]
    );
    if (paymentRes.rows.length === 0) {
      return { success: false, error: "PAYMENT_NOT_FOUND" };
    }
    const payment = paymentRes.rows[0];
    if (payment.status === "refunded") {
      return { success: true };
    }
    if (payment.status !== "paid") {
      return { success: false, error: "PAYMENT_NOT_PAID" };
    }
    await client.query(
      `UPDATE payments SET status = 'refunded' WHERE id = $1`,
      [payment.id]
    );
    const item = getStarsCatalogItem(payment.item_id);
    if (item) {
      if (item.rewardStardustBonus && item.rewardStardustBonus > 0) {
        await client.query(
          `UPDATE wallets SET stardust = GREATEST(0, stardust - $1) WHERE user_id = $2`,
          [item.rewardStardustBonus, userId]
        );
      }
      if (item.type === "insurance") {
        await client.query(
          `UPDATE users SET has_streak_insurance = FALSE WHERE id = $1`,
          [userId]
        );
      }
      const shipId = item.rewardShipId || item.rewardCosmeticId;
      if (shipId) {
        const invRes = await client.query(
          `SELECT acquisition_count, payment_id FROM inventory WHERE user_id = $1 AND item_id = $2 FOR UPDATE`,
          [userId, shipId]
        );
        if (invRes.rows.length > 0) {
          const inv = invRes.rows[0];
          const count = Number(inv.acquisition_count || 1);
          if (count > 1) {
            await client.query(
              `UPDATE inventory SET acquisition_count = acquisition_count - 1 WHERE user_id = $1 AND item_id = $2`,
              [userId, shipId]
            );
          } else if (inv.payment_id === payment.id || inv.payment_id === null) {
            await client.query(
              `DELETE FROM inventory WHERE user_id = $1 AND item_id = $2`,
              [userId, shipId]
            );
          } else {
            logger.info(`[REFUND] Item ${shipId} for user ${userId} acquired from another payment/source (payment_id: ${inv.payment_id}), retaining in inventory.`);
          }
        }
      }
    }
    logger.info(`[REFUND SUCCESS] Refunded payment ${payment.id} for user ${userId}, chargeId: ${telegramPaymentChargeId}`);
    return { success: true };
  });
}
router3.post("/stars/create-invoice", requireAuth, async (req, res) => {
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "INVALID_ITEM_ID", details: parsed.error.issues });
  }
  const { itemId } = parsed.data;
  const user = req.user;
  const catalogItem = getStarsCatalogItem(itemId);
  if (!catalogItem) {
    return res.status(400).json({ success: false, error: "ITEM_NOT_FOUND_IN_CATALOG" });
  }
  if (!isDbActive() && (config.nodeEnv === "production" || !config.mockModeAllowed)) {
    return res.status(503).json({
      success: false,
      error: "DATABASE_UNAVAILABLE",
      message: "Payment system is temporarily unavailable. Please try again later."
    });
  }
  try {
    const paymentId = crypto2.randomUUID();
    await query(
      `INSERT INTO payments (id, user_id, item_id, stars_amount, status, created_at)
       VALUES ($1, $2, $3, $4, 'created', NOW())`,
      [paymentId, user.id, catalogItem.id, catalogItem.priceStars]
    );
    if (!config.botToken) {
      return res.status(400).json({
        success: false,
        error: "TELEGRAM_BOT_TOKEN is not configured on the server"
      });
    }
    const payload = JSON.stringify({ paymentId, userId: user.id, itemId: catalogItem.id });
    const tgResponse = await fetch(`https://api.telegram.org/bot${config.botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: catalogItem.titleEn,
        description: catalogItem.descEn,
        payload,
        currency: "XTR",
        prices: [{ label: catalogItem.titleEn, amount: catalogItem.priceStars }]
      })
    });
    const tgData = await tgResponse.json();
    if (!tgData.ok) {
      logger.error("[PAYMENTS ERROR] Telegram createInvoiceLink failed:", tgData);
      return res.status(400).json({
        success: false,
        error: tgData.description || "TELEGRAM_INVOICE_ERROR"
      });
    }
    return res.json({
      success: true,
      invoiceUrl: tgData.result,
      paymentId
    });
  } catch (err) {
    logger.error("[PAYMENTS ERROR] create-invoice exception:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "INTERNAL_SERVER_ERROR"
    });
  }
});
router3.get("/stars/status/:paymentId", requireAuth, async (req, res) => {
  const { paymentId } = req.params;
  const user = req.user;
  if (!paymentId) {
    return res.status(400).json({ success: false, error: "MISSING_PAYMENT_ID" });
  }
  if (isDbActive()) {
    try {
      const resDb = await query(
        `SELECT id, user_id, item_id, stars_amount, status, created_at, telegram_payment_charge_id
         FROM payments WHERE id = $1 AND user_id = $2`,
        [paymentId, user.id]
      );
      if (resDb.rows.length === 0) {
        return res.status(404).json({ success: false, error: "PAYMENT_NOT_FOUND" });
      }
      const p = resDb.rows[0];
      return res.json({
        success: true,
        paymentId: p.id,
        itemId: p.item_id,
        starsAmount: Number(p.stars_amount),
        status: p.status,
        isPaid: p.status === "paid"
      });
    } catch (err) {
      logger.error("[PAYMENTS STATUS ERROR]", err);
      return res.status(500).json({ success: false, error: "DATABASE_ERROR" });
    }
  }
  if (config.nodeEnv === "production" || !config.mockModeAllowed) {
    return res.status(503).json({
      success: false,
      error: "Database unavailable in production",
      message: "Service temporarily unavailable. Database required."
    });
  }
  return res.json({
    success: true,
    paymentId,
    status: "paid",
    isPaid: true
  });
});
router3.post("/stars/fulfill", requireAuth, async (req, res) => {
  if (config.nodeEnv === "production") {
    return res.status(403).json({
      success: false,
      error: "DIRECT_FULFILLMENT_FORBIDDEN",
      message: "In production, Stars payments are fulfilled exclusively via official Telegram Bot webhooks."
    });
  }
  const { paymentId, chargeId, expectedUserId, expectedAmount } = req.body;
  if (!paymentId || !chargeId) {
    return res.status(400).json({ success: false, error: "MISSING_PARAMETERS" });
  }
  const result = await fulfillPayment(paymentId, chargeId, {
    expectedUserId,
    expectedAmount
  });
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});
var stars_default = router3;

// server/routes/economy.ts
import { Router as Router4 } from "express";

// src/shared/cosmetics.ts
var COSMETIC_ITEMS = [
  // 🚀 SHIPS (10 Items)
  {
    id: "ship_cyber_wing",
    category: "ship",
    rarity: "common",
    nameEn: "Cyber Wing",
    nameRu: "\u041A\u0438\u0431\u0435\u0440 \u041A\u0440\u044B\u043B\u043E",
    descEn: "Standard issue 80s synthwave interceptor.",
    descRu: "\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439 \u0441\u0438\u043D\u0442\u0432\u0435\u0439\u0432-\u043F\u0435\u0440\u0435\u0445\u0432\u0430\u0442\u0447\u0438\u043A \u0441 \u043D\u0435\u043E\u043D\u043E\u0432\u044B\u043C \u043A\u043E\u043D\u0442\u0443\u0440\u043E\u043C.",
    priceStardust: 0,
    previewColor: "#00F5D4",
    accentColor: "#9D4EDD",
    iconSymbol: "\u{1F680}"
  },
  {
    id: "ship_retro_shuttle",
    category: "ship",
    rarity: "rare",
    nameEn: "80s Shuttle",
    nameRu: "\u0420\u0435\u0442\u0440\u043E \u0428\u0430\u0442\u0442\u043B",
    descEn: "Vaporwave era explorer with dual magenta thrusters.",
    descRu: "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u044D\u043F\u043E\u0445\u0438 \u0432\u0435\u0439\u043F\u043E\u0440\u0432\u0435\u0439\u0432 \u0441 \u0434\u0432\u043E\u0439\u043D\u044B\u043C\u0438 \u043F\u0443\u0440\u043F\u0443\u0440\u043D\u044B\u043C\u0438 \u0434\u044E\u0437\u0430\u043C\u0438.",
    priceStardust: 500,
    previewColor: "#FF007F",
    accentColor: "#FFB703",
    iconSymbol: "\u{1F6F8}"
  },
  {
    id: "ship_neon_falcon",
    category: "ship",
    rarity: "epic",
    nameEn: "Neon Falcon",
    nameRu: "\u041D\u0435\u043E\u043D\u043E\u0432\u044B\u0439 \u0421\u043E\u043A\u043E\u043B",
    descEn: "High velocity starfighter powered by hyper pulse drive.",
    descRu: "\u0412\u044B\u0441\u043E\u043A\u043E\u0441\u043A\u043E\u0440\u043E\u0441\u0442\u043D\u043E\u0439 \u0438\u0441\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B\u044C \u0441 \u0433\u0438\u043F\u0435\u0440-\u0438\u043C\u043F\u0443\u043B\u044C\u0441\u043D\u044B\u043C \u0434\u0432\u0438\u0433\u0430\u0442\u0435\u043B\u0435\u043C.",
    priceStardust: 1200,
    previewColor: "#FFB703",
    accentColor: "#00F5D4",
    iconSymbol: "\u{1F985}"
  },
  {
    id: "ship_plasma_crusher",
    category: "ship",
    rarity: "legendary",
    nameEn: "Plasma Crusher",
    nameRu: "\u041F\u043B\u0430\u0437\u043C\u0435\u043D\u043D\u044B\u0439 \u041A\u0440\u0443\u0448\u0438\u0442\u0435\u043B\u044C",
    descEn: "Heavy orbital dreadnought with radiating solar energy core.",
    descRu: "\u0422\u044F\u0436\u0451\u043B\u044B\u0439 \u043E\u0440\u0431\u0438\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u0434\u0440\u0435\u0434\u043D\u043E\u0443\u0442 \u0441 \u0438\u0437\u043B\u0443\u0447\u0430\u044E\u0449\u0438\u043C \u0441\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u043C \u044F\u0434\u0440\u043E\u043C.",
    priceStardust: 2500,
    previewColor: "#FF0054",
    accentColor: "#7000FF",
    iconSymbol: "\u{1F451}"
  },
  {
    id: "ship_starlight_glider",
    category: "ship",
    rarity: "common",
    nameEn: "Starlight Glider",
    nameRu: "\u0417\u0432\u0435\u0437\u0434\u043D\u044B\u0439 \u041F\u043B\u0430\u043D\u0435\u0440",
    descEn: "Lightweight scout designed for high-speed asteroid dodging.",
    descRu: "\u041B\u0435\u0433\u043A\u0438\u0439 \u0440\u0430\u0437\u0432\u0435\u0434\u0447\u0438\u043A \u0434\u043B\u044F \u0431\u044B\u0441\u0442\u0440\u043E\u0433\u043E \u043C\u0430\u043D\u0435\u0432\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0441\u0440\u0435\u0434\u0438 \u0430\u0441\u0442\u0435\u0440\u043E\u0438\u0434\u043E\u0432.",
    priceStardust: 200,
    previewColor: "#3A86FF",
    accentColor: "#8338EC",
    iconSymbol: "\u2708\uFE0F"
  },
  {
    id: "ship_pulsar_speeder",
    category: "ship",
    rarity: "rare",
    nameEn: "Pulsar Speeder",
    nameRu: "\u041F\u0443\u043B\u044C\u0441\u0430\u0440 \u0421\u043F\u0438\u0434\u0435\u0440",
    descEn: "Sleek interceptor tuned to cosmic radio frequencies.",
    descRu: "\u041E\u0431\u0442\u0435\u043A\u0430\u0435\u043C\u044B\u0439 \u043F\u0435\u0440\u0435\u0445\u0432\u0430\u0442\u0447\u0438\u043A, \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0439 \u043D\u0430 \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0447\u0430\u0441\u0442\u043E\u0442\u044B.",
    priceStardust: 650,
    previewColor: "#00B4D8",
    accentColor: "#90E0EF",
    iconSymbol: "\u26A1"
  },
  {
    id: "ship_void_phantom",
    category: "ship",
    rarity: "epic",
    nameEn: "Void Phantom",
    nameRu: "\u0424\u0430\u043D\u0442\u043E\u043C \u0411\u0435\u0437\u0434\u043D\u044B",
    descEn: "Stealth cruiser wrapped in absorption panels.",
    descRu: "\u0421\u0442\u0435\u043B\u0441-\u043A\u0440\u0435\u0439\u0441\u0435\u0440, \u043E\u0431\u0448\u0438\u0442\u044B\u0439 \u0441\u0432\u0435\u0442\u043E\u043F\u043E\u0433\u043B\u043E\u0449\u0430\u044E\u0449\u0438\u043C\u0438 \u043F\u0430\u043D\u0435\u043B\u044F\u043C\u0438.",
    priceStardust: 1400,
    previewColor: "#480CA8",
    accentColor: "#F72585",
    iconSymbol: "\u{1F47B}"
  },
  {
    id: "ship_solar_titan",
    category: "ship",
    rarity: "legendary",
    nameEn: "Solar Titan",
    nameRu: "\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0439 \u0422\u0438\u0442\u0430\u043D",
    descEn: "Colossal warship forged in stellar nurseries.",
    descRu: "\u041A\u043E\u043B\u043E\u0441\u0441\u0430\u043B\u044C\u043D\u044B\u0439 \u0431\u043E\u0435\u0432\u043E\u0439 \u043A\u043E\u0440\u0430\u0431\u043B\u044C, \u0432\u044B\u043A\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0432 \u0437\u0432\u0435\u0437\u0434\u043D\u044B\u0445 \u043A\u043E\u043B\u044B\u0431\u0435\u043B\u044F\u0445.",
    priceStardust: 2800,
    previewColor: "#FB5607",
    accentColor: "#FFBE0B",
    iconSymbol: "\u2600\uFE0F"
  },
  {
    id: "ship_astro_zenith",
    category: "ship",
    rarity: "rare",
    nameEn: "Astro Zenith",
    nameRu: "\u0410\u0441\u0442\u0440\u043E \u0417\u0435\u043D\u0438\u0442",
    descEn: "Equipped with advanced navigation telemetry suites.",
    descRu: "\u041E\u0441\u043D\u0430\u0449\u0435\u043D \u043F\u0435\u0440\u0435\u0434\u043E\u0432\u044B\u043C\u0438 \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u043C\u0438 \u0442\u0435\u043B\u0435\u043C\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u043C\u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u0430\u043C\u0438.",
    priceStardust: 550,
    previewColor: "#3A0CA3",
    accentColor: "#4CC9F0",
    iconSymbol: "\u{1F6F0}\uFE0F"
  },
  {
    id: "ship_nebula_sting",
    category: "ship",
    rarity: "epic",
    nameEn: "Nebula Sting",
    nameRu: "\u0416\u0430\u043B\u043E \u0422\u0443\u043C\u0430\u043D\u043D\u043E\u0441\u0442\u0438",
    descEn: "Agile fighter with plasma stingers.",
    descRu: "\u041C\u0430\u043D\u0435\u0432\u0440\u0435\u043D\u043D\u044B\u0439 \u0438\u0441\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B\u044C \u0441 \u043F\u043B\u0430\u0437\u043C\u0435\u043D\u043D\u044B\u043C\u0438 \u0436\u0430\u043B\u0430\u043C\u0438.",
    priceStardust: 1300,
    previewColor: "#7209B7",
    accentColor: "#F72585",
    iconSymbol: "\u{1F982}"
  },
  // ✨ ENGINE TRAILS (10 Items)
  {
    id: "trail_cyan_beam",
    category: "trail",
    rarity: "common",
    nameEn: "Cyan Ion Flow",
    nameRu: "\u0413\u043E\u043B\u0443\u0431\u043E\u0439 \u0418\u043E\u043D\u043D\u044B\u0439 \u041F\u043E\u0442\u043E\u043A",
    descEn: "Classic cyan plasma exhaust trail behind your ship.",
    descRu: "\u041A\u043B\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0438\u043E\u043D\u043D\u044B\u0439 \u0448\u043B\u0435\u0439\u0444 \u0431\u0438\u0440\u044E\u0437\u043E\u0432\u043E\u0433\u043E \u0446\u0432\u0435\u0442\u0430 \u0437\u0430 \u043A\u043E\u0440\u043C\u043E\u0439.",
    priceStardust: 0,
    previewColor: "#00F5D4",
    accentColor: "#00B4D8",
    iconSymbol: "\u2728"
  },
  {
    id: "trail_rainbow_synth",
    category: "trail",
    rarity: "rare",
    nameEn: "Synth Spectrum",
    nameRu: "\u0421\u0438\u043D\u0442-\u0421\u043F\u0435\u043A\u0442\u0440",
    descEn: "Multi-colored neon rainbow particle stream.",
    descRu: "\u041C\u043D\u043E\u0433\u043E\u0446\u0432\u0435\u0442\u043D\u044B\u0439 \u0441\u0442\u0440\u0443\u044F\u0449\u0438\u0439\u0441\u044F \u0440\u0430\u0434\u0443\u0436\u043D\u044B\u0439 \u043D\u0435\u043E\u043D\u043E\u0432\u044B\u0439 \u0441\u043B\u0435\u0434.",
    priceStardust: 400,
    previewColor: "#FF007F",
    accentColor: "#FFB703",
    iconSymbol: "\u{1F308}"
  },
  {
    id: "trail_solar_flare",
    category: "trail",
    rarity: "epic",
    nameEn: "Solar Pulse Trail",
    nameRu: "\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0439 \u0418\u043C\u043F\u0443\u043B\u044C\u0441",
    descEn: "Blazing golden embers swirling behind thrusters.",
    descRu: "\u041F\u044B\u043B\u0430\u044E\u0449\u0438\u0435 \u0437\u043E\u043B\u043E\u0442\u044B\u0435 \u0438\u0441\u043A\u0440\u044B, \u043A\u0440\u0443\u0436\u0430\u0449\u0438\u0435\u0441\u044F \u0437\u0430 \u0441\u043E\u043F\u043B\u0430\u043C\u0438.",
    priceStardust: 900,
    previewColor: "#FFB703",
    accentColor: "#FB5607",
    iconSymbol: "\u{1F525}"
  },
  {
    id: "trail_void_vortex",
    category: "trail",
    rarity: "legendary",
    nameEn: "Void Warp Ribbon",
    nameRu: "\u0428\u043B\u0435\u0439\u0444 \u0422\u0451\u043C\u043D\u043E\u0439 \u041C\u0430\u0442\u0435\u0440\u0438\u0438",
    descEn: "Ultraviolet dark energy vortex trailing in deep space.",
    descRu: "\u0423\u043B\u044C\u0442\u0440\u0430\u0444\u0438\u043E\u043B\u0435\u0442\u043E\u0432\u044B\u0439 \u0432\u0438\u0445\u0440\u044C \u0442\u0451\u043C\u043D\u043E\u0439 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u0432 \u0433\u043B\u0443\u0431\u043E\u043A\u043E\u043C \u043A\u043E\u0441\u043C\u043E\u0441\u0435.",
    priceStardust: 2e3,
    previewColor: "#7000FF",
    accentColor: "#FF0054",
    iconSymbol: "\u{1F52E}"
  },
  {
    id: "trail_matrix_code",
    category: "trail",
    rarity: "rare",
    nameEn: "Matrix Stream",
    nameRu: "\u041C\u0430\u0442\u0440\u0438\u0447\u043D\u044B\u0439 \u041F\u043E\u0442\u043E\u043A",
    descEn: "Cascading green digital symbols trailing behind.",
    descRu: "\u041A\u0430\u0441\u043A\u0430\u0434 \u0437\u0435\u043B\u0435\u043D\u044B\u0445 \u0446\u0438\u0444\u0440\u043E\u0432\u044B\u0445 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 \u0432 \u043A\u0438\u043B\u044C\u0432\u0430\u0442\u0435\u0440\u0435.",
    priceStardust: 450,
    previewColor: "#00FF66",
    accentColor: "#004B23",
    iconSymbol: "\u{1F4BB}"
  },
  {
    id: "trail_amber_spark",
    category: "trail",
    rarity: "common",
    nameEn: "Amber Sparkle",
    nameRu: "\u042F\u043D\u0442\u0430\u0440\u043D\u0430\u044F \u0418\u0441\u043A\u0440\u0430",
    descEn: "Warm amber glow particles.",
    descRu: "\u0422\u0435\u043F\u043B\u044B\u0435 \u044F\u043D\u0442\u0430\u0440\u043D\u044B\u0435 \u0441\u0432\u0435\u0442\u044F\u0449\u0438\u0435\u0441\u044F \u0447\u0430\u0441\u0442\u0438\u0446\u044B.",
    priceStardust: 150,
    previewColor: "#FFB703",
    accentColor: "#FD9E02",
    iconSymbol: "\u2728"
  },
  {
    id: "trail_plasma_ribbon",
    category: "trail",
    rarity: "epic",
    nameEn: "Plasma Ribbon",
    nameRu: "\u041F\u043B\u0430\u0437\u043C\u0435\u043D\u043D\u0430\u044F \u041B\u0435\u043D\u0442\u0430",
    descEn: "Glowing ribbon of high-temperature plasma.",
    descRu: "\u0421\u0432\u0435\u0442\u044F\u0449\u0430\u044F\u0441\u044F \u043B\u0435\u043D\u0442\u0430 \u0432\u044B\u0441\u043E\u043A\u043E\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0439 \u043F\u043B\u0430\u0437\u043C\u044B.",
    priceStardust: 950,
    previewColor: "#F72585",
    accentColor: "#7209B7",
    iconSymbol: "\u{1F397}\uFE0F"
  },
  {
    id: "trail_supernova_dust",
    category: "trail",
    rarity: "legendary",
    nameEn: "Supernova Stardust",
    nameRu: "\u041F\u044B\u043B\u044C \u0421\u0432\u0435\u0440\u0445\u043D\u043E\u0432\u043E\u0439",
    descEn: "Diamond-grade stardust scattering across space.",
    descRu: "\u0410\u043B\u043C\u0430\u0437\u043D\u0430\u044F \u0437\u0432\u0435\u0437\u0434\u043D\u0430\u044F \u043F\u044B\u043B\u044C, \u0440\u0430\u0441\u0441\u044B\u043F\u0430\u044E\u0449\u0430\u044F\u0441\u044F \u043F\u043E \u043A\u043E\u0441\u043C\u043E\u0441\u0443.",
    priceStardust: 2200,
    previewColor: "#4CC9F0",
    accentColor: "#7209B7",
    iconSymbol: "\u{1F4AB}"
  },
  {
    id: "trail_neon_pulse",
    category: "trail",
    rarity: "rare",
    nameEn: "Neon Pulse Trail",
    nameRu: "\u041D\u0435\u043E\u043D\u043E\u0432\u044B\u0439 \u041F\u0443\u043B\u044C\u0441",
    descEn: "Rhythmic pulsing light emissions.",
    descRu: "\u0420\u0438\u0442\u043C\u0438\u0447\u043D\u043E \u043F\u0443\u043B\u044C\u0441\u0438\u0440\u0443\u044E\u0449\u0438\u0435 \u0441\u0432\u0435\u0442\u043E\u0432\u044B\u0435 \u0438\u0437\u043B\u0443\u0447\u0435\u043D\u0438\u044F.",
    priceStardust: 500,
    previewColor: "#00F5D4",
    accentColor: "#7209B7",
    iconSymbol: "\u{1F6A5}"
  },
  {
    id: "trail_quantum_wake",
    category: "trail",
    rarity: "epic",
    nameEn: "Quantum Wake",
    nameRu: "\u041A\u0432\u0430\u043D\u0442\u043E\u0432\u044B\u0439 \u041A\u0438\u043B\u044C\u0432\u0430\u0442\u0435\u0440",
    descEn: "Quantum distorted space-time ripples.",
    descRu: "\u0418\u0441\u043A\u0440\u0438\u0432\u043B\u0435\u043D\u043D\u044B\u0435 \u043A\u0432\u0430\u043D\u0442\u043E\u0432\u044B\u0435 \u0440\u044F\u0431\u0438 \u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0430-\u0432\u0440\u0435\u043C\u0435\u043D\u0438.",
    priceStardust: 1100,
    previewColor: "#560BAD",
    accentColor: "#B5179E",
    iconSymbol: "\u{1F30A}"
  },
  // 🌌 BACKDROPS (10 Items)
  {
    id: "backdrop_synth_grid",
    category: "backdrop",
    rarity: "common",
    nameEn: "Synth Horizon",
    nameRu: "\u0421\u0438\u043D\u0442\u0432\u0430\u0439\u0432 \u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442",
    descEn: "Perspective grid with purple sunset skyline.",
    descRu: "\u041F\u0435\u0440\u0441\u043F\u0435\u043A\u0442\u0438\u0432\u043D\u0430\u044F \u043D\u0435\u043E\u043D\u043E\u0432\u0430\u044F \u0441\u0435\u0442\u043A\u0430 \u0441 \u0444\u0438\u043E\u043B\u0435\u0442\u043E\u0432\u044B\u043C \u0437\u0430\u043A\u0430\u0442\u043D\u044B\u043C \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u043E\u043C.",
    priceStardust: 0,
    previewColor: "#0B071E",
    accentColor: "#9D4EDD",
    iconSymbol: "\u{1F306}"
  },
  {
    id: "backdrop_orion_nebula",
    category: "backdrop",
    rarity: "rare",
    nameEn: "Orion Nebula",
    nameRu: "\u0422\u0443\u043C\u0430\u043D\u043D\u043E\u0441\u0442\u044C \u041E\u0440\u0438\u043E\u043D\u0430",
    descEn: "Deep cyan space dust glowing with distant starlight.",
    descRu: "\u0413\u043B\u0443\u0431\u043E\u043A\u0430\u044F \u0433\u043E\u043B\u0443\u0431\u0430\u044F \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043F\u044B\u043B\u044C \u0441 \u043C\u0435\u0440\u0446\u0430\u044E\u0449\u0438\u043C\u0438 \u0437\u0432\u0451\u0437\u0434\u0430\u043C\u0438.",
    priceStardust: 600,
    previewColor: "#050B14",
    accentColor: "#00F5D4",
    iconSymbol: "\u{1F30C}"
  },
  {
    id: "backdrop_saturn_rings",
    category: "backdrop",
    rarity: "epic",
    nameEn: "Saturn Rings",
    nameRu: "\u041A\u043E\u043B\u044C\u0446\u0430 \u0421\u0430\u0442\u0443\u0440\u043D\u0430",
    descEn: "Amber planetary ring system floating in dark cosmic orbit.",
    descRu: "\u042F\u043D\u0442\u0430\u0440\u043D\u0430\u044F \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043F\u043B\u0430\u043D\u0435\u0442\u043D\u044B\u0445 \u043A\u043E\u043B\u0435\u0446 \u043D\u0430 \u0442\u0451\u043C\u043D\u043E\u0439 \u043E\u0440\u0431\u0438\u0442\u0435.",
    priceStardust: 1100,
    previewColor: "#1A002C",
    accentColor: "#FFB703",
    iconSymbol: "\u{1FA90}"
  },
  {
    id: "backdrop_hyper_warp",
    category: "backdrop",
    rarity: "legendary",
    nameEn: "Hyper Wavelength",
    nameRu: "\u0413\u0438\u043F\u0435\u0440 \u0412\u043E\u043B\u043D\u0430",
    descEn: "Radiant magenta hyperspace tunnel with pulsing light grids.",
    descRu: "\u0421\u0438\u044F\u044E\u0449\u0438\u0439 \u043F\u0443\u0440\u043F\u0443\u0440\u043D\u044B\u0439 \u0433\u0438\u043F\u0435\u0440\u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u0442\u043E\u043D\u043D\u0435\u043B\u044C \u0441 \u043F\u0443\u043B\u044C\u0441\u0430\u0446\u0438\u0435\u0439.",
    priceStardust: 2200,
    previewColor: "#2B003B",
    accentColor: "#FF007F",
    iconSymbol: "\u26A1"
  },
  {
    id: "backdrop_neon_city",
    category: "backdrop",
    rarity: "rare",
    nameEn: "Neo-Tokyo Skyline",
    nameRu: "\u041D\u0435\u043E-\u0422\u043E\u043A\u0438\u043E \u0421\u0438\u0442\u0438",
    descEn: "Cyberpunk towering skyscrapers glowing in neon lights.",
    descRu: "\u041A\u0438\u0431\u0435\u0440\u043F\u0430\u043D\u043A\u043E\u0432\u0441\u043A\u0438\u0435 \u043D\u0435\u0431\u043E\u0441\u043A\u0440\u0435\u0431\u044B, \u0441\u0438\u044F\u044E\u0449\u0438\u0435 \u0432 \u043D\u0435\u043E\u043D\u043E\u0432\u044B\u0445 \u043E\u0433\u043D\u044F\u0445.",
    priceStardust: 700,
    previewColor: "#10002B",
    accentColor: "#E0AAFF",
    iconSymbol: "\u{1F3D9}\uFE0F"
  },
  {
    id: "backdrop_deep_space",
    category: "backdrop",
    rarity: "common",
    nameEn: "Deep Abyss",
    nameRu: "\u0413\u043B\u0443\u0431\u043E\u043A\u0430\u044F \u0411\u0435\u0437\u0434\u043D\u0430",
    descEn: "Pitch black void sprinkled with distant star clusters.",
    descRu: "\u0418\u0441\u0441\u0438\u043D\u044F-\u0447\u0435\u0440\u043D\u0430\u044F \u043F\u0443\u0441\u0442\u043E\u0442\u0430 \u0441 \u0434\u0430\u043B\u0435\u043A\u0438\u043C\u0438 \u0437\u0432\u0435\u0437\u0434\u043D\u044B\u043C\u0438 \u0441\u043A\u043E\u043F\u043B\u0435\u043D\u0438\u044F\u043C\u0438.",
    priceStardust: 250,
    previewColor: "#010203",
    accentColor: "#3A86FF",
    iconSymbol: "\u2728"
  },
  {
    id: "backdrop_binary_star",
    category: "backdrop",
    rarity: "epic",
    nameEn: "Binary Star System",
    nameRu: "\u0414\u0432\u043E\u0439\u043D\u0430\u044F \u0417\u0432\u0435\u0437\u0434\u043D\u0430\u044F \u0421\u0438\u0441\u0442\u0435\u043C\u0430",
    descEn: "Two giant suns orbiting in cosmic harmony.",
    descRu: "\u0414\u0432\u0430 \u0433\u0438\u0433\u0430\u043D\u0442\u0441\u043A\u0438\u0445 \u0441\u043E\u043B\u043D\u0446\u0430, \u0432\u0440\u0430\u0449\u0430\u044E\u0449\u0438\u0445\u0441\u044F \u0432 \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u0433\u0430\u0440\u043C\u043E\u043D\u0438\u0438.",
    priceStardust: 1250,
    previewColor: "#240046",
    accentColor: "#FF006E",
    iconSymbol: "\u{1F506}"
  },
  {
    id: "backdrop_quantum_realm",
    category: "backdrop",
    rarity: "legendary",
    nameEn: "Quantum Singularity Realm",
    nameRu: "\u0426\u0430\u0440\u0441\u0442\u0432\u043E \u0421\u0438\u043D\u0433\u0443\u043B\u044F\u0440\u043D\u043E\u0441\u0442\u0438",
    descEn: "Surreal spacetime warping distortion background.",
    descRu: "\u0421\u044E\u0440\u0440\u0435\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u044B\u0439 \u0444\u043E\u043D \u0438\u0441\u043A\u0440\u0438\u0432\u043B\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u043E-\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0438\u043D\u0443\u0443\u043C\u0430.",
    priceStardust: 2600,
    previewColor: "#03071E",
    accentColor: "#DC2F02",
    iconSymbol: "\u{1F300}"
  },
  {
    id: "backdrop_pulsar_storm",
    category: "backdrop",
    rarity: "rare",
    nameEn: "Pulsar Storm",
    nameRu: "\u0428\u0442\u043E\u0440\u043C \u041F\u0443\u043B\u044C\u0441\u0430\u0440\u0430",
    descEn: "Electrical cosmic storms across stellar clouds.",
    descRu: "\u042D\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0431\u0443\u0440\u0438 \u0441\u0440\u0435\u0434\u0438 \u0437\u0432\u0435\u0437\u0434\u043D\u044B\u0445 \u043E\u0431\u043B\u0430\u043A\u043E\u0432.",
    priceStardust: 650,
    previewColor: "#0B090A",
    accentColor: "#669BBC",
    iconSymbol: "\u{1F329}\uFE0F"
  },
  {
    id: "backdrop_galaxy_spiral",
    category: "backdrop",
    rarity: "epic",
    nameEn: "Spiral Galaxy",
    nameRu: "\u0421\u043F\u0438\u0440\u0430\u043B\u044C\u043D\u0430\u044F \u0413\u0430\u043B\u0430\u043A\u0442\u0438\u043A\u0430",
    descEn: "Majestic swirling spiral arms of starlight.",
    descRu: "\u0412\u0435\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435 \u0437\u0430\u043A\u0440\u0443\u0447\u0435\u043D\u043D\u044B\u0435 \u0441\u043F\u0438\u0440\u0430\u043B\u044C\u043D\u044B\u0435 \u0440\u0443\u043A\u0430\u0432\u0430 \u0437\u0432\u0435\u0437\u0434\u043D\u043E\u0433\u043E \u0441\u0432\u0435\u0442\u0430.",
    priceStardust: 1150,
    previewColor: "#10002B",
    accentColor: "#7B2CBF",
    iconSymbol: "\u{1F365}"
  },
  // 💥 EXPLOSIONS (10 Items)
  {
    id: "exp_retro_burst",
    category: "explosion",
    rarity: "common",
    nameEn: "Pixel Spark Burst",
    nameRu: "\u041F\u0438\u043A\u0441\u0435\u043B\u044C\u043D\u0430\u044F \u0412\u0441\u043F\u044B\u0448\u043A\u0430",
    descEn: "Classic 8-bit square particle explosion upon target hit.",
    descRu: "\u041A\u043B\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043A\u0438\u0439 8-\u0431\u0438\u0442\u043D\u044B\u0439 \u0432\u0437\u0440\u044B\u0432 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u044B\u0445 \u043F\u0438\u043A\u0441\u0435\u043B\u0435\u0439.",
    priceStardust: 0,
    previewColor: "#00F5D4",
    accentColor: "#FFFFFF",
    iconSymbol: "\u{1F4A5}"
  },
  {
    id: "exp_neon_shockwave",
    category: "explosion",
    rarity: "rare",
    nameEn: "Neon Shockwave",
    nameRu: "\u041D\u0435\u043E\u043D\u043E\u0432\u0430\u044F \u0423\u0434\u0430\u0440\u043D\u0430\u044F \u0412\u043E\u043B\u043D\u0430",
    descEn: "Expanding magenta ring with glowing shockwave particle ring.",
    descRu: "\u0420\u0430\u0441\u0448\u0438\u0440\u044F\u044E\u0449\u0435\u0435\u0441\u044F \u043D\u0435\u043E\u043D\u043E\u0432\u043E\u0435 \u043A\u043E\u043B\u044C\u0446\u043E \u0441 \u0438\u043C\u043F\u0443\u043B\u044C\u0441\u043E\u043C \u043F\u0440\u0438 \u043F\u043E\u043F\u0430\u0434\u0430\u043D\u0438\u0438.",
    priceStardust: 450,
    previewColor: "#FF007F",
    accentColor: "#9D4EDD",
    iconSymbol: "\u{1F4AB}"
  },
  {
    id: "exp_supernova_ring",
    category: "explosion",
    rarity: "epic",
    nameEn: "Nova Core Ring",
    nameRu: "\u042F\u0434\u0440\u043E \u041D\u043E\u0432\u043E\u0439 \u0417\u0432\u0435\u0437\u0434\u044B",
    descEn: "Golden solar flare eruption with sparkling starburst particles.",
    descRu: "\u0417\u043E\u043B\u043E\u0442\u0430\u044F \u0441\u043E\u043B\u043D\u0435\u0447\u043D\u0430\u044F \u0432\u0441\u043F\u044B\u0448\u043A\u0430 \u0441 \u0441\u0438\u044F\u044E\u0449\u0438\u043C\u0438 \u0437\u0432\u0435\u0437\u0434\u043D\u044B\u043C\u0438 \u0438\u0441\u043A\u0440\u0430\u043C\u0438.",
    priceStardust: 1e3,
    previewColor: "#FFB703",
    accentColor: "#FB5607",
    iconSymbol: "\u{1F31F}"
  },
  {
    id: "exp_quantum_singularity",
    category: "explosion",
    rarity: "legendary",
    nameEn: "Quantum Singularity",
    nameRu: "\u041A\u0432\u0430\u043D\u0442\u043E\u0432\u0430\u044F \u0421\u0438\u043D\u0433\u0443\u043B\u044F\u0440\u043D\u043E\u0441\u0442\u044C",
    descEn: "Miniature black hole collapse with purple lightning arcs.",
    descRu: "\u041C\u0438\u043D\u0438\u0430\u0442\u044E\u0440\u043D\u044B\u0439 \u043A\u043E\u043B\u043B\u0430\u043F\u0441 \u0447\u0435\u0440\u043D\u043E\u0439 \u0434\u044B\u0440\u044B \u0441 \u043C\u043E\u043B\u043D\u0438\u0435\u043D\u043E\u0441\u043D\u044B\u043C\u0438 \u0440\u0430\u0437\u0440\u044F\u0434\u0430\u043C\u0438.",
    priceStardust: 2400,
    previewColor: "#7000FF",
    accentColor: "#00F5D4",
    iconSymbol: "\u269B\uFE0F"
  },
  {
    id: "exp_plasma_burst",
    category: "explosion",
    rarity: "common",
    nameEn: "Plasma Burst",
    nameRu: "\u041F\u043B\u0430\u0437\u043C\u0435\u043D\u043D\u044B\u0439 \u0412\u0437\u0440\u044B\u0432",
    descEn: "Standard high-energy plasma spark release.",
    descRu: "\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439 \u0432\u044B\u0431\u0440\u043E\u0441 \u0432\u044B\u0441\u043E\u043A\u043E\u044D\u043D\u0435\u0440\u0433\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043F\u043B\u0430\u0437\u043C\u0435\u043D\u043D\u044B\u0445 \u0438\u0441\u043A\u0440.",
    priceStardust: 150,
    previewColor: "#3A86FF",
    accentColor: "#8338EC",
    iconSymbol: "\u2728"
  },
  {
    id: "exp_solar_flare",
    category: "explosion",
    rarity: "rare",
    nameEn: "Solar Flash",
    nameRu: "\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u0430\u044F \u0412\u0441\u043F\u044B\u0448\u043A\u0430",
    descEn: "Bright amber flare upon impact.",
    descRu: "\u042F\u0440\u043A\u0430\u044F \u044F\u043D\u0442\u0430\u0440\u043D\u0430\u044F \u0432\u0441\u043F\u044B\u0448\u043A\u0430 \u043F\u0440\u0438 \u043F\u043E\u043F\u0430\u0434\u0430\u043D\u0438\u0438.",
    priceStardust: 400,
    previewColor: "#FFB703",
    accentColor: "#FB5607",
    iconSymbol: "\u{1F525}"
  },
  {
    id: "exp_void_implosion",
    category: "explosion",
    rarity: "epic",
    nameEn: "Void Implosion",
    nameRu: "\u0418\u043C\u043F\u043B\u043E\u0437\u0438\u044F \u0411\u0435\u0437\u0434\u043D\u044B",
    descEn: "Dark energy suction effect on target destruction.",
    descRu: "\u042D\u0444\u0444\u0435\u043A\u0442 \u0432\u0441\u0430\u0441\u044B\u0432\u0430\u043D\u0438\u044F \u0442\u0435\u043C\u043D\u043E\u0439 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u043F\u0440\u0438 \u0443\u043D\u0438\u0447\u0442\u043E\u0436\u0435\u043D\u0438\u0438 \u0446\u0435\u043B\u0438.",
    priceStardust: 1100,
    previewColor: "#7209B7",
    accentColor: "#F72585",
    iconSymbol: "\u{1F573}\uFE0F"
  },
  {
    id: "exp_hyper_nova",
    category: "explosion",
    rarity: "legendary",
    nameEn: "Hypernova Explosion",
    nameRu: "\u0413\u0438\u043F\u0435\u0440\u043D\u043E\u0432\u0430\u044F \u0412\u0437\u0440\u044B\u0432",
    descEn: "Dazzling multi-tier stellar detonation.",
    descRu: "\u041E\u0441\u043B\u0435\u043F\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043C\u043D\u043E\u0433\u043E\u0443\u0440\u043E\u0432\u043D\u0435\u0432\u044B\u0439 \u0437\u0432\u0435\u0437\u0434\u043D\u044B\u0439 \u0432\u0437\u0440\u044B\u0432.",
    priceStardust: 2500,
    previewColor: "#FF0054",
    accentColor: "#FFBE0B",
    iconSymbol: "\u2B50"
  },
  {
    id: "exp_matrix_glitch",
    category: "explosion",
    rarity: "rare",
    nameEn: "Matrix Glitch Burst",
    nameRu: "\u0413\u043B\u0438\u0442\u0447-\u0412\u0437\u0440\u044B\u0432 \u041C\u0430\u0442\u0440\u0438\u0446\u044B",
    descEn: "Digital data fragmentation explosion.",
    descRu: "\u0412\u0437\u0440\u044B\u0432 \u0441 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0435\u0439 \u0446\u0438\u0444\u0440\u043E\u0432\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445.",
    priceStardust: 500,
    previewColor: "#00FF66",
    accentColor: "#00F5D4",
    iconSymbol: "\u{1F9E9}"
  },
  {
    id: "exp_stardust_shatter",
    category: "explosion",
    rarity: "epic",
    nameEn: "Stardust Shatter",
    nameRu: "\u041E\u0441\u043A\u043E\u043B\u043A\u0438 \u0417\u0432\u0435\u0437\u0434\u043D\u043E\u0439 \u041F\u044B\u043B\u0438",
    descEn: "Crystalline shard scattering effect.",
    descRu: "\u042D\u0444\u0444\u0435\u043A\u0442 \u0440\u0430\u0437\u043B\u0435\u0442\u0430 \u043A\u0440\u0438\u0441\u0442\u0430\u043B\u043B\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043E\u0441\u043A\u043E\u043B\u043A\u043E\u0432.",
    priceStardust: 950,
    previewColor: "#4CC9F0",
    accentColor: "#4361EE",
    iconSymbol: "\u{1F48E}"
  },
  // 🖼️ PROFILE FRAMES (10 Items)
  {
    id: "frame_pilot_steel",
    category: "frame",
    rarity: "common",
    nameEn: "Cadet Alloy Frame",
    nameRu: "\u0421\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0420\u0430\u043C\u043A\u0430 \u041A\u0430\u0434\u0435\u0442\u0430",
    descEn: "Sleek dark alloy border around your pilot profile avatar.",
    descRu: "\u0421\u0442\u0440\u043E\u0433\u0430\u044F \u0440\u0430\u043C\u043A\u0430 \u0438\u0437 \u0442\u0435\u043C\u043D\u043E\u0433\u043E \u0441\u043F\u043B\u0430\u0432\u0430 \u0432\u043E\u043A\u0440\u0443\u0433 \u0430\u0432\u0430\u0442\u0430\u0440\u0430 \u043F\u0438\u043B\u043E\u0442\u0430.",
    priceStardust: 0,
    previewColor: "#4A4E69",
    accentColor: "#9A8C98",
    iconSymbol: "\u{1F5BC}\uFE0F"
  },
  {
    id: "frame_synth_neon",
    category: "frame",
    rarity: "rare",
    nameEn: "Neon Horizon Frame",
    nameRu: "\u041D\u0435\u043E\u043D\u043E\u0432\u0430\u044F \u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442-\u0420\u0430\u043C\u043A\u0430",
    descEn: "Pulsing cyan border with glowing corner neon accents.",
    descRu: "\u041F\u0443\u043B\u044C\u0441\u0438\u0440\u0443\u044E\u0449\u0438\u0439 \u0431\u0438\u0440\u044E\u0437\u043E\u0432\u044B\u0439 \u043A\u043E\u043D\u0442\u0443\u0440 \u0441 \u0430\u043A\u0446\u0435\u043D\u0442\u0430\u043C\u0438 \u043F\u043E \u0443\u0433\u043B\u0430\u043C.",
    priceStardust: 350,
    previewColor: "#00F5D4",
    accentColor: "#9D4EDD",
    iconSymbol: "\u{1F7E6}"
  },
  {
    id: "frame_cyber_gold",
    category: "frame",
    rarity: "epic",
    nameEn: "Commander Gold Frame",
    nameRu: "\u0417\u043E\u043B\u043E\u0442\u0430\u044F \u0420\u0430\u043C\u043A\u0430 \u041A\u043E\u043C\u0430\u043D\u0434\u043E\u0440\u0430",
    descEn: "Polished golden star border earned by top fleet officers.",
    descRu: "\u0417\u0430\u043A\u0430\u043B\u0451\u043D\u043D\u0430\u044F \u0437\u043E\u043B\u043E\u0442\u0430\u044F \u0440\u0430\u043C\u043A\u0430 \u0441\u043E \u0437\u0432\u0451\u0437\u0434\u043D\u044B\u043C \u0442\u0438\u0441\u043D\u0435\u043D\u0438\u0435\u043C.",
    priceStardust: 950,
    previewColor: "#FFB703",
    accentColor: "#FB5607",
    iconSymbol: "\u{1F3C5}"
  },
  {
    id: "frame_admiral_corona",
    category: "frame",
    rarity: "legendary",
    nameEn: "Admiral Plasma Aura",
    nameRu: "\u0410\u0443\u0440\u0430 \u0410\u0434\u043C\u0438\u0440\u0430\u043B\u0430 \u0424\u043B\u043E\u0442\u0430",
    descEn: "Radiant magenta plasma aura surrounding your avatar.",
    descRu: "\u0418\u0437\u043B\u0443\u0447\u0430\u044E\u0449\u0430\u044F \u043F\u043B\u0430\u0437\u043C\u0435\u043D\u043D\u0430\u044F \u0430\u0443\u0440\u0430 \u0432\u043E\u043A\u0440\u0443\u0433 \u0430\u0432\u0430\u0442\u0430\u0440\u0430 \u0430\u0434\u043C\u0438\u0440\u0430\u043B\u0430.",
    priceStardust: 2100,
    previewColor: "#FF007F",
    accentColor: "#7000FF",
    iconSymbol: "\u{1F451}"
  },
  {
    id: "frame_stellar_bronze",
    category: "frame",
    rarity: "common",
    nameEn: "Stellar Bronze Frame",
    nameRu: "\u0411\u0440\u043E\u043D\u0437\u043E\u0432\u0430\u044F \u0417\u0432\u0435\u0437\u0434\u043D\u0430\u044F \u0420\u0430\u043C\u043A\u0430",
    descEn: "Polished bronze perimeter border.",
    descRu: "\u041F\u043E\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u0431\u0440\u043E\u043D\u0437\u043E\u0432\u0430\u044F \u0440\u0430\u043C\u043A\u0430 \u043F\u0435\u0440\u0438\u043C\u0435\u0442\u0440\u0430.",
    priceStardust: 150,
    previewColor: "#CD7F32",
    accentColor: "#B08968",
    iconSymbol: "\u{1F949}"
  },
  {
    id: "frame_quantum_shield",
    category: "frame",
    rarity: "rare",
    nameEn: "Quantum Shield Frame",
    nameRu: "\u0420\u0430\u043C\u043A\u0430 \u041A\u0432\u0430\u043D\u0442\u043E\u0432\u043E\u0433\u043E \u0429\u0438\u0442\u0430",
    descEn: "Protected by an oscillating energy barrier.",
    descRu: "\u0417\u0430\u0449\u0438\u0449\u0435\u043D\u0430 \u043A\u043E\u043B\u0435\u0431\u043B\u044E\u0449\u0438\u043C\u0441\u044F \u044D\u043D\u0435\u0440\u0433\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u043C \u0431\u0430\u0440\u044C\u0435\u0440\u043E\u043C.",
    priceStardust: 400,
    previewColor: "#3A86FF",
    accentColor: "#00B4D8",
    iconSymbol: "\u{1F6E1}\uFE0F"
  },
  {
    id: "frame_void_crown",
    category: "frame",
    rarity: "epic",
    nameEn: "Void Crown Frame",
    nameRu: "\u0420\u0430\u043C\u043A\u0430 \u041A\u043E\u0440\u043E\u043D\u044B \u0411\u0435\u0437\u0434\u043D\u044B",
    descEn: "Surrounded by swirling galactic dust rings.",
    descRu: "\u041E\u043A\u0440\u0443\u0436\u0435\u043D\u0430 \u0437\u0430\u0432\u0438\u0445\u0440\u0435\u043D\u0438\u044F\u043C\u0438 \u0433\u0430\u043B\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u043F\u044B\u043B\u0438.",
    priceStardust: 1050,
    previewColor: "#7209B7",
    accentColor: "#3A0CA3",
    iconSymbol: "\u{1F30C}"
  },
  {
    id: "frame_supernova_ring",
    category: "frame",
    rarity: "legendary",
    nameEn: "Supernova Eclipse Frame",
    nameRu: "\u0420\u0430\u043C\u043A\u0430 \u0417\u0430\u0442\u043C\u0435\u043D\u0438\u044F \u0421\u0432\u0435\u0440\u0445\u043D\u043E\u0432\u043E\u0439",
    descEn: "Blazing stellar eclipse corona frame.",
    descRu: "\u041F\u044B\u043B\u0430\u044E\u0449\u0430\u044F \u043A\u043E\u0440\u043E\u043D\u0430 \u0437\u0432\u0435\u0437\u0434\u043D\u043E\u0433\u043E \u0437\u0430\u0442\u043C\u0435\u043D\u0438\u044F.",
    priceStardust: 2300,
    previewColor: "#FB5607",
    accentColor: "#FF0054",
    iconSymbol: "\u2600\uFE0F"
  },
  {
    id: "frame_matrix_terminal",
    category: "frame",
    rarity: "rare",
    nameEn: "Matrix Terminal Frame",
    nameRu: "\u0420\u0430\u043C\u043A\u0430 \u0422\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0430 \u041C\u0430\u0442\u0440\u0438\u0446\u044B",
    descEn: "Green digital border lines.",
    descRu: "\u0417\u0435\u043B\u0435\u043D\u044B\u0435 \u0446\u0438\u0444\u0440\u043E\u0432\u044B\u0435 \u043B\u0438\u043D\u0438\u0438 \u0440\u0430\u043C\u043A\u0438.",
    priceStardust: 450,
    previewColor: "#00FF66",
    accentColor: "#007200",
    iconSymbol: "\u{1F4BB}"
  },
  {
    id: "frame_plasma_crest",
    category: "frame",
    rarity: "epic",
    nameEn: "Plasma Crest Frame",
    nameRu: "\u041F\u043B\u0430\u0437\u043C\u0435\u043D\u043D\u044B\u0439 \u0413\u0440\u0435\u0431\u0435\u043D\u044C",
    descEn: "Electrified plasma corner emblems.",
    descRu: "\u042D\u043B\u0435\u043A\u0442\u0440\u0438\u0437\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0443\u0433\u043B\u043E\u0432\u044B\u0435 \u043F\u043B\u0430\u0437\u043C\u0435\u043D\u043D\u044B\u0435 \u044D\u043C\u0431\u043B\u0435\u043C\u044B.",
    priceStardust: 900,
    previewColor: "#F72585",
    accentColor: "#4CC9F0",
    iconSymbol: "\u269C\uFE0F"
  },
  // 🎨 UI THEMES (10 Items)
  {
    id: "theme_classic_purple",
    category: "theme",
    rarity: "common",
    nameEn: "Retro Synth Purple",
    nameRu: "\u041A\u043B\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0421\u0438\u043D\u0442\u0432\u0430\u0439\u0432",
    descEn: "Original 80s dark purple and neon cyan interface style.",
    descRu: "\u041E\u0440\u0438\u0433\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 80-\u0445 \u0432 \u0444\u0438\u043E\u043B\u0435\u0442\u043E\u0432\u044B\u0445 \u0438 \u043D\u0435\u043E\u043D\u043E\u0432\u044B\u0445 \u0442\u043E\u043D\u0430\u0445.",
    priceStardust: 0,
    previewColor: "#120A2E",
    accentColor: "#00F5D4",
    iconSymbol: "\u{1F7E3}"
  },
  {
    id: "theme_vapor_pink",
    category: "theme",
    rarity: "rare",
    nameEn: "Vaporwave Sunset",
    nameRu: "\u0417\u0430\u043A\u0430\u0442 \u0412\u0435\u0439\u043F\u043E\u0440\u0432\u0435\u0439\u0432",
    descEn: "Soft pastel pink and hot magenta button interface styling.",
    descRu: "\u041C\u044F\u0433\u043A\u0438\u0439 \u0441\u0442\u0438\u043B\u044C \u043A\u043D\u043E\u043F\u043E\u043A \u0438 \u043F\u0430\u043D\u0435\u043B\u0435\u0439 \u0432 \u0440\u043E\u0437\u043E\u0432\u043E-\u043C\u0430\u043B\u0438\u043D\u043E\u0432\u044B\u0445 \u0442\u043E\u043D\u0430\u0445.",
    priceStardust: 400,
    previewColor: "#2B002B",
    accentColor: "#FF007F",
    iconSymbol: "\u{1F338}"
  },
  {
    id: "theme_cyber_amber",
    category: "theme",
    rarity: "epic",
    nameEn: "Cyberpunk Amber",
    nameRu: "\u041A\u0438\u0431\u0435\u0440\u043F\u0430\u043D\u043A \u042F\u043D\u0442\u0430\u0440\u044C",
    descEn: "Industrial golden amber terminal graphics theme.",
    descRu: "\u0418\u043D\u0434\u0443\u0441\u0442\u0440\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0442\u0435\u043C\u0430 \u0431\u043E\u0440\u0442\u043E\u0432\u043E\u0433\u043E \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0430 \u0432 \u0437\u043E\u043B\u043E\u0442\u0438\u0441\u0442\u044B\u0445 \u0442\u043E\u043D\u0430\u0445.",
    priceStardust: 900,
    previewColor: "#1C1000",
    accentColor: "#FFB703",
    iconSymbol: "\u{1F7E7}"
  },
  {
    id: "theme_matrix_emerald",
    category: "theme",
    rarity: "legendary",
    nameEn: "Matrix Emerald",
    nameRu: "\u041C\u0430\u0442\u0440\u0438\u0447\u043D\u044B\u0439 \u0418\u0437\u0443\u043C\u0440\u0443\u0434",
    descEn: "Deep green code stream interface theme with phosphorescent text.",
    descRu: "\u0418\u0437\u0443\u043C\u0440\u0443\u0434\u043D\u0430\u044F \u0442\u0435\u043C\u0430 \u043F\u043E\u0442\u043E\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0445 \u0441 \u0444\u043E\u0441\u0444\u043E\u0440\u0435\u0441\u0446\u0438\u0440\u0443\u044E\u0449\u0438\u043C \u0448\u0440\u0438\u0444\u0442\u043E\u043C.",
    priceStardust: 2e3,
    previewColor: "#001A0F",
    accentColor: "#00FF66",
    iconSymbol: "\u{1F7E2}"
  },
  {
    id: "theme_stellar_blue",
    category: "theme",
    rarity: "common",
    nameEn: "Deep Stellar Blue",
    nameRu: "\u0413\u043B\u0443\u0431\u043E\u043A\u0438\u0439 \u0417\u0432\u0435\u0437\u0434\u043D\u044B\u0439 \u0421\u0438\u043D\u0438\u0439",
    descEn: "Clean naval blue interface styling.",
    descRu: "\u0427\u0438\u0441\u0442\u044B\u0439 \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0441\u0438\u043D\u0438\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441.",
    priceStardust: 200,
    previewColor: "#03045E",
    accentColor: "#00B4D8",
    iconSymbol: "\u{1F539}"
  },
  {
    id: "theme_sunset_crimson",
    category: "theme",
    rarity: "rare",
    nameEn: "Crimson Sunset",
    nameRu: "\u0411\u0430\u0433\u0440\u043E\u0432\u044B\u0439 \u0417\u0430\u043A\u0430\u0442",
    descEn: "Rich red and orange twilight interface.",
    descRu: "\u041D\u0430\u0441\u044B\u0449\u0435\u043D\u043D\u044B\u0439 \u043A\u0440\u0430\u0441\u043D\u043E-\u043E\u0440\u0430\u043D\u0436\u0435\u0432\u044B\u0439 \u0441\u0443\u043C\u0440\u0430\u0447\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441.",
    priceStardust: 450,
    previewColor: "#370617",
    accentColor: "#E5383B",
    iconSymbol: "\u{1F307}"
  },
  {
    id: "theme_void_ultraviolet",
    category: "theme",
    rarity: "epic",
    nameEn: "Void Ultraviolet",
    nameRu: "\u0423\u043B\u044C\u0442\u0440\u0430\u0444\u0438\u043E\u043B\u0435\u0442 \u0411\u0435\u0437\u0434\u043D\u044B",
    descEn: "Deep ultraviolet and neon magenta contrast.",
    descRu: "\u0413\u043B\u0443\u0431\u043E\u043A\u0438\u0439 \u0443\u043B\u044C\u0442\u0440\u0430\u0444\u0438\u043E\u043B\u0435\u0442 \u0438 \u043A\u043E\u043D\u0442\u0440\u0430\u0441\u0442\u043D\u044B\u0439 \u043D\u0435\u043E\u043D\u043E\u0432\u044B\u0439 \u043F\u0443\u0440\u043F\u0443\u0440.",
    priceStardust: 950,
    previewColor: "#10002B",
    accentColor: "#7B2CBF",
    iconSymbol: "\u{1F52E}"
  },
  {
    id: "theme_solar_gold",
    category: "theme",
    rarity: "legendary",
    nameEn: "Solar Gold Throne",
    nameRu: "\u0417\u043E\u043B\u043E\u0442\u043E\u0439 \u0422\u0440\u043E\u043D \u0421\u043E\u043B\u043D\u0446\u0430",
    descEn: "Luxurious gold and obsidian interface theme.",
    descRu: "\u0420\u043E\u0441\u043A\u043E\u0448\u043D\u0430\u044F \u0437\u043E\u043B\u043E\u0442\u0430\u044F \u0442\u0435\u043C\u0430 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0441 \u043E\u0431\u0441\u0438\u0434\u0438\u0430\u043D\u043E\u0432\u044B\u043C\u0438 \u043F\u0430\u043D\u0435\u043B\u044F\u043C\u0438.",
    priceStardust: 2100,
    previewColor: "#141000",
    accentColor: "#FFD700",
    iconSymbol: "\u{1F531}"
  },
  {
    id: "theme_neon_arcade",
    category: "theme",
    rarity: "rare",
    nameEn: "80s Arcade Neon",
    nameRu: "\u0410\u0440\u043A\u0430\u0434\u043D\u044B\u0439 \u041D\u0435\u043E\u043D 80-\u0445",
    descEn: "Vibrant arcade cabinet color palette.",
    descRu: "\u042F\u0440\u043A\u0430\u044F \u043F\u0430\u043B\u0438\u0442\u0440\u0430 \u0430\u0440\u043A\u0430\u0434\u043D\u044B\u0445 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u043E\u0432 \u043F\u0440\u043E\u0448\u043B\u043E\u0433\u043E.",
    priceStardust: 400,
    previewColor: "#0B090A",
    accentColor: "#E01A4F",
    iconSymbol: "\u{1F579}\uFE0F"
  },
  {
    id: "theme_quantum_teal",
    category: "theme",
    rarity: "epic",
    nameEn: "Quantum Teal Horizon",
    nameRu: "\u041A\u0432\u0430\u043D\u0442\u043E\u0432\u044B\u0439 \u0411\u0438\u0440\u044E\u0437\u043E\u0432\u044B\u0439 \u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442",
    descEn: "Immersive teal and cyan glow interface.",
    descRu: "\u0418\u043C\u043C\u0435\u0440\u0441\u0438\u0432\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 \u0441 \u0431\u0438\u0440\u044E\u0437\u043E\u0432\u044B\u043C \u0438 \u0433\u043E\u043B\u0443\u0431\u044B\u043C \u0441\u0432\u0435\u0447\u0435\u043D\u0438\u0435\u043C.",
    priceStardust: 1e3,
    previewColor: "#002825",
    accentColor: "#00F5D4",
    iconSymbol: "\u{1F4A7}"
  },
  // 🏷️ TITLES (10 Items)
  {
    id: "title_cadet",
    category: "title",
    rarity: "common",
    nameEn: "Space Cadet",
    nameRu: "\u041A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u041A\u0430\u0434\u0435\u0442",
    descEn: "Starting rank for budding star navigators.",
    descRu: "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0435 \u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043B\u044F \u043D\u0430\u0447\u0438\u043D\u0430\u044E\u0449\u0438\u0445 \u0437\u0432\u0435\u0437\u0434\u043E\u043F\u043B\u0430\u0432\u0430\u0442\u0435\u043B\u0435\u0439.",
    priceStardust: 0,
    previewColor: "#8D99AE",
    accentColor: "#2B2D42",
    iconSymbol: "\u{1F396}\uFE0F"
  },
  {
    id: "title_synth_master",
    category: "title",
    rarity: "rare",
    nameEn: "Synthwave Pilot",
    nameRu: "\u0421\u0438\u043D\u0442\u0432\u0435\u0439\u0432 \u041F\u0438\u043B\u043E\u0442",
    descEn: "Experienced cruiser navigating neon highways.",
    descRu: "\u041E\u043F\u044B\u0442\u043D\u044B\u0439 \u043F\u0438\u043B\u043E\u0442, \u0440\u0430\u0441\u0441\u0435\u043A\u0430\u044E\u0449\u0438\u0439 \u043D\u0435\u043E\u043D\u043E\u0432\u044B\u0435 \u043C\u0430\u0433\u0438\u0441\u0442\u0440\u0430\u043B\u0438.",
    priceStardust: 300,
    previewColor: "#00F5D4",
    accentColor: "#9D4EDD",
    iconSymbol: "\u{1F3A7}"
  },
  {
    id: "title_solar_ace",
    category: "title",
    rarity: "epic",
    nameEn: "Solar Ace",
    nameRu: "\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0439 \u0410\u0441",
    descEn: "Master of high speed target interception.",
    descRu: "\u041C\u0430\u0441\u0442\u0435\u0440 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u043D\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u0445\u0432\u0430\u0442\u0430 \u0446\u0435\u043B\u0435\u0439.",
    priceStardust: 800,
    previewColor: "#FFB703",
    accentColor: "#FB5607",
    iconSymbol: "\u2B50"
  },
  {
    id: "title_fleet_admiral",
    category: "title",
    rarity: "legendary",
    nameEn: "Fleet Admiral",
    nameRu: "\u0410\u0434\u043C\u0438\u0440\u0430\u043B \u0424\u043B\u043E\u0442\u0430",
    descEn: "Supreme commander of the orbital star armada.",
    descRu: "\u0412\u0435\u0440\u0445\u043E\u0432\u043D\u044B\u0439 \u0433\u043B\u0430\u0432\u043D\u043E\u043A\u043E\u043C\u0430\u043D\u0434\u0443\u044E\u0449\u0438\u0439 \u043E\u0440\u0431\u0438\u0442\u0430\u043B\u044C\u043D\u043E\u0439 \u0437\u0432\u0435\u0437\u0434\u043D\u043E\u0439 \u0430\u0440\u043C\u0430\u0434\u043E\u0439.",
    priceStardust: 2e3,
    previewColor: "#FF007F",
    accentColor: "#7000FF",
    iconSymbol: "\u{1F451}"
  },
  {
    id: "title_asteroid_hunter",
    category: "title",
    rarity: "common",
    nameEn: "Asteroid Hunter",
    nameRu: "\u041E\u0445\u043E\u0442\u043D\u0438\u043A \u043D\u0430 \u0410\u0441\u0442\u0435\u0440\u043E\u0438\u0434\u044B",
    descEn: "Specialized in deep space rock clearing.",
    descRu: "\u0421\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0441\u0442 \u043F\u043E \u0440\u0430\u0441\u0447\u0438\u0441\u0442\u043A\u0435 \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043E\u0431\u043B\u043E\u043C\u043A\u043E\u0432.",
    priceStardust: 150,
    previewColor: "#6C757D",
    accentColor: "#495057",
    iconSymbol: "\u2604\uFE0F"
  },
  {
    id: "title_comet_rider",
    category: "title",
    rarity: "rare",
    nameEn: "Comet Rider",
    nameRu: "\u041F\u0443\u0442\u043D\u0438\u043A \u041A\u043E\u043C\u0435\u0442",
    descEn: "Chased across solar winds and ice tails.",
    descRu: "\u041F\u0440\u043E\u043C\u0447\u0430\u043B\u0441\u044F \u0441\u043A\u0432\u043E\u0437\u044C \u0441\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0435 \u0432\u0435\u0442\u0440\u0430 \u0438 \u043B\u0435\u0434\u044F\u043D\u044B\u0435 \u0445\u0432\u043E\u0441\u0442\u044B \u043A\u043E\u043C\u0435\u0442.",
    priceStardust: 350,
    previewColor: "#4CC9F0",
    accentColor: "#4361EE",
    iconSymbol: "\u{1F320}"
  },
  {
    id: "title_void_walker",
    category: "title",
    rarity: "epic",
    nameEn: "Void Walker",
    nameRu: "\u0421\u0442\u0440\u0430\u043D\u043D\u0438\u043A \u0411\u0435\u0437\u0434\u043D\u044B",
    descEn: "Ventured into uncharted dark matter sectors.",
    descRu: "\u041E\u0441\u043C\u0435\u043B\u0438\u043B\u0441\u044F \u043F\u0440\u043E\u043D\u0438\u043A\u043D\u0443\u0442\u044C \u0432 \u043D\u0435\u0438\u0437\u0432\u0435\u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u0435\u043A\u0442\u043E\u0440\u0430 \u0442\u0435\u043C\u043D\u043E\u0439 \u043C\u0430\u0442\u0435\u0440\u0438\u0438.",
    priceStardust: 900,
    previewColor: "#560BAD",
    accentColor: "#B5179E",
    iconSymbol: "\u{1F30C}"
  },
  {
    id: "title_supernova_legend",
    category: "title",
    rarity: "legendary",
    nameEn: "Supernova Legend",
    nameRu: "\u041B\u0435\u0433\u0435\u043D\u0434\u0430 \u0421\u0432\u0435\u0440\u0445\u043D\u043E\u0432\u043E\u0439",
    descEn: "Epitome of skill across all galaxy sectors.",
    descRu: "\u0412\u043E\u043F\u043B\u043E\u0449\u0435\u043D\u0438\u0435 \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u0442\u0432\u0430 \u0432\u043E \u0432\u0441\u0435\u0445 \u0433\u0430\u043B\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0441\u0435\u043A\u0442\u043E\u0440\u0430\u0445.",
    priceStardust: 2200,
    previewColor: "#FF0054",
    accentColor: "#FFBE0B",
    iconSymbol: "\u{1F31F}"
  },
  {
    id: "title_matrix_coder",
    category: "title",
    rarity: "rare",
    nameEn: "Matrix Netrunner",
    nameRu: "\u0421\u0435\u0442\u0435\u0432\u043E\u0439 \u0425\u0430\u043A\u0435\u0440 \u041C\u0430\u0442\u0440\u0438\u0446\u044B",
    descEn: "Master of digital anomaly resolution.",
    descRu: "\u041C\u0430\u0441\u0442\u0435\u0440 \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0446\u0438\u0444\u0440\u043E\u0432\u044B\u0445 \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u0439.",
    priceStardust: 400,
    previewColor: "#00FF66",
    accentColor: "#004B23",
    iconSymbol: "\u{1F4BB}"
  },
  {
    id: "title_quantum_sage",
    category: "title",
    rarity: "epic",
    nameEn: "Quantum Sage",
    nameRu: "\u041A\u0432\u0430\u043D\u0442\u043E\u0432\u044B\u0439 \u041C\u0443\u0434\u0440\u0435\u0446",
    descEn: "Understands the fabric of spacetime tapping.",
    descRu: "\u041F\u043E\u0441\u0442\u0438\u0433 \u0442\u043A\u0430\u043D\u044C \u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u043E-\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0433\u043E \u0442\u0430\u043F\u0430.",
    priceStardust: 1e3,
    previewColor: "#7209B7",
    accentColor: "#F72585",
    iconSymbol: "\u269B\uFE0F"
  }
];

// src/shared/referrals.ts
var REFERRAL_TIERS = [
  { level: 1, requiredInvites: 1, titleEn: "Cadet Recruiter", titleRu: "\u0420\u0435\u043A\u0440\u0443\u0442\u0435\u0440 \u041A\u0430\u0434\u0435\u0442", rewardStardust: 300 },
  { level: 2, requiredInvites: 3, titleEn: "Flight Leader", titleRu: "\u041B\u0438\u0434\u0435\u0440 \u0417\u0432\u0435\u043D\u0430", rewardStardust: 1e3 },
  { level: 3, requiredInvites: 5, titleEn: "Squadron Commander", titleRu: "\u041A\u043E\u043C\u0430\u043D\u0434\u0438\u0440 \u042D\u0441\u043A\u0430\u0434\u0440\u0438\u043B\u044C\u0438", rewardStardust: 2500, rewardShipId: "ship_retro_shuttle" },
  { level: 4, requiredInvites: 10, titleEn: "Fleet Admiral", titleRu: "\u0410\u0434\u043C\u0438\u0440\u0430\u043B \u0424\u043B\u043E\u0442\u0430", rewardStardust: 5e3 }
];

// server/routes/economy.ts
var router4 = Router4();
var mockDailyClaims = /* @__PURE__ */ new Map();
function getMockDailyClaim(userId) {
  return mockDailyClaims.get(userId);
}
function getNextUtcReset() {
  const now = /* @__PURE__ */ new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  const msUntilReset = Math.max(0, nextReset.getTime() - now.getTime());
  return { nextResetAt: nextReset.toISOString(), msUntilReset };
}
router4.get("/daily/claim/status", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const { nextResetAt, msUntilReset } = getNextUtcReset();
  if (isDbActive() && pool) {
    try {
      const todayCheck = await query(
        "SELECT streak, claim_date FROM daily_claims WHERE user_id = $1 AND claim_date = $2",
        [userId, today]
      );
      const lastClaim = await query(
        "SELECT streak, claim_date FROM daily_claims WHERE user_id = $1 ORDER BY claim_date DESC LIMIT 1",
        [userId]
      );
      const claimedToday2 = todayCheck.rows.length > 0;
      const currentStreak = Number(lastClaim.rows[0]?.streak || (claimedToday2 ? 1 : 0));
      return res.json({
        success: true,
        claimedToday: claimedToday2,
        canClaim: !claimedToday2,
        streak: currentStreak,
        lastClaimDate: lastClaim.rows[0]?.claim_date ? typeof lastClaim.rows[0].claim_date === "string" ? lastClaim.rows[0].claim_date.split("T")[0] : new Date(lastClaim.rows[0].claim_date).toISOString().split("T")[0] : null,
        nextResetAt,
        msUntilReset
      });
    } catch (err) {
      console.error("Error fetching daily claim status:", err);
      return res.status(500).json({ error: "Failed to fetch daily claim status" });
    }
  }
  const mockClaim = mockDailyClaims.get(userId);
  const claimedToday = mockClaim?.lastClaimDate === today;
  return res.json({
    success: true,
    claimedToday,
    canClaim: !claimedToday,
    streak: mockClaim?.streak || 0,
    lastClaimDate: mockClaim?.lastClaimDate || null,
    nextResetAt,
    msUntilReset
  });
});
router4.post("/daily/claim", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const yesterdayDate = new Date(Date.now() - 864e5);
  const yesterday = yesterdayDate.toISOString().split("T")[0];
  const { nextResetAt, msUntilReset } = getNextUtcReset();
  if (isDbActive() && pool) {
    try {
      const result = await transaction(async (client) => {
        const uRes = await client.query(
          "SELECT has_streak_insurance FROM users WHERE id = $1 FOR UPDATE",
          [userId]
        );
        const hasInsurance = uRes.rows[0]?.has_streak_insurance || false;
        const todayCheck = await client.query(
          "SELECT 1 FROM daily_claims WHERE user_id = $1 AND claim_date = $2 FOR UPDATE",
          [userId, today]
        );
        if (todayCheck.rows.length > 0) {
          throw new Error("ALREADY_CLAIMED");
        }
        const lastRes = await client.query(
          "SELECT claim_date, streak FROM daily_claims WHERE user_id = $1 ORDER BY claim_date DESC LIMIT 1 FOR UPDATE",
          [userId]
        );
        let newStreak = 1;
        let consumedInsurance = false;
        if (lastRes.rows.length > 0) {
          const rawLast = lastRes.rows[0].claim_date;
          const lastClaimDate = typeof rawLast === "string" ? rawLast.split("T")[0] : new Date(rawLast).toISOString().split("T")[0];
          const lastStreak = Number(lastRes.rows[0].streak) || 1;
          if (lastClaimDate === yesterday) {
            newStreak = lastStreak + 1;
          } else if (lastClaimDate < yesterday) {
            if (hasInsurance) {
              newStreak = lastStreak + 1;
              consumedInsurance = true;
            } else {
              newStreak = 1;
            }
          }
        }
        if (newStreak > 30) newStreak = 30;
        let rewardStardust = 20 + newStreak * 10;
        if (newStreak % 5 === 0) rewardStardust += 150;
        if (newStreak === 30) rewardStardust = 2e3;
        await client.query(
          "INSERT INTO daily_claims (user_id, claim_date, streak) VALUES ($1, $2, $3)",
          [userId, today, newStreak]
        );
        await client.query(
          "UPDATE wallets SET stardust = stardust + $1 WHERE user_id = $2",
          [rewardStardust, userId]
        );
        if (consumedInsurance) {
          await client.query(
            "UPDATE users SET has_streak_insurance = FALSE WHERE id = $1",
            [userId]
          );
        }
        return {
          streak: newStreak,
          rewardStardust,
          hasStreakInsurance: hasInsurance && !consumedInsurance,
          claimedToday: true,
          canClaim: false,
          lastClaimDate: today,
          nextResetAt,
          msUntilReset
        };
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      if (err.message === "ALREADY_CLAIMED" || err.code === "23505") {
        return res.status(400).json({
          success: false,
          error: "ALREADY_CLAIMED",
          message: "Daily reward already claimed today.",
          claimedToday: true,
          canClaim: false,
          nextResetAt,
          msUntilReset
        });
      }
      console.error("Error claiming daily reward:", err);
      return res.status(500).json({ error: "Failed to claim daily reward." });
    }
  } else {
    if (config.nodeEnv === "production" || !config.mockModeAllowed) {
      return res.status(503).json({
        success: false,
        error: "Database unavailable in production",
        message: "Service temporarily unavailable. Database required."
      });
    }
    const mockClaim = mockDailyClaims.get(userId);
    if (mockClaim && mockClaim.lastClaimDate === today) {
      return res.status(400).json({
        success: false,
        error: "ALREADY_CLAIMED",
        message: "Daily reward already claimed today.",
        claimedToday: true,
        canClaim: false,
        streak: mockClaim.streak,
        nextResetAt,
        msUntilReset
      });
    }
    let newStreak = 1;
    if (mockClaim) {
      if (mockClaim.lastClaimDate === yesterday) {
        newStreak = Math.min(30, mockClaim.streak + 1);
      } else {
        newStreak = 1;
      }
    }
    let rewardStardust = 20 + newStreak * 10;
    if (newStreak % 5 === 0) rewardStardust += 150;
    if (newStreak === 30) rewardStardust = 2e3;
    mockDailyClaims.set(userId, { lastClaimDate: today, streak: newStreak });
    return res.json({
      success: true,
      streak: newStreak,
      rewardStardust,
      hasStreakInsurance: false,
      claimedToday: true,
      canClaim: false,
      lastClaimDate: today,
      nextResetAt,
      msUntilReset
    });
  }
});
router4.post("/achievements/claim", requireAuth, async (req, res) => {
  const parsed = claimAchievementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { achievementId } = parsed.data;
  const userId = req.user.id;
  const achievement = ACHIEVEMENTS_LIST.find((a) => a.id === achievementId);
  if (!achievement) {
    return res.status(400).json({ error: "Invalid achievement ID" });
  }
  if (isDbActive() && pool) {
    try {
      const result = await transaction(async (client) => {
        const check = await client.query(
          "SELECT 1 FROM achievements WHERE user_id = $1 AND achievement_id = $2 FOR UPDATE",
          [userId, achievementId]
        );
        if (check.rows.length > 0) {
          throw new Error("ALREADY_CLAIMED");
        }
        const rRes = await client.query(
          `SELECT COALESCE(MAX(score), 0) as max_score, 
                  COUNT(*) as total_rounds, 
                  COALESCE(MAX(max_combo), 0) as max_combo 
           FROM rounds WHERE user_id = $1 AND status = 'submitted'`,
          [userId]
        );
        const stats = rRes.rows[0];
        const dRes = await client.query(
          "SELECT COALESCE(MAX(streak), 0) as max_streak FROM daily_claims WHERE user_id = $1",
          [userId]
        );
        const maxStreak = Number(dRes.rows[0]?.max_streak || 0);
        let eligible = false;
        const target = achievement.targetValue;
        switch (achievement.id) {
          case "first_blood":
          case "rounds_5":
          case "rounds_20":
          case "rounds_50":
            eligible = Number(stats.total_rounds) >= target;
            break;
          case "score_5k":
          case "score_10k":
          case "score_15k":
            eligible = Number(stats.max_score) >= target;
            break;
          case "combo_5":
          case "combo_12":
          case "combo_20":
            eligible = Number(stats.max_combo) >= target;
            break;
          case "streak_3":
          case "streak_7":
          case "streak_14":
          case "streak_30":
            eligible = maxStreak >= target;
            break;
          default:
            eligible = Number(stats.total_rounds) >= 1;
            break;
        }
        if (!eligible) {
          throw new Error("CONDITION_NOT_MET");
        }
        await client.query(
          "INSERT INTO achievements (user_id, achievement_id) VALUES ($1, $2)",
          [userId, achievementId]
        );
        await client.query(
          "UPDATE wallets SET stardust = stardust + $1, xp = xp + $2 WHERE user_id = $3",
          [achievement.rewardStardust, achievement.rewardXp, userId]
        );
        return { rewardStardust: achievement.rewardStardust, rewardXp: achievement.rewardXp };
      });
      return res.json({ success: true, achievementId, ...result });
    } catch (err) {
      if (err.message === "ALREADY_CLAIMED" || err.code === "23505") {
        return res.status(400).json({ error: "Achievement already claimed." });
      }
      if (err.message === "CONDITION_NOT_MET") {
        return res.status(400).json({ error: "Achievement condition not fulfilled." });
      }
      console.error("Error claiming achievement:", err);
      return res.status(500).json({ error: "Failed to claim achievement." });
    }
  } else {
    if (config.nodeEnv === "production" || !config.mockModeAllowed) {
      return res.status(503).json({
        success: false,
        error: "Database unavailable in production",
        message: "Service temporarily unavailable. Database required."
      });
    }
    return res.json({
      success: true,
      achievementId,
      rewardStardust: achievement.rewardStardust,
      rewardXp: achievement.rewardXp
    });
  }
});
router4.post("/shop/buy", requireAuth, async (req, res) => {
  const parsed = buyCosmeticSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { itemId } = parsed.data;
  const userId = req.user.id;
  const item = COSMETIC_ITEMS.find((c) => c.id === itemId);
  if (!item) {
    return res.status(400).json({ error: "Item not found in catalog" });
  }
  if (isDbActive() && pool) {
    try {
      const result = await transaction(async (client) => {
        const invCheck = await client.query(
          "SELECT 1 FROM inventory WHERE user_id = $1 AND item_id = $2 FOR UPDATE",
          [userId, itemId]
        );
        if (invCheck.rows.length > 0) {
          throw new Error("ALREADY_OWNED");
        }
        const wRes = await client.query(
          "SELECT stardust FROM wallets WHERE user_id = $1 FOR UPDATE",
          [userId]
        );
        const currentStardust = Number(wRes.rows[0]?.stardust || 0);
        if (currentStardust < item.priceStardust) {
          throw new Error("INSUFFICIENT_FUNDS");
        }
        const updateRes = await client.query(
          "UPDATE wallets SET stardust = stardust - $1 WHERE user_id = $2 AND stardust >= $1 RETURNING stardust",
          [item.priceStardust, userId]
        );
        if (updateRes.rows.length === 0) {
          throw new Error("INSUFFICIENT_FUNDS");
        }
        await client.query(
          "INSERT INTO inventory (user_id, item_id, source) VALUES ($1, $2, 'shop')",
          [userId, itemId]
        );
        return { remainingStardust: Number(updateRes.rows[0].stardust) };
      });
      return res.json({ success: true, itemId, remainingStardust: result.remainingStardust });
    } catch (err) {
      if (err.message === "ALREADY_OWNED" || err.code === "23505") {
        return res.status(400).json({ error: "Item is already owned." });
      }
      if (err.message === "INSUFFICIENT_FUNDS") {
        return res.status(400).json({ error: "Insufficient Stardust balance." });
      }
      console.error("Error buying shop item:", err);
      return res.status(500).json({ error: "Failed to purchase item." });
    }
  } else {
    if (config.nodeEnv === "production" || !config.mockModeAllowed) {
      return res.status(503).json({
        success: false,
        error: "Database unavailable in production",
        message: "Service temporarily unavailable. Database required."
      });
    }
    return res.json({ success: true, itemId, remainingStardust: 100 });
  }
});
router4.post("/equip", requireAuth, async (req, res) => {
  const parsed = equipCosmeticSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { category, itemId } = parsed.data;
  const userId = req.user.id;
  const item = COSMETIC_ITEMS.find((c) => c.id === itemId && c.category === category);
  if (!item) {
    return res.status(400).json({ error: "Item not found in catalog for this category" });
  }
  if (isDbActive() && pool) {
    try {
      if (item.priceStardust > 0) {
        const invCheck = await query(
          "SELECT 1 FROM inventory WHERE user_id = $1 AND item_id = $2",
          [userId, itemId]
        );
        if (invCheck.rows.length === 0) {
          return res.status(400).json({ error: "Item is not unlocked." });
        }
      }
      await query(
        `INSERT INTO equipped (user_id, ${category}) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET ${category} = EXCLUDED.${category}`,
        [userId, itemId]
      );
      return res.json({ success: true, category, itemId });
    } catch (err) {
      console.error("Error equipping item:", err);
      return res.status(500).json({ error: "Failed to equip item." });
    }
  } else {
    if (config.nodeEnv === "production" || !config.mockModeAllowed) {
      return res.status(503).json({
        success: false,
        error: "Database unavailable in production",
        message: "Service temporarily unavailable. Database required."
      });
    }
    return res.json({ success: true, category, itemId });
  }
});
router4.post("/referrals/claim", requireAuth, async (req, res) => {
  const parsed = claimReferralTierSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { tierLevel } = parsed.data;
  const userId = req.user.id;
  const tier = REFERRAL_TIERS.find((t) => t.level === tierLevel);
  if (!tier) {
    return res.status(400).json({ error: "Invalid referral tier" });
  }
  if (isDbActive() && pool) {
    try {
      const result = await transaction(async (client) => {
        const check = await client.query(
          "SELECT 1 FROM referral_tier_claims WHERE user_id = $1 AND tier_level = $2 FOR UPDATE",
          [userId, tier.level]
        );
        if (check.rows.length > 0) {
          throw new Error("ALREADY_CLAIMED");
        }
        const refRes = await client.query(
          "SELECT COUNT(*) as count FROM referrals WHERE inviter_id = $1",
          [userId]
        );
        const totalReferrals = Number(refRes.rows[0]?.count || 0);
        if (totalReferrals < tier.requiredInvites) {
          throw new Error("NOT_ENOUGH_REFERRALS");
        }
        await client.query(
          "INSERT INTO referral_tier_claims (user_id, tier_level) VALUES ($1, $2)",
          [userId, tier.level]
        );
        await client.query(
          "UPDATE wallets SET stardust = stardust + $1 WHERE user_id = $2",
          [tier.rewardStardust, userId]
        );
        if (tier.rewardShipId) {
          await client.query(
            "INSERT INTO inventory (user_id, item_id, source) VALUES ($1, $2, 'referral') ON CONFLICT DO NOTHING",
            [userId, tier.rewardShipId]
          );
        }
        return { rewardStardust: tier.rewardStardust, rewardShipId: tier.rewardShipId };
      });
      return res.json({ success: true, tierLevel: tier.level, ...result });
    } catch (err) {
      if (err.message === "ALREADY_CLAIMED" || err.code === "23505") {
        return res.status(400).json({ error: "Referral tier already claimed." });
      }
      if (err.message === "NOT_ENOUGH_REFERRALS") {
        return res.status(400).json({ error: "Insufficient referrals for this tier." });
      }
      console.error("Error claiming referral tier:", err);
      return res.status(500).json({ error: "Failed to claim referral tier." });
    }
  } else {
    if (config.nodeEnv === "production" || !config.mockModeAllowed) {
      return res.status(503).json({
        success: false,
        error: "Database unavailable in production",
        message: "Service temporarily unavailable. Database required."
      });
    }
    return res.json({ success: true, tierLevel: tier.level, rewardStardust: tier.rewardStardust });
  }
});
var economy_default = router4;

// server/routes/auth.ts
import { Router as Router5 } from "express";
var router5 = Router5();
var mockRegisteredUsers = /* @__PURE__ */ new Map();
router5.get("/session", requireAuth, async (req, res) => {
  const user = req.user;
  let wallet = { stardust: 150, xp: 0, level: 1 };
  let equipped = {
    ship: "ship_cyber_wing",
    trail: "trail_cyan_beam",
    backdrop: "backdrop_synth_grid",
    explosion: "exp_retro_burst",
    frame: "frame_pilot_steel",
    theme: "theme_classic_purple"
  };
  let inventory = ["ship_cyber_wing", "backdrop_synth_grid"];
  let achievements = [];
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  let dailyClaimStreak = { streak: 0, lastClaimDate: "", claimedToday: false, canClaim: true };
  let referralsCount = 0;
  let hasStreakInsurance = false;
  let hideFromLeaderboard = false;
  let notificationsEnabled = true;
  let avatarUrl = void 0;
  let isRegistered = false;
  let currentUsername = user.username;
  if (isDbActive()) {
    try {
      const wRes = await query("SELECT stardust, xp, level FROM wallets WHERE user_id = $1", [user.id]);
      if (wRes.rows.length > 0) {
        wallet = {
          stardust: Number(wRes.rows[0].stardust),
          xp: Number(wRes.rows[0].xp),
          level: Number(wRes.rows[0].level)
        };
      }
      const eqRes = await query(
        "SELECT ship, trail, backdrop, explosion, frame, theme FROM equipped WHERE user_id = $1",
        [user.id]
      );
      if (eqRes.rows.length > 0) {
        const row = eqRes.rows[0];
        equipped = {
          ship: row.ship || "ship_cyber_wing",
          trail: row.trail || "trail_cyan_beam",
          backdrop: row.backdrop || "backdrop_synth_grid",
          explosion: row.explosion || "exp_retro_burst",
          frame: row.frame || "frame_pilot_steel",
          theme: row.theme || "theme_classic_purple"
        };
      }
      const invRes = await query("SELECT item_id FROM inventory WHERE user_id = $1", [user.id]);
      if (invRes.rows.length > 0) {
        inventory = invRes.rows.map((r) => String(r.item_id));
      }
      const achRes = await query("SELECT achievement_id FROM achievements WHERE user_id = $1", [user.id]);
      if (achRes.rows.length > 0) {
        achievements = achRes.rows.map((r) => String(r.achievement_id));
      }
      const claimRes = await query(
        "SELECT streak, claim_date FROM daily_claims WHERE user_id = $1 ORDER BY claim_date DESC LIMIT 1",
        [user.id]
      );
      if (claimRes.rows.length > 0) {
        const rawDate = claimRes.rows[0].claim_date;
        const lastDate = typeof rawDate === "string" ? rawDate.split("T")[0] : rawDate instanceof Date ? rawDate.toISOString().split("T")[0] : String(rawDate).split("T")[0];
        const isClaimedToday = lastDate === todayStr;
        dailyClaimStreak = {
          streak: Number(claimRes.rows[0].streak || 1),
          lastClaimDate: lastDate,
          claimedToday: isClaimedToday,
          canClaim: !isClaimedToday
        };
      }
      const refRes = await query("SELECT COUNT(*) as count FROM referrals WHERE inviter_id = $1", [user.id]);
      if (refRes.rows.length > 0) {
        referralsCount = Number(refRes.rows[0].count || 0);
      }
      const uRes = await query(
        "SELECT has_streak_insurance, hide_from_leaderboard, notifications_enabled, avatar_url, is_registered, username FROM users WHERE id = $1",
        [user.id]
      );
      if (uRes.rows.length > 0) {
        hasStreakInsurance = !!uRes.rows[0].has_streak_insurance;
        hideFromLeaderboard = !!uRes.rows[0].hide_from_leaderboard;
        notificationsEnabled = uRes.rows[0].notifications_enabled !== false;
        if (uRes.rows[0].avatar_url) avatarUrl = uRes.rows[0].avatar_url;
        if (uRes.rows[0].is_registered !== void 0) isRegistered = !!uRes.rows[0].is_registered;
        if (uRes.rows[0].username) currentUsername = uRes.rows[0].username;
      }
    } catch (err) {
      console.error("Error fetching session data from DB:", err);
    }
  }
  if (!isDbActive()) {
    const mock = getMockDailyClaim(user.id);
    if (mock) {
      const isClaimedToday = mock.lastClaimDate === todayStr;
      dailyClaimStreak = {
        streak: mock.streak,
        lastClaimDate: mock.lastClaimDate,
        claimedToday: isClaimedToday,
        canClaim: !isClaimedToday
      };
    }
    const mockUser = mockRegisteredUsers.get(user.id);
    if (mockUser) {
      if (mockUser.avatarUrl) avatarUrl = mockUser.avatarUrl;
      isRegistered = mockUser.isRegistered;
      currentUsername = mockUser.username;
    }
  }
  res.json({
    profile: {
      id: user.id,
      username: currentUsername,
      firstName: user.firstName,
      language: user.language,
      isPremium: user.isPremium,
      isAdmin: user.isAdmin,
      isDemo: !!user.isDemo,
      referralCode: `ref_${user.id}`,
      referralsCount,
      hasStreakInsurance,
      hideFromLeaderboard,
      notificationsEnabled,
      avatarUrl,
      isRegistered
    },
    wallet,
    equipped,
    inventory,
    achievements,
    dailyClaimStreak,
    authDiagnostics: {
      isTelegramValid: !user.isDemo,
      hasBotToken: Boolean(config.botToken),
      isDemo: Boolean(user.isDemo)
    }
  });
});
router5.post(["/user/nickname/check", "/user/check-nickname"], requireAuth, async (req, res) => {
  const parsed = checkNicknameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ available: false, error: parsed.error.issues[0]?.message || "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043D\u0438\u043A\u043D\u0435\u0439\u043C" });
  }
  const user = req.user;
  const target = parsed.data.nickname.trim().toLowerCase();
  if (isDbActive()) {
    try {
      const existing = await query(
        "SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2 AND is_registered = TRUE LIMIT 1",
        [target, user.id]
      );
      if (existing.rows.length > 0) {
        return res.json({ available: false, reason: "\u042D\u0442\u043E\u0442 \u043D\u0438\u043A\u043D\u0435\u0439\u043C \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439." });
      }
    } catch (err) {
      console.error("Error checking nickname in DB:", err);
    }
  } else {
    for (const [uid, record] of mockRegisteredUsers.entries()) {
      if (uid !== user.id && record.isRegistered && record.username.toLowerCase() === target) {
        return res.json({ available: false, reason: "\u042D\u0442\u043E\u0442 \u043D\u0438\u043A\u043D\u0435\u0439\u043C \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439." });
      }
    }
  }
  return res.json({ available: true });
});
router5.post("/user/register", requireAuth, async (req, res) => {
  const parsed = registerUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u043D\u0438\u043A\u043D\u0435\u0439\u043C\u0430" });
  }
  const user = req.user;
  const { nickname, avatarUrl } = parsed.data;
  const targetLower = nickname.trim().toLowerCase();
  if (isDbActive()) {
    try {
      const existing = await query(
        "SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2 AND is_registered = TRUE LIMIT 1",
        [targetLower, user.id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "\u042D\u0442\u043E\u0442 \u043D\u0438\u043A\u043D\u0435\u0439\u043C \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439." });
      }
      await query(
        `UPDATE users SET username = $1, avatar_url = COALESCE($2, avatar_url), is_registered = TRUE WHERE id = $3`,
        [nickname.trim(), avatarUrl || null, user.id]
      );
    } catch (err) {
      if (err?.code === "23505") {
        return res.status(400).json({ error: "\u042D\u0442\u043E\u0442 \u043D\u0438\u043A\u043D\u0435\u0439\u043C \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439." });
      }
      console.error("Error registering user in DB:", err);
      return res.status(500).json({ error: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0438\u043A\u043D\u0435\u0439\u043C" });
    }
  } else {
    for (const [uid, record] of mockRegisteredUsers.entries()) {
      if (uid !== user.id && record.isRegistered && record.username.toLowerCase() === targetLower) {
        return res.status(400).json({ error: "\u042D\u0442\u043E\u0442 \u043D\u0438\u043A\u043D\u0435\u0439\u043C \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439." });
      }
    }
    mockRegisteredUsers.set(user.id, {
      username: nickname.trim(),
      avatarUrl,
      isRegistered: true
    });
  }
  user.username = nickname.trim();
  return res.json({
    success: true,
    username: nickname.trim(),
    avatarUrl,
    isRegistered: true
  });
});
router5.post("/user/avatar", requireAuth, async (req, res) => {
  const parsed = updateAvatarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid avatar data" });
  }
  const user = req.user;
  const { avatarUrl } = parsed.data;
  if (isDbActive()) {
    try {
      await query("UPDATE users SET avatar_url = $1 WHERE id = $2", [avatarUrl, user.id]);
    } catch (err) {
      console.error("Error updating avatar in DB:", err);
      return res.status(500).json({ error: "Failed to update avatar" });
    }
  } else {
    const rec = mockRegisteredUsers.get(user.id) || { username: user.username, isRegistered: false };
    rec.avatarUrl = avatarUrl;
    mockRegisteredUsers.set(user.id, rec);
  }
  return res.json({ success: true, avatarUrl });
});
router5.post("/user/settings", requireAuth, async (req, res) => {
  const parsed = updateUserSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const user = req.user;
  const { hideFromLeaderboard, notificationsEnabled } = parsed.data;
  if (isDbActive()) {
    try {
      if (typeof hideFromLeaderboard === "boolean") {
        await query("UPDATE users SET hide_from_leaderboard = $1 WHERE id = $2", [hideFromLeaderboard, user.id]);
        if (hideFromLeaderboard) {
          const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          await redisZRem("leaderboard:global", String(user.id));
          await redisZRem(`leaderboard:daily:${todayStr}`, String(user.id));
        }
      }
      if (typeof notificationsEnabled === "boolean") {
        await query("UPDATE users SET notifications_enabled = $1 WHERE id = $2", [notificationsEnabled, user.id]);
      }
    } catch (err) {
      console.error("Error updating user settings in DB:", err);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  }
  res.json({
    success: true,
    hideFromLeaderboard: Boolean(hideFromLeaderboard),
    notificationsEnabled: typeof notificationsEnabled === "boolean" ? notificationsEnabled : true
  });
});
router5.post("/user/delete-account", requireAuth, async (req, res) => {
  const user = req.user;
  if (isDbActive()) {
    const result = await deleteUserAccount(user.id);
    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to delete account" });
    }
  }
  res.json({ success: true, message: "Account permanently erased" });
});
var auth_default = router5;

// server/routes/admin.ts
import { Router as Router6 } from "express";

// server/middleware/admin.ts
function requireAdmin(req, res, next) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized: Authentication required." });
    return;
  }
  const isAdmin = config.adminTelegramIds.some((adminId) => String(adminId) === String(user.id)) || Boolean(user.isAdmin);
  if (!isAdmin) {
    res.status(403).json({ error: "Access denied: Admin authorization required." });
    return;
  }
  next();
}

// server/services/audit.ts
async function logAdminAction(adminId, action, targetId, details = {}) {
  if (!isDbActive()) return;
  try {
    await query(
      `INSERT INTO audit_log (admin_id, action, target_id, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [adminId, action, targetId || null, JSON.stringify(details)]
    );
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// bot.ts
import { Bot, InlineKeyboard, InlineQueryResultBuilder } from "grammy";
import dotenv2 from "dotenv";
import crypto3 from "crypto";
dotenv2.config();
var token = config.botToken || process.env.TELEGRAM_BOT_TOKEN || "";
var bot = new Bot(token || "111111111:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
bot.catch((err) => {
  const ctx = err.ctx;
  logger.warn(`Telegram Bot error during update ${ctx?.update?.update_id || "unknown"}:`, err.error);
});
var APP_URL = (config.appUrl && !config.appUrl.includes("ais-dev-") && !config.appUrl.includes("localhost") ? config.appUrl : "") || "https://neon-orbit-omega.vercel.app";
var BOT_USERNAME = config.botUsername || process.env.BOT_USERNAME || "NeonOrbitBot";
function isRu(ctx) {
  const code = ctx.from?.language_code?.toLowerCase() || "";
  return code.startsWith("ru") || code.startsWith("be") || code.startsWith("uk");
}
bot.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const ru = isRu(ctx);
  if (userId && chatId) {
    await recordUserChat(userId, chatId);
  }
  const startParam = ctx.match;
  let text = ru ? "\u{1F680} **\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 Neon Orbit!**\n\n45-\u0441\u0435\u043A\u0443\u043D\u0434\u043D\u0430\u044F \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0440\u0435\u0442\u0440\u043E-\u0430\u0440\u043A\u0430\u0434\u0430 \u0432 \u0441\u0442\u0438\u043B\u0435 80s Synthwave. \u0422\u0430\u043F\u0430\u0439 \u043F\u043E \u0430\u0441\u0442\u0435\u0440\u043E\u0438\u0434\u0430\u043C, \u043A\u043E\u043C\u0435\u0442\u0430\u043C \u0438 \u0437\u043E\u043B\u043E\u0442\u044B\u043C \u043C\u0430\u044F\u043A\u0430\u043C, \u0440\u0430\u0437\u0433\u043E\u043D\u044F\u0439 \u043A\u043E\u043C\u0431\u043E-\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u0438 \u0438 \u0441\u0442\u0430\u0432\u044C \u0440\u0435\u043A\u043E\u0440\u0434\u044B!" : "\u{1F680} **Welcome to Neon Orbit!**\n\nThe 45-second retro synthwave space arcade clicker. Tap asteroids, comets, and golden beacons to build combo multipliers and shatter personal records!";
  if (typeof startParam === "string" && startParam.trim()) {
    if (startParam.startsWith("challenge_")) {
      const challengeId = startParam.replace("challenge_", "");
      text = ru ? `\u{1F6F8} **\u041A\u041E\u0421\u041C\u0418\u0427\u0415\u0421\u041A\u0410\u042F \u0414\u0423\u042D\u041B\u042C!**

\u041F\u0438\u043B\u043E\u0442 \u0431\u0440\u043E\u0441\u0438\u043B \u0442\u0435\u0431\u0435 \u0432\u044B\u0437\u043E\u0432 \u043D\u0430 \u0441\u0438\u0434\u0435 \`${challengeId}\`! \u0416\u043C\u0438 \u043A\u043D\u043E\u043F\u043A\u0443 \u043D\u0438\u0436\u0435, \u0447\u0442\u043E\u0431\u044B \u0432\u0437\u043B\u0435\u0442\u0435\u0442\u044C \u0438 \u043F\u043E\u0431\u0438\u0442\u044C \u0435\u0433\u043E \u0441\u0447\u0451\u0442!` : `\u{1F6F8} **COSMIC DUEL CHALLENGE!**

A pilot has challenged you on seed \`${challengeId}\`! Tap below to launch your starfighter and claim orbital supremacy!`;
    } else if (startParam.startsWith("ref_")) {
      const inviterId = startParam.replace("ref_", "");
      if (inviterId && userId && String(inviterId) !== String(userId)) {
        if (isDbActive()) {
          try {
            await query(
              `INSERT INTO referrals (inviter_id, invitee_id, rewarded_at)
               VALUES ($1, $2, NOW())
               ON CONFLICT DO NOTHING`,
              [inviterId, userId]
            );
          } catch (err) {
            logger.error("Error inserting referral from /start:", err);
          }
        }
      }
      text = ru ? `\u{1F6F8} **\u041D\u0410\u0411\u041E\u0420 \u0412 \u0417\u0412\u0401\u0417\u0414\u041D\u042B\u0419 \u0424\u041B\u041E\u0422!**

\u0422\u0435\u0431\u044F \u043F\u0440\u0438\u0433\u043B\u0430\u0441\u0438\u043B \u043F\u0438\u043B\u043E\u0442 \`${inviterId}\`! \u0417\u0430\u043F\u0443\u0441\u0442\u0438 \u0438\u0433\u0440\u0443 \u0438 \u043F\u043E\u043B\u0443\u0447\u0438 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u0431\u043E\u043D\u0443\u0441 +250 \u0417\u0432\u0451\u0437\u0434\u043D\u043E\u0439 \u043F\u044B\u043B\u0438!` : `\u{1F6F8} **STARFLEET RECRUITMENT!**

You were invited by Pilot \`${inviterId}\`! Referral logged! Launch now to claim your +250 Stardust bonus!`;
    }
  }
  const playUrl = chatId ? `${APP_URL}?chat_id=${chatId}` : APP_URL;
  const buttonText = ru ? "\u{1F3AE} \u0418\u0413\u0420\u0410\u0422\u042C \u0412 NEON ORBIT (45s)" : "\u{1F3AE} PLAY NEON ORBIT (45s)";
  const keyboard = new InlineKeyboard().webApp(buttonText, playUrl);
  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
});
bot.command("top", async (ctx) => {
  const userId = ctx.from?.id || 0;
  const chatId = ctx.chat?.id;
  const ru = isRu(ctx);
  if (userId && chatId) {
    await recordUserChat(userId, chatId);
  }
  let text = ru ? "\u{1F3C6} **\u0422\u0410\u0411\u041B\u0418\u0426\u0410 \u041B\u0418\u0414\u0415\u0420\u041E\u0412 NEON ORBIT**\n\n" : "\u{1F3C6} **NEON ORBIT CHAT LEADERBOARD**\n\n";
  if (chatId) {
    const leaderboardData = await getLeaderboard("chat", userId, { chatId });
    if (leaderboardData.entries.length === 0) {
      text += ru ? "\u0412 \u044D\u0442\u043E\u043C \u0447\u0430\u0442\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0440\u0435\u043A\u043E\u0440\u0434\u043E\u0432!\n\n\u0421\u0442\u0430\u043D\u044C \u043F\u0435\u0440\u0432\u044B\u043C \u043F\u0438\u043B\u043E\u0442\u043E\u043C, \u0441\u044B\u0433\u0440\u0430\u0439 \u0440\u0430\u0443\u043D\u0434 \u0438 \u0437\u0430\u0439\u043C\u0438 1 \u043C\u0435\u0441\u0442\u043E \u0432 \u0433\u0440\u0443\u043F\u043F\u0435!" : "No recorded scores in this chat yet!\n\nBe the first pilot to launch a round and claim top rank in this group!";
    } else {
      leaderboardData.entries.slice(0, 10).forEach((entry) => {
        const medal = entry.rank === 1 ? "\u{1F947}" : entry.rank === 2 ? "\u{1F948}" : entry.rank === 3 ? "\u{1F949}" : `${entry.rank}.`;
        const nameStr = entry.username ? `@${entry.username}` : entry.firstName;
        text += `${medal} ${nameStr} \u2014 **${entry.score.toLocaleString()}** pts (${entry.rankTitle})
`;
      });
    }
  } else {
    const globalData = await getLeaderboard("global", userId);
    globalData.entries.slice(0, 10).forEach((entry) => {
      const medal = entry.rank === 1 ? "\u{1F947}" : entry.rank === 2 ? "\u{1F948}" : entry.rank === 3 ? "\u{1F949}" : `${entry.rank}.`;
      const nameStr = entry.username ? `@${entry.username}` : entry.firstName;
      text += `${medal} ${nameStr} \u2014 **${entry.score.toLocaleString()}** pts (${entry.rankTitle})
`;
    });
  }
  const playUrl = chatId ? `${APP_URL}?chat_id=${chatId}` : APP_URL;
  const buttonText = ru ? "\u{1F3AE} \u0418\u0413\u0420\u0410\u0422\u042C \u0412 NEON ORBIT" : "\u{1F3AE} PLAY NEON ORBIT";
  const keyboard = new InlineKeyboard().webApp(buttonText, playUrl);
  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
});
bot.command("feedback", async (ctx) => {
  const ru = isRu(ctx);
  const text = ru ? "\u{1F4AC} **\u041E\u0422\u0417\u042B\u0412\u042B \u0418 \u041F\u041E\u0414\u0414\u0415\u0420\u0416\u041A\u0410**\n\n\u0421\u0442\u043E\u043B\u043A\u043D\u0443\u043B\u0438\u0441\u044C \u0441 \u0431\u0430\u0433\u043E\u043C \u0438\u043B\u0438 \u0435\u0441\u0442\u044C \u0438\u0434\u0435\u044F \u0434\u043B\u044F \u043D\u043E\u0432\u043E\u0433\u043E \u0441\u0435\u0437\u043E\u043D\u0430? \u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u043D\u0430\u0448\u0435\u043C\u0443 \u0431\u043E\u0442\u0443 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0438 \u0438\u043B\u0438 \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043E\u0442\u0437\u044B\u0432 \u0432 \u043D\u0430\u0448\u0435\u043C Telegram-\u043A\u0430\u043D\u0430\u043B\u0435!" : "\u{1F4AC} **FEEDBACK & SUPPORT**\n\nFound a bug or have an idea for a new season? Drop a message to our support bot or join our community channel!";
  await ctx.reply(text, { parse_mode: "Markdown" });
});
bot.command("delete_me", async (ctx) => {
  const userId = ctx.from?.id;
  const ru = isRu(ctx);
  if (!userId) {
    return ctx.reply(ru ? "\u274C \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0432\u0430\u0448 ID." : "\u274C Could not identify your user ID.");
  }
  const confirmText = ru ? "\u26A0\uFE0F **\u041F\u041E\u0414\u0422\u0412\u0415\u0420\u0416\u0414\u0415\u041D\u0418\u0415 \u0423\u0414\u0410\u041B\u0415\u041D\u0418\u042F \u0410\u041A\u041A\u0410\u0423\u041D\u0422\u0410**\n\n\u0412\u044B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0445\u043E\u0442\u0438\u0442\u0435 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0438 \u0431\u0435\u0437\u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043D\u043E \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u0432\u043E\u0439 \u0430\u043A\u043A\u0430\u0443\u043D\u0442, \u0440\u0435\u043A\u043E\u0440\u0434\u044B \u0438 \u0438\u0433\u0440\u043E\u0432\u0443\u044E \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0443 \u0432 Neon Orbit? \u042D\u0442\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C." : "\u26A0\uFE0F **ACCOUNT DELETION CONFIRMATION**\n\nDo you really want to permanently erase your account, records, and game statistics from Neon Orbit? This action cannot be undone.";
  const keyboard = new InlineKeyboard().text(ru ? "\u{1F5D1}\uFE0F \u0414\u0430, \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442" : "\u{1F5D1}\uFE0F Yes, delete account", `confirm_delete_${userId}`).text(ru ? "\u274C \u041E\u0442\u043C\u0435\u043D\u0430" : "\u274C Cancel", "cancel_delete");
  await ctx.reply(confirmText, {
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
});
bot.callbackQuery(/^confirm_delete_(\d+)$/, async (ctx) => {
  const match = ctx.match;
  const targetUserId = match ? Number(match[1]) : 0;
  const currentUserId = ctx.from?.id;
  const ru = isRu(ctx);
  if (!currentUserId || currentUserId !== targetUserId) {
    await ctx.answerCallbackQuery({
      text: ru ? "\u274C \u042D\u0442\u043E \u043D\u0435 \u0432\u0430\u0448 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0435!" : "\u274C This is not your deletion request!",
      show_alert: true
    });
    return;
  }
  await ctx.answerCallbackQuery();
  if (isDbActive()) {
    const result = await deleteUserAccount(targetUserId);
    if (!result.success) {
      logger.error("Error deleting account via bot:", result.error);
      await ctx.editMessageText(
        ru ? "\u274C **\u041E\u0428\u0418\u0411\u041A\u0410 \u0423\u0414\u0410\u041B\u0415\u041D\u0418\u042F**\n\n\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0438\u0437-\u0437\u0430 \u043E\u0448\u0438\u0431\u043A\u0438 \u0431\u0430\u0437\u044B \u0434\u0430\u043D\u043D\u044B\u0445. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435." : "\u274C **DELETION ERROR**\n\nFailed to delete account due to database error. Please try again later.",
        { parse_mode: "Markdown" }
      );
      return;
    }
  }
  const successText = ru ? "\u{1F5D1}\uFE0F **\u0410\u041A\u041A\u0410\u0423\u041D\u0422 \u0423\u0421\u041F\u0415\u0428\u041D\u041E \u0423\u0414\u0410\u041B\u0415\u041D**\n\n\u0412\u0441\u0435 \u0432\u0430\u0448\u0438 \u043B\u0438\u0447\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435, \u0440\u0435\u043A\u043E\u0440\u0434\u044B \u0438 \u0438\u0433\u0440\u043E\u0432\u0430\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0431\u044B\u043B\u0438 \u0441\u0442\u0435\u0440\u0442\u044B \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u0432 Neon Orbit \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u043F\u043E\u043B\u0438\u0442\u0438\u043A\u0435 \u043A\u043E\u043D\u0444\u0438\u0434\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0438." : "\u{1F5D1}\uFE0F **ACCOUNT SUCCESSFULLY DELETED**\n\nAll your personal data, records, and game stats have been permanently wiped from Neon Orbit servers in compliance with privacy guidelines.";
  await ctx.editMessageText(successText, { parse_mode: "Markdown" });
});
bot.callbackQuery("cancel_delete", async (ctx) => {
  const ru = isRu(ctx);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    ru ? "\u2705 **\u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E.** \u0412\u0430\u0448 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0432 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438." : "\u2705 **Deletion cancelled.** Your account is safe.",
    { parse_mode: "Markdown" }
  );
});
bot.command("report", async (ctx) => {
  const fromUserId = String(ctx.from?.id || "");
  const ru = isRu(ctx);
  const isAdmin = config.adminTelegramIds.some((adminId) => String(adminId) === fromUserId);
  if (!isAdmin) {
    return ctx.reply(
      ru ? "\u274C **\u0414\u043E\u0441\u0442\u0443\u043F \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D:** \u0422\u0440\u0435\u0431\u0443\u044E\u0442\u0441\u044F \u043F\u0440\u0430\u0432\u0430 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430." : "\u274C **Unauthorized:** Admin authorization required.",
      { parse_mode: "Markdown" }
    );
  }
  let dau = 0, wau = 0, rev = 0, rounds = 0, kFactor = 0, arpdau = 0;
  if (isDbActive()) {
    try {
      const mRes = await query(`SELECT COUNT(DISTINCT user_id) as cnt FROM users WHERE last_seen_at >= CURRENT_DATE`);
      dau = Number(mRes.rows[0]?.cnt || 0);
      const wRes = await query(`SELECT COUNT(DISTINCT user_id) as cnt FROM users WHERE last_seen_at >= NOW() - INTERVAL '7 days'`);
      wau = Number(wRes.rows[0]?.cnt || 0);
      const rRes = await query(`SELECT COALESCE(SUM(stars_amount), 0) as total FROM payments WHERE status = 'paid'`);
      rev = Number(rRes.rows[0]?.total || 0);
      const rndRes = await query(`SELECT COUNT(*) as cnt FROM rounds WHERE status = 'submitted'`);
      rounds = Number(rndRes.rows[0]?.cnt || 0);
      const kRes = await query(`SELECT COALESCE((SELECT COUNT(*) FROM referrals_v2 WHERE status = 'active') * 1.0 / NULLIF((SELECT COUNT(*) FROM users), 0), 0) as k`);
      kFactor = Math.round(Number(kRes.rows[0]?.k || 0) * 100) / 100;
      if (dau > 0) arpdau = Math.round(rev / dau * 100) / 100;
    } catch (err) {
      logger.error("Error in bot report command:", err);
    }
  }
  const reportText = `\u{1F4CA} **NEON ORBIT // ADMIN METRICS REPORT**

\u2022 **DAU (Daily Active Users):** \`${dau}\`
\u2022 **WAU (Weekly Active Users):** \`${wau}\`
\u2022 **Retention (D1/D7/D30):** \`N/A\`
\u2022 **Total Rounds Played:** \`${rounds}\`
\u2022 **K-Factor (Viral Coefficient):** \`${kFactor}\`
\u2022 **Stars Revenue:** \`${rev} \u2B50\`
\u2022 **ARPDAU:** \`${arpdau} \u2B50\`

\u{1F680} *System status: All hyper-drives nominal.*`;
  await ctx.reply(reportText, { parse_mode: "Markdown" });
});
bot.command("season", async (ctx) => {
  const userId = ctx.from?.id;
  let seasonInfo = "Active Season: Neon Storm\nStatus: Running (Ends in 14 days)\nRewards: Top 100 get Fleet Admiral titles & Stardust!";
  if (userId && isDbActive()) {
    try {
      const sRes = await query(`SELECT title_en, ends_at FROM seasons WHERE is_active = TRUE LIMIT 1`);
      if (sRes.rows.length > 0) {
        const s = sRes.rows[0];
        const uRes = await query(`SELECT score, season_points, rank_title FROM season_scores WHERE season_id = (SELECT id FROM seasons WHERE is_active = TRUE LIMIT 1) AND user_id = $1`, [userId]);
        const userStat = uRes.rows[0];
        if (userStat) {
          seasonInfo = `\u{1F30C} **Active Season:** \`${s.title_en}\`
\u23F3 **Ends:** \`${new Date(s.ends_at).toLocaleDateString()}\`

\u{1F3C6} **Your Season Stats:**
\u2022 **Score:** \`${userStat.score}\`
\u2022 **Season Points:** \`${userStat.season_points}\`
\u2022 **Rank Title:** \`${userStat.rank_title}\``;
        } else {
          seasonInfo = `\u{1F30C} **Active Season:** \`${s.title_en}\`
\u23F3 **Ends:** \`${new Date(s.ends_at).toLocaleDateString()}\`

Play rounds in the app to join the season leaderboard!`;
        }
      }
    } catch (err) {
      logger.error("Error in /season command:", err);
    }
  }
  const keyboard = new InlineKeyboard().webApp("\u{1F680} Open Season Pass", APP_URL);
  await ctx.reply(seasonInfo, { parse_mode: "Markdown", reply_markup: keyboard });
});
bot.command("help", async (ctx) => {
  const ru = isRu(ctx);
  const helpText = ru ? `\u{1F3AE} **\u0413\u0430\u0439\u0434 \u0434\u043B\u044F \u043F\u0438\u043B\u043E\u0442\u043E\u0432 Neon Orbit**

\u2022 **\u0426\u0435\u043B\u044C:** \u0422\u0430\u043F\u0430\u0439 \u043F\u043E \u0446\u0435\u043B\u044F\u043C \u0437\u0430 45 \u0441\u0435\u043A\u0443\u043D\u0434 \u0440\u0430\u0443\u043D\u0434\u0430 \u0438 \u043D\u0430\u0431\u0438\u0440\u0430\u0439 \u0440\u0435\u043A\u043E\u0440\u0434\u043D\u044B\u0435 \u043E\u0447\u043A\u0438.
\u2022 **\u0417\u043E\u043B\u043E\u0442\u044B\u0435 \u043C\u0430\u044F\u043A\u0438:** \u0414\u0430\u044E\u0442 +1,000 \u043E\u0447\u043A\u043E\u0432 \u0438 \u0437\u0430\u0440\u044F\u0436\u0430\u044E\u0442 \u0413\u0438\u043F\u0435\u0440\u0440\u0435\u0436\u0438\u043C!
\u2022 **\u041A\u0440\u0430\u0441\u043D\u044B\u0435 \u043C\u0438\u043D\u044B:** \u0421\u0431\u0438\u0432\u0430\u044E\u0442 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0438 \u0441\u0435\u0440\u0438\u044E \u043A\u043E\u043C\u0431\u043E. \u0429\u0438\u0442 \u0437\u0430\u0449\u0438\u0449\u0430\u0435\u0442 \u043A\u043E\u0440\u0430\u0431\u043B\u044C.
\u2022 **\u0417\u043E\u043B\u043E\u0442\u043E\u0439 \u0447\u0430\u0441:** \u041A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C \u0441 18:00 \u0434\u043E 19:00 UTC \u0434\u0430\u0451\u0442 \u0443\u0434\u0432\u043E\u0435\u043D\u043D\u044B\u0439 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C x2!
\u2022 **\u041A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0430 \u0438 \u0417\u0432\u0451\u0437\u0434\u044B:** \u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0439 \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u043A\u043E\u0440\u0430\u0431\u043B\u0438 \u0438 \u0441\u043A\u0438\u043D\u044B \u0437\u0430 \u0417\u0432\u0451\u0437\u0434\u043D\u0443\u044E \u043F\u044B\u043B\u044C \u0438\u043B\u0438 Telegram Stars (\u2B50).

**\u041A\u043E\u043C\u0430\u043D\u0434\u044B:**
/start \u2014 \u0417\u0430\u043F\u0443\u0441\u043A \u0438\u0433\u0440\u044B
/top \u2014 \u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u043B\u0438\u0434\u0435\u0440\u043E\u0432
/help \u2014 \u0413\u0430\u0439\u0434 \u0438 \u043F\u0440\u0430\u0432\u0438\u043B\u0430
/paysupport \u2014 \u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 \u043E\u043F\u043B\u0430\u0442 Stars
/privacy \u2014 \u041A\u043E\u043D\u0444\u0438\u0434\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C
/delete_me \u2014 \u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0445 (GDPR)` : `\u{1F3AE} **Neon Orbit Pilot Guide**

\u2022 **Objective:** Tap targets during 45-second orbital rounds to maximize high scores.
\u2022 **Golden Beacons:** Grant +1,000 PTS and charge Hypermode.
\u2022 **Mines (Red):** Reduce multiplier & streak! Active Shield protects your ship.
\u2022 **Golden Hour Surge:** Daily 18:00\u201319:00 UTC grants x2 score multiplier!
\u2022 **Cosmetics & Stars:** Purchase exclusive ships and streak shields using Stardust or Telegram Stars (XTR).

**Commands:**
/start - Launch Mini App
/top - View leaderboard
/help - Pilot guide
/paysupport - Payment support
/privacy - Privacy policy
/delete_me - Erase personal data`;
  await ctx.reply(helpText, { parse_mode: "Markdown" });
});
bot.command("notifications", async (ctx) => {
  const userId = ctx.from?.id;
  const ru = isRu(ctx);
  if (!userId || !isDbActive()) {
    await ctx.reply(ru ? "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0432 \u0438\u0433\u0440\u0435." : "Notifications are available in the game.");
    return;
  }
  const userRes = await query(`SELECT notifications_enabled FROM users WHERE id = $1`, [userId]);
  const enabled = userRes.rows[0]?.notifications_enabled ?? true;
  const text = ru ? `\u{1F514} **\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439 Neon Orbit**

\u0421\u0442\u0430\u0442\u0443\u0441: ${enabled ? "\u{1F7E2} \u0412\u043A\u043B\u044E\u0447\u0435\u043D\u044B" : "\u{1F534} \u0412\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u044B"}

\u0412\u044B \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442\u0435 \u043D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F \u043E \u0441\u0442\u0440\u0438\u043A\u0430\u0445, \u0441\u043E\u0431\u044B\u0442\u0438\u044F\u0445 \u0438 \u0440\u0435\u043A\u043E\u0440\u0434\u0430\u0445 \u0434\u0440\u0443\u0437\u0435\u0439 (\u043D\u0435 \u0431\u043E\u043B\u0435\u0435 1-2 \u0432 \u0434\u0435\u043D\u044C).` : `\u{1F514} **Neon Orbit Notification Settings**

Status: ${enabled ? "\u{1F7E2} Enabled" : "\u{1F534} Disabled"}

You receive reminders about streaks, events, and friend records (max 1-2 per day).`;
  const keyboard = new InlineKeyboard().text(
    enabled ? ru ? "\u{1F515} \u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F" : "\u{1F515} Disable Notifications" : ru ? "\u{1F514} \u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F" : "\u{1F514} Enable Notifications",
    `toggle_notif_${userId}`
  );
  await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
});
bot.callbackQuery(/toggle_notif_(\d+)/, async (ctx) => {
  const userId = Number(ctx.match?.[1]);
  if (!userId || userId !== ctx.from?.id) {
    await ctx.answerCallbackQuery({ text: "Unauthorized" });
    return;
  }
  const userRes = await query(`SELECT notifications_enabled FROM users WHERE id = $1`, [userId]);
  const current = userRes.rows[0]?.notifications_enabled ?? true;
  const next = !current;
  await query(`UPDATE users SET notifications_enabled = $1 WHERE id = $2`, [next, userId]);
  const ru = isRu(ctx);
  await ctx.answerCallbackQuery({ text: next ? "Notifications enabled" : "Notifications disabled" });
  await ctx.editMessageText(
    ru ? `\u{1F514} **\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439 Neon Orbit**

\u0421\u0442\u0430\u0442\u0443\u0441: ${next ? "\u{1F7E2} \u0412\u043A\u043B\u044E\u0447\u0435\u043D\u044B" : "\u{1F534} \u0412\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u044B"}` : `\u{1F514} **Neon Orbit Notification Settings**

Status: ${next ? "\u{1F7E2} Enabled" : "\u{1F534} Disabled"}`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text(
        next ? ru ? "\u{1F515} \u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F" : "\u{1F515} Disable Notifications" : ru ? "\u{1F514} \u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F" : "\u{1F514} Enable Notifications",
        `toggle_notif_${userId}`
      )
    }
  );
});
bot.callbackQuery(/unsub_(\d+)/, async (ctx) => {
  const userId = Number(ctx.match?.[1]);
  if (!userId) {
    await ctx.answerCallbackQuery({ text: "Invalid" });
    return;
  }
  await query(`UPDATE users SET notifications_enabled = FALSE WHERE id = $1`, [userId]);
  await ctx.answerCallbackQuery({ text: "Unsubscribed successfully" });
  await ctx.editMessageText("\u{1F515} **\u0412\u044B \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u043E\u0442\u043F\u0438\u0441\u0430\u043B\u0438\u0441\u044C \u043E\u0442 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439 Neon Orbit.**\n\n\u0412\u044B \u0432\u0441\u0435\u0433\u0434\u0430 \u043C\u043E\u0436\u0435\u0442\u0435 \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0438\u0445 \u043E\u0431\u0440\u0430\u0442\u043D\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439 /notifications.", { parse_mode: "Markdown" });
});
bot.command("paysupport", async (ctx) => {
  const userId = ctx.from?.id || "Unknown";
  const ru = isRu(ctx);
  const supportText = ru ? `\u{1F4AC} **\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439 Neon Orbit (Telegram Stars)**

\u041F\u043E \u043B\u044E\u0431\u044B\u043C \u0432\u043E\u043F\u0440\u043E\u0441\u0430\u043C, \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430\u043C \u0438\u043B\u0438 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430\u043C \u0441 \u043F\u043E\u043A\u0443\u043F\u043A\u0430\u043C\u0438 \u0437\u0430 Telegram Stars (\u2B50 XTR) \u043E\u0431\u0440\u0430\u0449\u0430\u0439\u0442\u0435\u0441\u044C:

\u2022 **\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 Telegram:** @NeonOrbitSupport
\u2022 **Email:** support@neonorbit.app
\u2022 **\u0412\u0430\u0448 User ID:** \`${userId}\`

\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0443\u043A\u0430\u0436\u0438\u0442\u0435 Telegram Payment Charge ID \u043F\u0440\u0438 \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0438.` : `\u{1F4AC} **Neon Orbit Payment & Stars Support**

For any questions, refund requests, or issues regarding Telegram Stars (XTR) purchases, please contact our support team:

\u2022 **Support Telegram:** @NeonOrbitSupport
\u2022 **Email:** support@neonorbit.app
\u2022 **Your User ID:** \`${userId}\`

Please include your Telegram payment charge ID when requesting assistance.`;
  await ctx.reply(supportText, { parse_mode: "Markdown" });
});
bot.command("privacy", async (ctx) => {
  const ru = isRu(ctx);
  const text = ru ? `\u{1F512} **\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043A\u043E\u043D\u0444\u0438\u0434\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0438 Neon Orbit**

\u2022 \u041C\u044B \u0445\u0440\u0430\u043D\u0438\u043C \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u044B\u0435 Telegram (ID \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F, \u044E\u0437\u0435\u0440\u043D\u0435\u0439\u043C, \u0438\u043C\u044F), \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u044B\u0435 \u0434\u043B\u044F \u0438\u0433\u0440\u043E\u0432\u043E\u0433\u043E \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0430, \u0440\u0435\u0439\u0442\u0438\u043D\u0433\u0430 \u0438 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044F.
\u2022 \u0412\u044B \u043C\u043E\u0436\u0435\u0442\u0435 \u0432 \u043B\u044E\u0431\u043E\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 \u0441\u043A\u0440\u044B\u0442\u044C \u0441\u0435\u0431\u044F \u0438\u0437 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u044B\u0445 \u0440\u0435\u0439\u0442\u0438\u043D\u0433\u043E\u0432 \u0432 \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0438\u0433\u0440\u044B.
\u2022 \u041F\u043B\u0430\u0442\u0435\u0436\u0438 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E \u043F\u0440\u043E\u0432\u043E\u0434\u044F\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u0448\u043B\u044E\u0437 Telegram Stars (XTR).
\u2022 \u0414\u043B\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F \u0432\u0441\u0435\u0445 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u043E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u0443 \`/delete_me\`.` : `\u{1F512} **Neon Orbit Privacy Policy**

\u2022 We store Telegram metadata (user ID, username, first name) required for gameplay, rankings, and inventory.
\u2022 You can toggle "Hide me from leaderboards" anytime in Game Settings.
\u2022 Payments are processed via official Telegram Stars (XTR).
\u2022 To permanently erase your account and data, use \`/delete_me\`.`;
  await ctx.reply(text, { parse_mode: "Markdown" });
});
bot.on("message:text", async (ctx) => {
  const text = ctx.message?.text || "";
  if (text.startsWith("/")) return;
  const ru = isRu(ctx);
  const playUrl = ctx.chat?.id ? `${APP_URL}?chat_id=${ctx.chat.id}` : APP_URL;
  const buttonText = ru ? "\u{1F3AE} \u0418\u0413\u0420\u0410\u0422\u042C \u0412 NEON ORBIT" : "\u{1F3AE} PLAY NEON ORBIT";
  const keyboard = new InlineKeyboard().webApp(buttonText, playUrl);
  const replyText = ru ? `\u{1F6F8} **\u0413\u043E\u0442\u043E\u0432 \u043A \u0432\u0437\u043B\u0451\u0442\u0443 \u0432 Neon Orbit?**

\u041D\u0430\u0436\u043C\u0438 \u043A\u043D\u043E\u043F\u043A\u0443 \u043D\u0438\u0436\u0435, \u0447\u0442\u043E\u0431\u044B \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0438\u0433\u0440\u0443 \u0438 \u043D\u0430\u0431\u0440\u0430\u0442\u044C \u043E\u0447\u043A\u0438!` : `\u{1F6F8} **Ready to launch Neon Orbit?**

Tap the button below to start your 45-second round and shatter records!`;
  await ctx.reply(replyText, {
    parse_mode: "Markdown",
    reply_markup: keyboard
  });
});
bot.on("inline_query", async (ctx) => {
  const queryText = ctx.inlineQuery?.query || "";
  const score = queryText ? parseInt(queryText, 10) || 12400 : 12400;
  const result = InlineQueryResultBuilder.article("share_score_card", "\u{1F680} Share Neon Orbit Score Card", {
    description: `Challenge friends with high score of ${score.toLocaleString()} PTS!`,
    reply_markup: new InlineKeyboard().webApp("\u2694\uFE0F ACCEPT CHALLENGE", `${APP_URL}?challenge=${Date.now()}`)
  }).text(`\u{1F6F8} **NEON ORBIT HIGH SCORE: ${score.toLocaleString()} PTS**

Can you beat my 45-second orbital score? Tap below to launch your starfighter on the exact same target seed!`, {
    parse_mode: "Markdown"
  });
  await ctx.answerInlineQuery([result], { cache_time: 10 });
});
bot.on("pre_checkout_query", async (ctx) => {
  const preCheckout = ctx.preCheckoutQuery;
  if (!preCheckout) {
    return ctx.answerPreCheckoutQuery(false, { error_message: "Invalid pre-checkout payload" });
  }
  const rawPayload = preCheckout.invoice_payload;
  const totalAmount = preCheckout.total_amount;
  const currency = preCheckout.currency;
  const userId = ctx.from?.id;
  const correlationId = `prechk_${Date.now()}_${crypto3.randomBytes(4).toString("hex")}`;
  logger.info(`[PRE-CHECKOUT] Processing pre-checkout query for user ${userId}, currency ${currency}, amount ${totalAmount}`, { correlationId, userId });
  if (currency !== "XTR") {
    logger.warn(`[PRE-CHECKOUT REJECTED] Unsupported currency: ${currency}`, { correlationId });
    return ctx.answerPreCheckoutQuery(false, { error_message: "Invalid currency. Only Telegram Stars (XTR) accepted." });
  }
  if (!isDbActive()) {
    if (config.nodeEnv === "production" || !config.mockModeAllowed) {
      logger.error(`[PRE-CHECKOUT REJECTED] Database unavailable in production. Cannot verify order.`, { correlationId });
      return ctx.answerPreCheckoutQuery(false, { error_message: "Payment service temporarily unavailable. Please try again shortly." });
    }
  }
  try {
    let paymentId = rawPayload;
    let payloadUserId = null;
    let payloadItemId = null;
    try {
      const parsed = JSON.parse(rawPayload);
      paymentId = parsed.paymentId || rawPayload;
      payloadUserId = parsed.userId;
      payloadItemId = parsed.itemId;
    } catch {
    }
    if (!paymentId) {
      logger.warn(`[PRE-CHECKOUT REJECTED] Missing paymentId in payload`, { correlationId });
      return ctx.answerPreCheckoutQuery(false, { error_message: "Invalid payment order identification." });
    }
    if (isDbActive()) {
      const res = await query(
        `SELECT id, user_id, item_id, stars_amount, status FROM payments WHERE id = $1`,
        [paymentId]
      );
      if (res.rows.length === 0) {
        logger.warn(`[PRE-CHECKOUT REJECTED] Order ${paymentId} not found in database`, { correlationId });
        return ctx.answerPreCheckoutQuery(false, { error_message: "Payment order expired or not found." });
      }
      const payment = res.rows[0];
      if (String(payment.user_id) !== String(userId)) {
        logger.error(`[PRE-CHECKOUT SECURITY ALERT] User mismatch: order belongs to ${payment.user_id}, attempted by ${userId}`, { correlationId, orderId: paymentId });
        return ctx.answerPreCheckoutQuery(false, { error_message: "User account mismatch for payment." });
      }
      if (payment.status !== "created") {
        logger.warn(`[PRE-CHECKOUT REJECTED] Order ${paymentId} already processed (status: ${payment.status})`, { correlationId });
        if (payment.status === "paid") {
          return ctx.answerPreCheckoutQuery(false, { error_message: "This invoice has already been paid and fulfilled." });
        }
        return ctx.answerPreCheckoutQuery(false, { error_message: "Payment order is no longer valid." });
      }
      const catalogItem = getStarsCatalogItem(payment.item_id);
      if (!catalogItem) {
        logger.error(`[PRE-CHECKOUT REJECTED] Item ${payment.item_id} no longer exists in catalog`, { correlationId });
        return ctx.answerPreCheckoutQuery(false, { error_message: "Item no longer exists in catalog." });
      }
      if (catalogItem.priceStars !== totalAmount || Number(payment.stars_amount) !== totalAmount) {
        logger.error(`[PRE-CHECKOUT SECURITY ALERT] Amount mismatch: catalog=${catalogItem.priceStars}, order=${payment.stars_amount}, total=${totalAmount}`, { correlationId });
        return ctx.answerPreCheckoutQuery(false, { error_message: "Price mismatch for requested item." });
      }
    } else {
      if (payloadItemId) {
        const catalogItem = getStarsCatalogItem(payloadItemId);
        if (!catalogItem || catalogItem.priceStars !== totalAmount) {
          return ctx.answerPreCheckoutQuery(false, { error_message: "Invalid item or price mismatch." });
        }
      }
      if (payloadUserId && String(payloadUserId) !== String(userId)) {
        return ctx.answerPreCheckoutQuery(false, { error_message: "User account mismatch for payment." });
      }
    }
    logger.info(`[PRE-CHECKOUT APPROVED] Order ${paymentId} validated successfully for user ${userId}`, { correlationId });
    await ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    logger.error("[PRE_CHECKOUT EXCEPTION]", { correlationId, error: err instanceof Error ? err.message : String(err) });
    await ctx.answerPreCheckoutQuery(false, { error_message: "Internal error validating payment. Please try again." });
  }
});
bot.on("message:successful_payment", async (ctx) => {
  const payment = ctx.message?.successful_payment;
  const chargeId = payment?.telegram_payment_charge_id;
  const rawPayload = payment?.invoice_payload;
  const totalAmount = payment?.total_amount || 0;
  const currency = payment?.currency || "XTR";
  const userId = ctx.from?.id;
  const ru = isRu(ctx);
  const correlationId = `pay_${Date.now()}_${crypto3.randomBytes(4).toString("hex")}`;
  logger.info(`[PAYMENT RECEIVED] Incoming payment for user ${userId}, charge ${chargeId}, amount ${totalAmount} ${currency}`, { correlationId, chargeId });
  let paymentId = rawPayload || "";
  let payloadItemId = "";
  try {
    const parsed = JSON.parse(rawPayload || "{}");
    paymentId = parsed.paymentId || rawPayload || "";
    payloadItemId = parsed.itemId || "";
  } catch {
  }
  if (!chargeId || !paymentId) {
    logger.error(`[PAYMENT ERROR] Missing charge ID or payment ID in successful_payment`, { correlationId });
    await ctx.reply(
      ru ? `\u26A0\uFE0F **\u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435:** \u041F\u043B\u0430\u0442\u0451\u0436 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D, \u043D\u043E \u0434\u0430\u043D\u043D\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u0430 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B. \u041E\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044C \u0432 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0443 /paysupport \u0441 \u043D\u043E\u043C\u0435\u0440\u043E\u043C \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438: \`${chargeId || "N/A"}\`.` : `\u26A0\uFE0F **Notice:** Payment recorded, but order payload is missing. Please contact /paysupport with charge ID: \`${chargeId || "N/A"}\`.`,
      { parse_mode: "Markdown" }
    );
    return;
  }
  let fulfillmentResult;
  try {
    fulfillmentResult = await fulfillPayment(paymentId, chargeId, {
      expectedUserId: userId,
      expectedAmount: totalAmount,
      expectedCurrency: currency
    });
  } catch (err) {
    logger.error(`[PAYMENT EXECUTION EXCEPTION] Fulfillment threw error: ${err?.message || err}`, { correlationId, paymentId });
    fulfillmentResult = { success: false, error: err?.message || "FULFILLMENT_EXCEPTION" };
  }
  if (fulfillmentResult.success) {
    logger.info(`[PAYMENT FULFILLED] Order ${paymentId} fulfilled successfully with charge ${chargeId}`, { correlationId, alreadyPaid: fulfillmentResult.alreadyPaid });
    const confirmedText = ru ? `\u2728 **\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u043E\u0448\u043B\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E!** \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${totalAmount} Stars (\u2B50 XTR).

\u041D\u043E\u043C\u0435\u0440 \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0438\u0438: \`${chargeId}\`.
\u0422\u043E\u0432\u0430\u0440 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0440\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D! \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0438\u0433\u0440\u0443 \u0434\u043B\u044F \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0410\u043D\u0433\u0430\u0440\u0430 \u0438 \u0431\u0430\u043B\u0430\u043D\u0441\u0430 \u0417\u0432\u0451\u0437\u0434\u043D\u043E\u0439 \u043F\u044B\u043B\u0438. \u{1F680}` : `\u2728 **Payment Successful!** Received ${totalAmount} Stars (XTR).

Transaction Charge ID: \`${chargeId}\`.
Your item has been unlocked! Launch the game to view your updated Hangar and Stardust balance. \u{1F680}`;
    await ctx.reply(confirmedText, { parse_mode: "Markdown" });
  } else {
    logger.error(`[PAYMENT FULFILLMENT FAILED] Order ${paymentId} failed: ${fulfillmentResult.error}. Enqueueing reconciliation...`, { correlationId, chargeId, error: fulfillmentResult.error });
    await enqueuePaymentReconciliation(paymentId, chargeId, {
      userId,
      starsAmount: totalAmount,
      itemId: payloadItemId,
      error: fulfillmentResult.error,
      correlationId
    });
    const delayNotice = ru ? `\u23F3 **\u041F\u043B\u0430\u0442\u0451\u0436 \u043F\u043E\u043B\u0443\u0447\u0435\u043D, \u0432\u044B\u0434\u0430\u0447\u0430 \u0432 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0435!**

Telegram \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 ${totalAmount} \u2B50 (ID: \`${chargeId}\`).
\u0418\u0437-\u0437\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0438 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u0441 \u0431\u0430\u0437\u043E\u0439 \u0434\u0430\u043D\u043D\u044B\u0445 \u043D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0432 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u043E\u0447\u0435\u0440\u0435\u0434\u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F.

\u041F\u0440\u0435\u0434\u043C\u0435\u0442 \u0441\u0442\u0430\u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0432 \u0438\u0433\u0440\u0435 \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 1\u20132 \u043C\u0438\u043D\u0443\u0442. \u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0438: /paysupport.` : `\u23F3 **Payment received, delivery in progress!**

Telegram confirmed your payment of ${totalAmount} Stars (ID: \`${chargeId}\`).
Due to temporary database synchronization latency, your item is being delivered via our automatic reconciliation queue.

Your item will appear in your account within 1\u20132 minutes. For assistance, use /paysupport.`;
    await ctx.reply(delayNotice, { parse_mode: "Markdown" });
  }
});
bot.command("refund", async (ctx) => {
  const fromUserId = String(ctx.from?.id || "");
  const isAdmin = config.adminTelegramIds.some((adminId) => String(adminId) === fromUserId);
  if (!isAdmin) {
    return ctx.reply("\u274C **Unauthorized:** Admin authorization required to issue refunds.", { parse_mode: "Markdown" });
  }
  const matchStr = typeof ctx.match === "string" ? ctx.match : "";
  const [userIdStr, chargeId] = matchStr.split(" ");
  if (!userIdStr || !chargeId) {
    return ctx.reply("Usage: `/refund <user_id> <telegram_payment_charge_id>`", { parse_mode: "Markdown" });
  }
  try {
    const userId = Number(userIdStr);
    await ctx.api.refundStarPayment(userId, chargeId);
    const refundRes = await refundPayment(userId, chargeId);
    if (refundRes.success) {
      await ctx.reply(`\u2705 **Refund Successful!** Refunded charge \`${chargeId}\` for user \`${userId}\` and revoked item from inventory.`, { parse_mode: "Markdown" });
    } else {
      await ctx.reply(`\u26A0\uFE0F Telegram refund issued, but database status update failed: ${refundRes.error}`, { parse_mode: "Markdown" });
    }
  } catch (err) {
    logger.error("Refund error:", err);
    await ctx.reply(`\u274C **Refund Failed:** ${err instanceof Error ? err.message : "Unknown error"}`, { parse_mode: "Markdown" });
  }
});

// server/routes/admin.ts
var router6 = Router6();
var DEFAULT_EVENT_CONFIG = {
  id: "season_1",
  titleEn: "Season 1: Neon Storm",
  titleRu: "\u0421\u0435\u0437\u043E\u043D 1: \u041D\u0435\u043E\u043D\u043E\u0432\u044B\u0439 \u0428\u0442\u043E\u0440\u043C",
  bannerSubtitleEn: "Earn double score during active Golden Hour Surge!",
  bannerSubtitleRu: "\u041F\u043E\u043B\u0443\u0447\u0430\u0439\u0442\u0435 x2 \u043E\u0447\u043A\u043E\u0432 \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u0417\u043E\u043B\u043E\u0442\u043E\u0433\u043E \u0427\u0430\u0441\u0430!",
  eventType: "golden_hour",
  badgeLabel: "LIVE EVENT",
  bannerColor: "#00F5D4",
  isGoldenHourActive: true,
  goldenHourMultiplier: 2,
  endDateISO: "2026-12-31T23:59:59Z"
};
router6.get("/config", async (req, res) => {
  if (isDbActive()) {
    try {
      const cfgRes = await query(`SELECT value FROM app_config WHERE key = 'live_event'`);
      if (cfgRes.rows.length > 0) {
        return res.json({ config: cfgRes.rows[0].value });
      }
    } catch (err) {
      console.error("Error reading app_config from DB:", err);
    }
  }
  return res.json({ config: DEFAULT_EVENT_CONFIG });
});
router6.use("/admin", requireAuth, requireAdmin);
router6.get("/admin/metrics", async (req, res) => {
  let dau = "unavailable";
  let wau = "unavailable";
  let retentionD1 = "unavailable";
  let retentionD7 = "unavailable";
  let retentionD30 = "unavailable";
  let kFactor = "unavailable";
  let totalStarsRevenue = 0;
  let totalRoundsPlayed = 0;
  let avgRoundsPerSession = "unavailable";
  let firstTapWithin5sRate = "unavailable";
  let conversionToPaying = "unavailable";
  let arpdau = "unavailable";
  let flaggedAutoclickersCount = 0;
  let isDataAvailable = false;
  let funnel = {
    appOpen: "unavailable",
    firstTap: "unavailable",
    firstRound: "unavailable",
    secondRound: "unavailable",
    inviteSent: "unavailable"
  };
  if (isDbActive()) {
    try {
      const checkRes = await query(`SELECT (SELECT COUNT(*) FROM users) as user_count, (SELECT COUNT(*) FROM events) as event_count`);
      const userCount = Number(checkRes.rows[0]?.user_count || 0);
      const eventCount = Number(checkRes.rows[0]?.event_count || 0);
      isDataAvailable = userCount > 0 || eventCount > 0;
      if (!isDataAvailable) {
        return res.json({
          status: "unavailable",
          message: "Analytics data source is empty or unavailable",
          metrics: {
            dau: "unavailable",
            wau: "unavailable",
            retentionD1: "unavailable",
            retentionD7: "unavailable",
            retentionD30: "unavailable",
            kFactor: "unavailable",
            totalStarsRevenue: 0,
            totalRoundsPlayed: 0,
            avgRoundsPerSession: "unavailable",
            firstTapWithin5sRate: "unavailable",
            conversionToPaying: "unavailable",
            arpdau: "unavailable",
            flaggedAutoclickersCount: 0,
            funnel: {
              appOpen: "unavailable",
              firstTap: "unavailable",
              firstRound: "unavailable",
              secondRound: "unavailable",
              inviteSent: "unavailable"
            }
          }
        });
      }
      const dauRes = await query(`SELECT COUNT(DISTINCT user_id) as cnt FROM users WHERE last_seen_at >= CURRENT_DATE`);
      dau = dauRes.rows[0]?.cnt !== null ? Number(dauRes.rows[0].cnt) : "unavailable";
      const wauRes = await query(`SELECT COUNT(DISTINCT user_id) as cnt FROM users WHERE last_seen_at >= NOW() - INTERVAL '7 days'`);
      wau = wauRes.rows[0]?.cnt !== null ? Number(wauRes.rows[0].cnt) : "unavailable";
      const retRes = await query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '2 days' AND last_seen_at >= NOW() - INTERVAL '1 day' THEN id END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '2 days' THEN id END), 0) as d1,
          COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '8 days' AND last_seen_at >= NOW() - INTERVAL '7 days' THEN id END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '8 days' THEN id END), 0) as d7,
          COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '31 days' AND last_seen_at >= NOW() - INTERVAL '30 days' THEN id END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '31 days' THEN id END), 0) as d30
        FROM users
      `);
      retentionD1 = retRes.rows[0]?.d1 !== null ? Math.round(Number(retRes.rows[0].d1) * 10) / 10 : "unavailable";
      retentionD7 = retRes.rows[0]?.d7 !== null ? Math.round(Number(retRes.rows[0].d7) * 10) / 10 : "unavailable";
      retentionD30 = retRes.rows[0]?.d30 !== null ? Math.round(Number(retRes.rows[0].d30) * 10) / 10 : "unavailable";
      const kRes = await query(`
        SELECT 
          (SELECT COUNT(*) FROM referrals_v2 WHERE status = 'active') * 1.0 / NULLIF((SELECT COUNT(*) FROM users), 0) as k_factor
      `);
      kFactor = kRes.rows[0]?.k_factor !== null ? Math.round(Number(kRes.rows[0].k_factor) * 100) / 100 : "unavailable";
      const payingRes = await query(`
        SELECT 
          (SELECT COUNT(DISTINCT user_id) FROM payments WHERE status = 'paid') * 100.0 / NULLIF((SELECT COUNT(*) FROM users), 0) as conversion,
          SUM(stars_amount) as total_rev
        FROM payments WHERE status = 'paid'
      `);
      conversionToPaying = payingRes.rows[0]?.conversion !== null ? Math.round(Number(payingRes.rows[0].conversion) * 10) / 10 : "unavailable";
      totalStarsRevenue = Number(payingRes.rows[0]?.total_rev || 0);
      if (typeof dau === "number" && dau > 0 && totalStarsRevenue > 0) {
        arpdau = Math.round(totalStarsRevenue / dau * 100) / 100;
      } else {
        arpdau = "unavailable";
      }
      const roundsRes = await query(`SELECT COUNT(*) as cnt FROM rounds WHERE status = 'submitted'`);
      totalRoundsPlayed = Number(roundsRes.rows[0]?.cnt || 0);
      const avgRoundsRes = await query(`
        SELECT AVG(cnt) as avg_rounds FROM (
          SELECT user_id, COUNT(*) as cnt FROM rounds WHERE status = 'submitted' GROUP BY user_id
        ) t
      `);
      avgRoundsPerSession = avgRoundsRes.rows[0]?.avg_rounds !== null ? Math.round(Number(avgRoundsRes.rows[0].avg_rounds) * 10) / 10 : "unavailable";
      const tapRateRes = await query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN name = 'first_tap' THEN user_id END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN name = 'app_open' THEN user_id END), 0) as rate
        FROM events
      `);
      firstTapWithin5sRate = tapRateRes.rows[0]?.rate !== null ? Math.round(Number(tapRateRes.rows[0].rate) * 10) / 10 : "unavailable";
      const flagRes = await query(`SELECT COUNT(*) as cnt FROM users WHERE shadow_banned = true OR is_banned = true`);
      flaggedAutoclickersCount = Number(flagRes.rows[0]?.cnt || 0);
      const funnelRes = await query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN name = 'app_open' THEN user_id END) as app_open,
          COUNT(DISTINCT CASE WHEN name = 'first_tap' THEN user_id END) as first_tap,
          COUNT(DISTINCT CASE WHEN name = 'round_start' THEN user_id END) as first_round,
          COUNT(DISTINCT CASE WHEN name = 'invite_sent' THEN user_id END) as invite_sent
        FROM events
      `);
      const fRow = funnelRes.rows[0];
      funnel.appOpen = fRow.app_open > 0 ? Number(fRow.app_open) : "unavailable";
      funnel.firstTap = fRow.first_tap > 0 ? Number(fRow.first_tap) : "unavailable";
      funnel.firstRound = fRow.first_round > 0 ? Number(fRow.first_round) : "unavailable";
      funnel.secondRound = "unavailable";
      funnel.inviteSent = fRow.invite_sent > 0 ? Number(fRow.invite_sent) : "unavailable";
    } catch (err) {
      console.error("Error calculating admin metrics:", err);
      return res.status(500).json({ status: "error", error: "Failed to calculate metrics" });
    }
  } else {
    return res.json({
      status: "unavailable",
      message: "Database inactive",
      metrics: {
        dau: "unavailable",
        wau: "unavailable",
        retentionD1: "unavailable",
        retentionD7: "unavailable",
        retentionD30: "unavailable",
        kFactor: "unavailable",
        totalStarsRevenue: 0,
        totalRoundsPlayed: 0,
        avgRoundsPerSession: "unavailable",
        firstTapWithin5sRate: "unavailable",
        conversionToPaying: "unavailable",
        arpdau: "unavailable",
        flaggedAutoclickersCount: 0,
        funnel: {
          appOpen: "unavailable",
          firstTap: "unavailable",
          firstRound: "unavailable",
          secondRound: "unavailable",
          inviteSent: "unavailable"
        }
      }
    });
  }
  return res.json({
    status: "ok",
    metrics: {
      dau,
      wau,
      retentionD1,
      retentionD7,
      retentionD30,
      kFactor,
      totalStarsRevenue,
      totalRoundsPlayed,
      avgRoundsPerSession,
      firstTapWithin5sRate,
      conversionToPaying,
      arpdau,
      flaggedAutoclickersCount,
      funnel
    }
  });
});
router6.get("/admin/players", async (req, res) => {
  const search = String(req.query.search || "").trim();
  let players = [];
  if (isDbActive()) {
    try {
      const dbRes = await query(
        `SELECT 
           u.id,
           u.username,
           u.first_name,
           u.is_banned,
           u.shadow_banned,
           u.last_seen_at,
           COALESCE(w.level, 1) as level,
           COALESCE(w.stardust, 0) as stardust,
           COALESCE(MAX(r.score), 0) as high_score,
           COUNT(r.id) filter (where r.status = 'submitted') as total_rounds,
           COALESCE(ROUND(MAX(r.taps / GREATEST(r.duration_ms / 1000.0, 1.0))::numeric, 1), 0) as max_cps
         FROM users u
         LEFT JOIN wallets w ON u.id = w.user_id
         LEFT JOIN rounds r ON u.id = r.user_id
         WHERE ($1 = '' OR u.username ILIKE '%' || $1 || '%' OR u.first_name ILIKE '%' || $1 || '%' OR CAST(u.id AS TEXT) ILIKE '%' || $1 || '%')
         GROUP BY u.id, u.username, u.first_name, u.is_banned, u.shadow_banned, u.last_seen_at, w.level, w.stardust
         ORDER BY u.last_seen_at DESC
         LIMIT 100`,
        [search]
      );
      players = dbRes.rows.map((r) => ({
        id: String(r.id),
        username: r.username || "unknown",
        firstName: r.first_name || "Pilot",
        highScore: Number(r.high_score),
        level: Number(r.level),
        maxCps: Number(r.max_cps),
        isShadowBanned: !!r.shadow_banned,
        isBanned: !!r.is_banned,
        totalRounds: Number(r.total_rounds),
        stardust: Number(r.stardust),
        lastActiveISO: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : "Unknown"
      }));
    } catch (err) {
      console.error("Error querying admin players:", err);
    }
  }
  return res.json({ players });
});
router6.post("/admin/players/action", async (req, res) => {
  const parsed = adminPlayerActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const adminUser = req.user;
  const { userId, action } = parsed.data;
  if (isDbActive()) {
    try {
      if (action === "ban") {
        await query(`UPDATE users SET is_banned = true WHERE id = $1`, [userId]);
      } else if (action === "unban") {
        await query(`UPDATE users SET is_banned = false WHERE id = $1`, [userId]);
      } else if (action === "shadow_ban") {
        await query(`UPDATE users SET shadow_banned = true WHERE id = $1`, [userId]);
      } else if (action === "unshadow_ban") {
        await query(`UPDATE users SET shadow_banned = false WHERE id = $1`, [userId]);
      } else if (action === "reset_score") {
        await query(`UPDATE rounds SET status = 'rejected', flags = '{"reason":"admin_reset"}' WHERE user_id = $1`, [userId]);
      }
      await logAdminAction(adminUser.id, `player_${action}`, String(userId), { body: req.body });
      return res.json({ success: true, userId, action });
    } catch (err) {
      console.error("Error performing player admin action:", err);
      return res.status(500).json({ error: "Failed to perform action" });
    }
  }
  return res.json({ success: true, userId, action });
});
router6.get("/admin/payments", async (req, res) => {
  let payments = [];
  if (isDbActive()) {
    try {
      const pRes = await query(`
        SELECT 
          p.id,
          p.user_id,
          COALESCE(u.username, u.first_name, 'Pilot') as username,
          p.item_id,
          p.stars_amount,
          p.telegram_payment_charge_id,
          p.status,
          p.created_at
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 100
      `);
      payments = pRes.rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        username: r.username,
        itemId: r.item_id,
        amountStars: Number(r.stars_amount),
        chargeId: r.telegram_payment_charge_id || "N/A",
        status: r.status === "paid" ? "COMPLETED" : r.status === "refunded" ? "REFUNDED" : "CREATED",
        timestampISO: r.created_at ? new Date(r.created_at).toISOString() : "Unknown"
      }));
    } catch (err) {
      console.error("Error fetching admin payments:", err);
    }
  }
  return res.json({ payments });
});
router6.post("/admin/payments/refund", async (req, res) => {
  const parsed = refundPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const adminUser = req.user;
  const { chargeId } = parsed.data;
  if (isDbActive()) {
    try {
      const pRes = await query(`SELECT id, user_id, telegram_payment_charge_id, status FROM payments WHERE telegram_payment_charge_id = $1 OR id = $2`, [chargeId, chargeId]);
      if (pRes.rows.length === 0) {
        return res.status(404).json({ error: "Payment record not found" });
      }
      const pRow = pRes.rows[0];
      const targetUserId = pRow.user_id;
      const targetChargeId = pRow.telegram_payment_charge_id;
      if (pRow.status === "refunded") {
        return res.json({ success: true, message: "Payment already refunded (idempotent)", result: { success: true } });
      }
      if (!targetChargeId) {
        return res.status(400).json({ error: "Payment has no Telegram charge ID associated with it. Cannot refund via provider." });
      }
      if (!bot?.api) {
        return res.status(503).json({ error: "Telegram bot API unavailable" });
      }
      try {
        await bot.api.refundStarPayment(Number(targetUserId), targetChargeId);
      } catch (providerErr) {
        console.error("Telegram provider refund refusal/error:", providerErr);
        return res.status(400).json({
          error: "TELEGRAM_PROVIDER_REFUND_REFUSED",
          message: providerErr?.message || "Telegram provider rejected the refund request."
        });
      }
      const result = await refundPayment(targetUserId, targetChargeId);
      if (!result.success) {
        return res.status(500).json({ error: "PROVIDER_CONFIRMED_LOCAL_RECONCILIATION_FAILED", details: result.error });
      }
      await logAdminAction(adminUser.id, "refund_payment", String(pRow.id), { chargeId: targetChargeId, userId: targetUserId, result });
      return res.json({ success: true, result });
    } catch (err) {
      console.error("Error issuing admin refund:", err);
      return res.status(500).json({ error: err.message || "Failed to issue refund" });
    }
  }
  return res.json({ success: true });
});
router6.get("/admin/config", async (req, res) => {
  if (isDbActive()) {
    try {
      const cfgRes = await query(`SELECT value FROM app_config WHERE key = 'live_event'`);
      if (cfgRes.rows.length > 0) {
        return res.json({ config: cfgRes.rows[0].value });
      }
    } catch (err) {
      console.error("Error fetching admin live event config:", err);
    }
  }
  if (config.mockModeAllowed) {
    return res.json({ config: DEFAULT_EVENT_CONFIG });
  }
  return res.status(503).json({ error: "Configuration unavailable" });
});
router6.post("/admin/config", async (req, res) => {
  const parsed = updateLiveConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const adminUser = req.user;
  const newConfig = parsed.data.config;
  if (isDbActive()) {
    try {
      await query(
        `INSERT INTO app_config (key, value, updated_at, updated_by)
         VALUES ('live_event', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(newConfig), adminUser.id]
      );
      await logAdminAction(adminUser.id, "update_config", "live_event", { newConfig });
      return res.json({ success: true, config: newConfig });
    } catch (err) {
      console.error("Error saving app_config to DB:", err);
      return res.status(500).json({ error: "Failed to save app_config" });
    }
  }
  return res.json({ success: true, config: newConfig });
});
router6.post("/admin/broadcast", async (req, res) => {
  const parsed = broadcastMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const adminUser = req.user;
  const { message } = parsed.data;
  let totalSent = 0;
  let totalFailed = 0;
  if (isDbActive()) {
    try {
      const usersRes = await query(`SELECT id FROM users`);
      const userIds = usersRes.rows.map((r) => Number(r.id));
      for (const recipientId of userIds) {
        if (bot?.api) {
          try {
            await bot.api.sendMessage(recipientId, message, { parse_mode: "Markdown" });
            totalSent++;
          } catch (sendErr) {
            totalFailed++;
          }
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
      }
      await logAdminAction(adminUser.id, "broadcast", void 0, { message, totalSent, totalFailed });
    } catch (err) {
      console.error("Error sending broadcast:", err);
      return res.status(500).json({ error: "Failed to send broadcast" });
    }
  }
  return res.json({ success: true, totalSent, totalFailed });
});
var admin_default = router6;

// server/routes/analytics.ts
import { Router as Router7 } from "express";
var router7 = Router7();
var MAX_ANONYMOUS_MEMORY_ENTRIES = 5e3;
var anonymousRateLimits = /* @__PURE__ */ new Map();
async function checkAnonymousRateLimit(ip) {
  try {
    const count = await redisIncrWithExpire(`ratelimit:analytics:anon:${ip}`, 60);
    return count <= 30;
  } catch {
  }
  const now = Date.now();
  const record = anonymousRateLimits.get(ip);
  if (!record || now > record.resetTime) {
    if (anonymousRateLimits.size >= MAX_ANONYMOUS_MEMORY_ENTRIES) {
      for (const [key, entry] of anonymousRateLimits.entries()) {
        if (now > entry.resetTime) {
          anonymousRateLimits.delete(key);
        }
      }
      if (anonymousRateLimits.size >= MAX_ANONYMOUS_MEMORY_ENTRIES) {
        const oldestKeys = Array.from(anonymousRateLimits.keys()).slice(0, 500);
        for (const k of oldestKeys) {
          anonymousRateLimits.delete(k);
        }
      }
    }
    anonymousRateLimits.set(ip, { count: 1, resetTime: now + 6e4 });
    return true;
  }
  if (record.count >= 30) {
    return false;
  }
  record.count++;
  return true;
}
router7.post("/analytics/events", async (req, res) => {
  const userId = req.user?.id ? String(req.user.id) : "anonymous";
  if (userId === "anonymous") {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const isAllowed = await checkAnonymousRateLimit(clientIp);
    if (!isAllowed) {
      return res.status(429).json({ error: "Rate limit exceeded for anonymous analytics" });
    }
  }
  const parsed = analyticsBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid events batch schema", details: parsed.error.issues });
  }
  const { events } = parsed.data;
  if (isDbActive()) {
    try {
      for (const ev of events) {
        if (!ev || typeof ev !== "object") {
          return res.status(400).json({ error: "Invalid event object structure" });
        }
        const eventName = String(ev.name || "").trim();
        if (!eventName || eventName.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(eventName)) {
          return res.status(400).json({ error: `Invalid or disallowed event name: ${eventName}` });
        }
        const now = Date.now();
        const evTime = ev.timestamp ? new Date(ev.timestamp).getTime() : now;
        if (isNaN(evTime) || evTime > now + 6e4 || evTime < now - 7 * 24 * 3600 * 1e3) {
          return res.status(400).json({ error: "Invalid or out-of-bounds event timestamp" });
        }
        const props = ev.props && typeof ev.props === "object" ? ev.props : {};
        const propsJson = JSON.stringify(props);
        if (propsJson.length > 4096) {
          return res.status(400).json({ error: "Event properties size exceeds 4KB limit" });
        }
        const createdAt = new Date(evTime);
        const finalUserId = userId.substring(0, 64);
        await query(
          `INSERT INTO events (user_id, name, props, created_at) VALUES ($1, $2, $3::jsonb, $4)`,
          [finalUserId, eventName, propsJson, createdAt]
        );
      }
    } catch (err) {
      console.error("Error inserting analytics events:", err);
      return res.status(500).json({ error: "Failed to record analytics events" });
    }
  } else if (config.nodeEnv === "production" || !config.mockModeAllowed) {
    return res.status(503).json({ error: "Database unavailable in production" });
  }
  return res.json({ status: "ok", count: events.length });
});
var analytics_default = router7;

// server/routes/seasons.ts
import { Router as Router8 } from "express";
import crypto4 from "crypto";

// server/services/seasons.ts
var DEFAULT_SEASON_TIERS = [
  {
    tier: 1,
    pointsRequired: 100,
    freeReward: { type: "stardust", id: "stardust", amount: 100, nameEn: "100 Stardust", nameRu: "100 \u0417\u0432\u0435\u0437\u0434\u043D\u043E\u0439 \u043F\u044B\u043B\u0438" },
    paidReward: { type: "cosmetic", id: "trail_cyan", amount: 1, nameEn: "Neon Cyan Trail", nameRu: "\u041D\u0435\u043E\u043D\u043E\u0432\u044B\u0439 \u0446\u0438\u0430\u043D \u0441\u043B\u0435\u0434" }
  },
  {
    tier: 2,
    pointsRequired: 300,
    freeReward: { type: "stardust", id: "stardust", amount: 250, nameEn: "250 Stardust", nameRu: "250 \u0417\u0432\u0435\u0437\u0434\u043D\u043E\u0439 \u043F\u044B\u043B\u0438" },
    paidReward: { type: "cosmetic", id: "ship_interceptor", amount: 1, nameEn: "Interceptor Ship", nameRu: "\u041A\u043E\u0440\u0430\u0431\u043B\u044C \u041F\u0435\u0440\u0435\u0445\u0432\u0430\u0442\u0447\u0438\u043A" }
  },
  {
    tier: 3,
    pointsRequired: 600,
    freeReward: { type: "stardust", id: "stardust", amount: 500, nameEn: "500 Stardust", nameRu: "500 \u0417\u0432\u0435\u0437\u0434\u043D\u043E\u0439 \u043F\u044B\u043B\u0438" },
    paidReward: { type: "cosmetic", id: "frame_gold", amount: 1, nameEn: "Golden Frame", nameRu: "\u0417\u043E\u043B\u043E\u0442\u0430\u044F \u0440\u0430\u043C\u043A\u0430" }
  },
  {
    tier: 4,
    pointsRequired: 1e3,
    freeReward: { type: "stardust", id: "stardust", amount: 1e3, nameEn: "1000 Stardust", nameRu: "1000 \u0417\u0432\u0435\u0437\u0434\u043D\u043E\u0439 \u043F\u044B\u043B\u0438" },
    paidReward: { type: "cosmetic", id: "trail_gold", amount: 1, nameEn: "Golden Trail", nameRu: "\u0417\u043E\u043B\u043E\u0442\u043E\u0439 \u0441\u043B\u0435\u0434" }
  },
  {
    tier: 5,
    pointsRequired: 1500,
    freeReward: { type: "stardust", id: "stardust", amount: 2e3, nameEn: "2000 Stardust", nameRu: "2000 \u0417\u0432\u0435\u0437\u0434\u043D\u043E\u0439 \u043F\u044B\u043B\u0438" },
    paidReward: { type: "cosmetic", id: "ship_cruiser", amount: 1, nameEn: "Cruiser Ship", nameRu: "\u041A\u043E\u0440\u0430\u0431\u043B\u044C \u041A\u0440\u0435\u0439\u0441\u0435\u0440" }
  }
];
async function checkAndRolloverSeasons() {
  if (!isDbActive()) return null;
  try {
    const res = await query(
      `SELECT id, title_en, title_ru, theme, starts_at, ends_at, is_active, archived, rewards
       FROM seasons WHERE is_active = TRUE LIMIT 1`
    );
    if (res.rows.length === 0) {
      const newId = "season_1";
      const now2 = /* @__PURE__ */ new Date();
      const endsAt = new Date(now2.getTime() + 14 * 864e5);
      await query(
        `INSERT INTO seasons (id, title_en, title_ru, theme, starts_at, ends_at, is_active, archived)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE)
         ON CONFLICT (id) DO UPDATE SET is_active = TRUE`,
        [newId, "Season 1: Neon Storm", "\u0421\u0435\u0437\u043E\u043D 1: \u041D\u0435\u043E\u043D\u043E\u0432\u044B\u0439 \u0428\u0442\u043E\u0440\u043C", "synthwave", now2.toISOString(), endsAt.toISOString()]
      );
      return getActiveSeason();
    }
    const currentSeason = res.rows[0];
    const endsAtDate = new Date(currentSeason.ends_at);
    const now = /* @__PURE__ */ new Date();
    if (now >= endsAtDate) {
      console.log(`Season ${currentSeason.id} has ended. Executing season rollover...`);
      await transaction(async (client) => {
        await client.query(
          `UPDATE seasons SET is_active = FALSE, archived = TRUE WHERE id = $1`,
          [currentSeason.id]
        );
        const topRes = await client.query(
          `SELECT user_id, score, rounds_played FROM season_scores WHERE season_id = $1 ORDER BY score DESC LIMIT 100`,
          [currentSeason.id]
        );
        for (let i = 0; i < topRes.rows.length; i++) {
          const row = topRes.rows[i];
          const rank = i + 1;
          const userId = row.user_id;
          let rewardDust = 500;
          let rankTitle = "Pilot";
          if (rank === 1) {
            rewardDust = 5e3;
            rankTitle = "Fleet Admiral";
            await client.query(
              `INSERT INTO inventory (user_id, item_id, source) VALUES ($1, 'frame_gold', 'season_reward') ON CONFLICT DO NOTHING`,
              [userId]
            );
          } else if (rank <= 3) {
            rewardDust = 3e3;
            rankTitle = "Commander";
            await client.query(
              `INSERT INTO inventory (user_id, item_id, source) VALUES ($1, 'frame_silver', 'season_reward') ON CONFLICT DO NOTHING`,
              [userId]
            );
          } else if (rank <= 10) {
            rewardDust = 1500;
            rankTitle = "Captain";
            await client.query(
              `INSERT INTO inventory (user_id, item_id, source) VALUES ($1, 'frame_bronze', 'season_reward') ON CONFLICT DO NOTHING`,
              [userId]
            );
          } else {
            rankTitle = "Veteran Pilot";
          }
          await client.query(
            `UPDATE wallets SET stardust = stardust + $1 WHERE user_id = $2`,
            [rewardDust, userId]
          );
          await client.query(
            `UPDATE season_scores SET rank_title = $1 WHERE season_id = $2 AND user_id = $3`,
            [rankTitle, currentSeason.id, userId]
          );
        }
        await client.query(
          `UPDATE wallets SET stardust = stardust + 200 
           FROM season_scores ss 
           WHERE wallets.user_id = ss.user_id AND ss.season_id = $1 AND ss.rounds_played >= 3`,
          [currentSeason.id]
        );
        const seasonNum = parseInt(currentSeason.id.replace("season_", ""), 10) || 1;
        const nextSeasonId = `season_${seasonNum + 1}`;
        const nextStartsAt = now;
        const nextEndsAt = new Date(now.getTime() + 14 * 864e5);
        const nextTitleEn = `Season ${seasonNum + 1}: Cyber Odyssey`;
        const nextTitleRu = `\u0421\u0435\u0437\u043E\u043D ${seasonNum + 1}: \u041A\u0438\u0431\u0435\u0440 \u041E\u0434\u0438\u0441\u0441\u0435\u044F`;
        await client.query(
          `INSERT INTO seasons (id, title_en, title_ru, theme, starts_at, ends_at, is_active, archived)
           VALUES ($1, $2, $3, 'cyberpunk', $4, $5, TRUE, FALSE)
           ON CONFLICT (id) DO UPDATE SET is_active = TRUE, starts_at = $4, ends_at = $5`,
          [nextSeasonId, nextTitleEn, nextTitleRu, nextStartsAt.toISOString(), nextEndsAt.toISOString()]
        );
      });
      console.log("Season rollover completed successfully.");
    }
    return getActiveSeason();
  } catch (err) {
    console.error("Error during season rollover:", err);
    return null;
  }
}
async function getActiveSeason() {
  if (!isDbActive()) return null;
  try {
    const res = await query(
      `SELECT id, title_en, title_ru, theme, starts_at, ends_at, is_active, archived, rewards
       FROM seasons WHERE is_active = TRUE LIMIT 1`
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      titleEn: row.title_en,
      titleRu: row.title_ru,
      theme: row.theme || "synthwave",
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isActive: row.is_active,
      archived: row.archived,
      rewards: row.rewards || {}
    };
  } catch (err) {
    console.error("Error fetching active season:", err);
    return null;
  }
}
async function getUserSeasonData(userId) {
  const season = await checkAndRolloverSeasons();
  if (!season) return null;
  try {
    const scoreRes = await query(
      `SELECT score, season_points, rounds_played, rank_title, rewards_claimed, pass_tier, updated_at
       FROM season_scores WHERE season_id = $1 AND user_id = $2`,
      [season.id, userId]
    );
    let userScore = 0;
    let seasonPoints = 0;
    let roundsPlayed = 0;
    let rankTitle = "Pilot";
    let rewardsClaimed = {};
    let passTier = "FREE";
    if (scoreRes.rows.length > 0) {
      const row = scoreRes.rows[0];
      userScore = Number(row.score) || 0;
      seasonPoints = Number(row.season_points) || 0;
      roundsPlayed = Number(row.rounds_played) || 0;
      rankTitle = row.rank_title || "Pilot";
      rewardsClaimed = row.rewards_claimed || {};
      passTier = row.pass_tier || "FREE";
    } else {
      await query(
        `INSERT INTO season_scores (season_id, user_id, score, season_points, rounds_played, rank_title, rewards_claimed, pass_tier)
         VALUES ($1, $2, 0, 0, 0, 'Pilot', '{}'::jsonb, 'FREE')
         ON CONFLICT (season_id, user_id) DO NOTHING`,
        [season.id, userId]
      );
    }
    const rankRes = await query(
      `SELECT COUNT(*) + 1 as rank FROM season_scores WHERE season_id = $1 AND score > $2`,
      [season.id, userScore]
    );
    const rank = Number(rankRes.rows[0]?.rank) || 1;
    return {
      season,
      userStats: {
        score: userScore,
        seasonPoints,
        roundsPlayed,
        rankTitle,
        rank,
        passTier,
        rewardsClaimed
      },
      tiers: DEFAULT_SEASON_TIERS
    };
  } catch (err) {
    console.error("Error fetching user season data:", err);
    return null;
  }
}

// server/routes/seasons.ts
var router8 = Router8();
router8.get("/seasons/active", requireAuth, async (req, res) => {
  const userId = req.user.id;
  if (!isDbActive()) {
    return res.status(503).json({ success: false, error: "Database inactive" });
  }
  try {
    const data = await getUserSeasonData(userId);
    if (!data) {
      return res.status(404).json({ success: false, error: "No active season found" });
    }
    res.json({
      success: true,
      season: data.season,
      userStats: data.userStats,
      tiers: data.tiers
    });
  } catch (err) {
    console.error("Error in GET /api/seasons/active:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});
router8.post("/seasons/claim", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { tierIndex, isPaid } = req.body;
  if (tierIndex === void 0 || tierIndex < 0 || tierIndex >= DEFAULT_SEASON_TIERS.length) {
    return res.status(400).json({ success: false, error: "Invalid tier index" });
  }
  if (!isDbActive()) {
    return res.status(503).json({ success: false, error: "Database inactive" });
  }
  try {
    const season = await getActiveSeason();
    if (!season) {
      return res.status(404).json({ success: false, error: "No active season" });
    }
    const tierObj = DEFAULT_SEASON_TIERS[tierIndex];
    const result = await transaction(async (client) => {
      const sRes = await client.query(
        `SELECT season_points, rewards_claimed, pass_tier FROM season_scores WHERE season_id = $1 AND user_id = $2 FOR UPDATE`,
        [season.id, userId]
      );
      if (sRes.rows.length === 0) {
        throw new Error("SEASON_NOT_STARTED_FOR_USER");
      }
      const row = sRes.rows[0];
      const seasonPoints = Number(row.season_points) || 0;
      const passTier = row.pass_tier || "FREE";
      const rewardsClaimed = row.rewards_claimed || {};
      if (seasonPoints < tierObj.pointsRequired) {
        throw new Error("INSUFFICIENT_SEASON_POINTS");
      }
      const claimKey = isPaid ? `paid_${tierIndex}` : `free_${tierIndex}`;
      if (rewardsClaimed[claimKey]) {
        throw new Error("ALREADY_CLAIMED");
      }
      if (isPaid && passTier !== "PAID") {
        throw new Error("PAID_PASS_NOT_UNLOCKED");
      }
      const reward = isPaid ? tierObj.paidReward : tierObj.freeReward;
      if (reward.type === "stardust") {
        await client.query(
          `UPDATE wallets SET stardust = stardust + $1 WHERE user_id = $2`,
          [reward.amount, userId]
        );
      } else if (reward.type === "cosmetic") {
        await client.query(
          `INSERT INTO inventory (user_id, item_id, source) VALUES ($1, $2, 'season_pass') ON CONFLICT DO NOTHING`,
          [userId, reward.id]
        );
      }
      rewardsClaimed[claimKey] = true;
      await client.query(
        `UPDATE season_scores SET rewards_claimed = $1 WHERE season_id = $2 AND user_id = $3`,
        [JSON.stringify(rewardsClaimed), season.id, userId]
      );
      return { reward, rewardsClaimed };
    });
    res.json({ success: true, reward: result.reward, rewardsClaimed: result.rewardsClaimed });
  } catch (err) {
    console.error("Error claiming season reward:", err);
    res.status(400).json({ success: false, error: err.message || "Failed to claim reward" });
  }
});
router8.post("/seasons/upgrade", requireAuth, async (req, res) => {
  const userId = req.user.id;
  if (!isDbActive()) {
    return res.status(503).json({ success: false, error: "Database inactive" });
  }
  try {
    const season = await getActiveSeason();
    if (!season) {
      return res.status(404).json({ success: false, error: "No active season" });
    }
    const catalogItem = getStarsCatalogItem("season_pass_paid");
    if (!catalogItem) {
      return res.status(400).json({ success: false, error: "Season pass item not found in catalog" });
    }
    const paymentId = crypto4.randomUUID();
    await query(
      `INSERT INTO payments (id, user_id, item_id, stars_amount, status, created_at)
       VALUES ($1, $2, $3, $4, 'created', NOW())`,
      [paymentId, userId, catalogItem.id, catalogItem.priceStars]
    );
    if (!config.botToken) {
      return res.status(400).json({ success: false, error: "TELEGRAM_BOT_TOKEN is not configured" });
    }
    const payload = JSON.stringify({ paymentId, userId, itemId: catalogItem.id });
    const tgResponse = await fetch(`https://api.telegram.org/bot${config.botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: catalogItem.titleEn,
        description: catalogItem.descEn,
        payload,
        currency: "XTR",
        prices: [{ label: catalogItem.titleEn, amount: catalogItem.priceStars }]
      })
    });
    const tgData = await tgResponse.json();
    if (!tgData.ok) {
      return res.status(400).json({ success: false, error: tgData.description || "TELEGRAM_INVOICE_ERROR" });
    }
    res.json({
      success: true,
      invoiceUrl: tgData.result,
      paymentId
    });
  } catch (err) {
    console.error("Error creating season pass invoice:", err);
    res.status(500).json({ success: false, error: err.message || "Upgrade failed" });
  }
});
router8.get("/seasons/archive", requireAuth, async (_req, res) => {
  if (!isDbActive()) {
    return res.status(503).json({ success: false, error: "Database inactive" });
  }
  try {
    const resList = await query(
      `SELECT id, title_en, title_ru, theme, starts_at, ends_at, rewards FROM seasons WHERE archived = TRUE ORDER BY ends_at DESC`
    );
    res.json({ success: true, archivedSeasons: resList.rows });
  } catch (err) {
    console.error("Error fetching archived seasons:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});
var seasons_default = router8;

// server/routes/dailyContent.ts
import { Router as Router9 } from "express";
var router9 = Router9();
router9.get("/daily/quests", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const quests = await getUserDailyQuests(userId);
    res.json({ success: true, quests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router9.post("/daily/quests/claim", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { questId } = req.body;
    if (!questId) return res.status(400).json({ success: false, error: "questId required" });
    const result = await claimQuestReward(userId, questId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router9.get("/daily/status", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const goldenHour = await getActiveGoldenHour();
    const limitedEvents = await getActiveLimitedEvents();
    const streak = await getUserStreak(userId);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    let challengeRes = await query(`SELECT * FROM daily_challenges WHERE challenge_date = $1`, [today]);
    if (challengeRes.rows.length === 0) {
      const seed = "neon_seed_" + today.replace(/-/g, "");
      await query(
        `INSERT INTO daily_challenges (challenge_date, seed, theme, modifier) VALUES ($1, $2, 'NEON_CHALLENGE', 'STANDARD') ON CONFLICT (challenge_date) DO NOTHING`,
        [today, seed]
      );
      challengeRes = await query(`SELECT * FROM daily_challenges WHERE challenge_date = $1`, [today]);
    }
    res.json({
      success: true,
      goldenHour,
      limitedEvents,
      streak,
      dailyChallenge: challengeRes.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router9.post("/daily/streak/protect", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const streakObj = await getUserStreak(userId);
    if (streakObj.streak_freezes_left <= 0) {
      return res.status(400).json({ success: false, error: "No streak freezes left. Invite a friend or use Stars." });
    }
    await query(
      `UPDATE user_streaks SET streak_freezes_left = streak_freezes_left - 1, is_protected = true WHERE user_id = $1`,
      [userId]
    );
    res.json({ success: true, message: "Streak protected for today!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
var dailyContent_default = router9;

// server/routes/viral.ts
import { Router as Router10 } from "express";

// server/services/viral.ts
import crypto5 from "crypto";
async function createChallenge(creatorId, score, combo, seed) {
  const challengeId = crypto5.randomBytes(6).toString("hex");
  if (await isDbActive()) {
    await query(
      `INSERT INTO challenges (id, creator_id, score, combo, seed) VALUES ($1, $2, $3, $4, $5)`,
      [challengeId, creatorId, score, combo, seed]
    );
  }
  return challengeId;
}
async function getChallenge(challengeId) {
  if (!await isDbActive()) return null;
  const res = await query(`SELECT * FROM challenges WHERE id = $1`, [challengeId]);
  return res.rows[0] || null;
}
async function getChatLeaderboard(chatId) {
  if (!await isDbActive()) return [];
  const res = await query(
    `SELECT user_id, username, first_name, total_score FROM chat_leaderboards WHERE chat_id = $1 ORDER BY total_score DESC LIMIT 10`,
    [chatId]
  );
  return res.rows;
}
async function getUserReferrals(userId) {
  if (!await isDbActive()) return { count: 0, referrals: [] };
  const countRes = await query(`SELECT COUNT(*) as cnt FROM referrals_v2 WHERE referrer_id = $1 AND status = 'active'`, [userId]);
  const listRes = await query(`SELECT r.referred_id, r.status, r.created_at, u.username, u.first_name FROM referrals_v2 r LEFT JOIN users u ON r.referred_id = u.id WHERE r.referrer_id = $1`, [userId]);
  return {
    count: parseInt(countRes.rows[0]?.cnt || "0"),
    referrals: listRes.rows
  };
}
async function getTeamGoal() {
  if (!await isDbActive()) {
    if (config.mockModeAllowed) {
      return { id: "goal_current_week", title_en: "Fleet Weekly Goal: 10M Score", title_ru: "\u0415\u0436\u0435\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0446\u0435\u043B\u044C \u0444\u043B\u043E\u0442\u0430: 10\u041C \u043E\u0447\u043A\u043E\u0432", target_score: 1e7, current_score: 0, completed: false };
    }
    throw new Error("DATABASE_UNAVAILABLE");
  }
  const res = await query(`SELECT * FROM team_goals ORDER BY week_start DESC LIMIT 1`);
  return res.rows[0] || null;
}
async function contributeTeamGoal(score) {
  if (!await isDbActive()) return;
  if (score <= 0 || score > 1e6) return;
  await query(`UPDATE team_goals SET current_score = current_score + $1 WHERE week_end > CURRENT_TIMESTAMP AND completed = false`, [score]);
  const goal = await getTeamGoal();
  if (goal && goal.current_score >= goal.target_score && !goal.completed) {
    await query(`UPDATE team_goals SET completed = true WHERE id = $1`, [goal.id]);
  }
}

// server/routes/viral.ts
var router10 = Router10();
router10.post("/viral/challenge", requireAuth, async (req, res) => {
  const parsed = createChallengeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  try {
    const userId = req.user.id;
    const { score, combo, seed } = parsed.data;
    const seedVal = seed !== void 0 ? String(seed) : String(Date.now());
    const challengeId = await createChallenge(userId, score, combo, Number(seedVal) || Date.now());
    res.json({ success: true, challengeId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router10.get("/viral/challenge/:id", async (req, res) => {
  try {
    const challenge = await getChallenge(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }
    res.json({ success: true, challenge });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router10.get("/viral/chat/:chatId", async (req, res) => {
  try {
    const chatId = parseInt(req.params.chatId);
    const leaderboard = await getChatLeaderboard(chatId);
    res.json({ success: true, leaderboard });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router10.post("/viral/chat", requireAuth, async (req, res) => {
  const parsed = viralChatContributionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  try {
    const userId = req.user.id;
    const user = req.user;
    const { chatId: rawChatId, roundId } = parsed.data;
    const chatId = typeof rawChatId === "string" ? parseInt(rawChatId, 10) : rawChatId;
    if (!chatId || isNaN(chatId)) return res.status(400).json({ error: "valid chatId required" });
    if (!isDbActive()) {
      return res.status(503).json({ error: "Database inactive" });
    }
    const verifiedScore = await transaction(async (client) => {
      const roundRes = await client.query(
        `SELECT id, score, status, flags FROM rounds WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [roundId, userId]
      );
      if (roundRes.rows.length === 0) {
        throw new Error("ROUND_NOT_FOUND_OR_UNAUTHORIZED");
      }
      const round = roundRes.rows[0];
      if (round.status !== "submitted") {
        throw new Error("ROUND_NOT_SUBMITTED");
      }
      const flags = round.flags || {};
      if (flags.viral_contributed) {
        throw new Error("ALREADY_CONTRIBUTED");
      }
      const scoreVal = Number(round.score || 0);
      if (scoreVal <= 0 || scoreVal > 1e6) {
        throw new Error("INVALID_SCORE");
      }
      flags.viral_contributed = true;
      await client.query(`UPDATE rounds SET flags = $1 WHERE id = $2`, [JSON.stringify(flags), roundId]);
      await client.query(
        `INSERT INTO chat_leaderboards (chat_id, user_id, username, first_name, total_score, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (chat_id, user_id) 
         DO UPDATE SET total_score = chat_leaderboards.total_score + $5, username = $3, first_name = $4, updated_at = CURRENT_TIMESTAMP`,
        [chatId, userId, user.username || "Pilot", user.firstName || "Captain", scoreVal]
      );
      return scoreVal;
    });
    await contributeTeamGoal(verifiedScore);
    res.json({ success: true, verifiedScore });
  } catch (e) {
    res.status(400).json({ error: e.message || "Failed to contribute to chat score" });
  }
});
router10.get("/viral/referrals", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await getUserReferrals(userId);
    res.json({ success: true, ...data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router10.get("/viral/team-goal", async (req, res) => {
  try {
    const goal = await getTeamGoal();
    res.json({ success: true, goal });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
var viral_default = router10;

// server/routes/notifications.ts
import { Router as Router11 } from "express";
var router11 = Router11();
router11.get("/notifications/prefs", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId || !isDbActive()) {
    return res.json({ enabled: true, quietStart: 23, quietEnd: 8, timezone: "UTC" });
  }
  try {
    const userRes = await query(`SELECT notifications_enabled FROM users WHERE id = $1`, [userId]);
    const enabled = userRes.rows[0]?.notifications_enabled ?? true;
    const prefsRes = await query(`SELECT quiet_start, quiet_end, timezone FROM notification_prefs WHERE user_id = $1`, [userId]);
    const prefs = prefsRes.rows[0] || { quiet_start: 23, quiet_end: 8, timezone: "UTC" };
    res.json({
      enabled,
      quietStart: prefs.quiet_start,
      quietEnd: prefs.quiet_end,
      timezone: prefs.timezone
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notification preferences" });
  }
});
router11.post("/notifications/prefs", requireAuth, async (req, res) => {
  const parsed = notificationPrefsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const userId = req.user?.id;
  const { enabled, quietStart, quietEnd, timezone } = parsed.data;
  if (!userId || !isDbActive()) {
    return res.json({ success: true });
  }
  try {
    if (typeof enabled === "boolean") {
      await query(`UPDATE users SET notifications_enabled = $1 WHERE id = $2`, [enabled, userId]);
    }
    await query(
      `INSERT INTO notification_prefs (user_id, quiet_start, quiet_end, timezone, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         quiet_start = COALESCE($2, notification_prefs.quiet_start),
         quiet_end = COALESCE($3, notification_prefs.quiet_end),
         timezone = COALESCE($4, notification_prefs.timezone),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, quietStart, quietEnd, timezone || "UTC"]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
});
var notifications_default = router11;

// server/routes/metrics.ts
import { Router as Router12 } from "express";

// server/services/queue.ts
var BackgroundQueue = class {
  constructor() {
    this.queue = [];
    this.processing = false;
  }
  async add(name, data, maxAttempts = 3) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const job = {
      id: jobId,
      name,
      data,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now()
    };
    this.queue.push(job);
    logger.info(`[Queue] Added job ${jobId} (${name})`);
    this.processQueue().catch((err) => logger.error("[Queue] Error processing queue:", err));
    return jobId;
  }
  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      job.attempts++;
      try {
        logger.info(`[Queue] Processing job ${job.id} (${job.name}), attempt ${job.attempts}/${job.maxAttempts}`);
        await this.executeJob(job);
        logger.info(`[Queue] Completed job ${job.id} (${job.name}) successfully.`);
      } catch (err) {
        job.failedReason = err.message;
        logger.error(`[Queue] Job ${job.id} (${job.name}) failed on attempt ${job.attempts}:`, err);
        if (job.attempts < job.maxAttempts) {
          const delay = Math.pow(2, job.attempts) * 1e3;
          logger.info(`[Queue] Retrying job ${job.id} in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          this.queue.push(job);
        } else {
          logger.error(`[Queue] Job ${job.id} (${job.name}) permanently failed after ${job.maxAttempts} attempts.`);
        }
      }
    }
    this.processing = false;
  }
  async executeJob(job) {
    switch (job.name) {
      case "generate-card":
        await new Promise((res) => setTimeout(res, 500));
        logger.info(`[Queue] Executed image card generation for data:`, job.data);
        break;
      case "send-bulk-notifications":
        await new Promise((res) => setTimeout(res, 300));
        logger.info(`[Queue] Sent bulk notifications for data:`, job.data);
        break;
      case "calculate-metrics":
        await new Promise((res) => setTimeout(res, 200));
        logger.info(`[Queue] Calculated daily platform metrics.`);
        break;
      default:
        logger.warn(`[Queue] Unknown job type: ${job.name}`);
    }
  }
  getQueueStatus() {
    return {
      pendingJobs: this.queue.length,
      isProcessing: this.processing
    };
  }
};
var backgroundQueue = new BackgroundQueue();

// server/routes/metrics.ts
var router12 = Router12();
var httpRequestsTotal = 0;
var httpRequestErrorsTotal = 0;
var paymentFailuresTotal = 0;
var activeSessionsCount = 0;
function incrementHttpRequests() {
  httpRequestsTotal++;
}
router12.get("/metrics", async (req, res) => {
  if (req.query.token) {
    return res.status(400).json({ error: "Token in query string is forbidden. Pass token via Authorization or X-Metrics-Token header." });
  }
  if (config.nodeEnv === "production") {
    const authHeader = req.headers["authorization"];
    const bearerToken = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const xMetricsToken = req.headers["x-metrics-token"];
    const tokenUsed = xMetricsToken || bearerToken;
    if (!tokenUsed || tokenUsed !== config.metricsSecret) {
      return res.status(403).json({ error: "Access denied: Valid metrics token required in headers" });
    }
  }
  const queueStatus = backgroundQueue.getQueueStatus();
  const dbStatus = isDbActive() ? 1 : 0;
  const metricsOutput = [
    `# HELP neon_orbit_http_requests_total Total HTTP requests received`,
    `# TYPE neon_orbit_http_requests_total counter`,
    `neon_orbit_http_requests_total ${httpRequestsTotal}`,
    ``,
    `# HELP neon_orbit_http_errors_total Total HTTP 5xx errors`,
    `# TYPE neon_orbit_http_errors_total counter`,
    `neon_orbit_http_errors_total ${httpRequestErrorsTotal}`,
    ``,
    `# HELP neon_orbit_payment_failures_total Total failed Telegram Stars payments`,
    `# TYPE neon_orbit_payment_failures_total counter`,
    `neon_orbit_payment_failures_total ${paymentFailuresTotal}`,
    ``,
    `# HELP neon_orbit_active_sessions Active player sessions`,
    `# TYPE neon_orbit_active_sessions gauge`,
    `neon_orbit_active_sessions ${activeSessionsCount}`,
    ``,
    `# HELP neon_orbit_queue_pending_jobs Number of pending background queue jobs`,
    `# TYPE neon_orbit_queue_pending_jobs gauge`,
    `neon_orbit_queue_pending_jobs ${queueStatus.pendingJobs}`,
    ``,
    `# HELP neon_orbit_db_connected PostgreSQL connection status (1 = connected, 0 = disconnected)`,
    `# TYPE neon_orbit_db_connected gauge`,
    `neon_orbit_db_connected ${dbStatus}`
  ].join("\n");
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(metricsOutput);
});
var metrics_default = router12;

// server/routes/webhook.ts
import { Router as Router13 } from "express";
import { webhookCallback } from "grammy";
import crypto6 from "crypto";
var router13 = Router13();
var originalStart = bot.start;
var grammyHandler = webhookCallback(bot, "express", {
  secretToken: config.webhookSecret && config.webhookSecret !== "default_webhook_secret" ? config.webhookSecret : void 0
});
bot.start = originalStart;
function safeTokenCompare(provided, expected) {
  try {
    const bufA = Buffer.from(provided);
    const bufB = Buffer.from(expected);
    if (bufA.length !== bufB.length) return false;
    return crypto6.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
var webhookRoute = async (req, res, next) => {
  const isDevLike = config.nodeEnv === "development" || config.nodeEnv === "test";
  if (!config.botToken || config.botToken.startsWith("111111111:")) {
    logger.warn("Webhook called but TELEGRAM_BOT_TOKEN is not configured.");
    return res.status(503).json({ success: false, error: "BOT_TOKEN_NOT_CONFIGURED" });
  }
  if (!config.webhookSecret || config.webhookSecret === "default_webhook_secret") {
    if (!isDevLike) {
      logger.error("CRITICAL: WEBHOOK_SECRET is not configured in production.");
      return res.status(503).json({ success: false, error: "WEBHOOK_SECRET_NOT_CONFIGURED" });
    }
  }
  const receivedToken = req.headers["x-telegram-bot-api-secret-token"];
  if (config.webhookSecret && config.webhookSecret !== "default_webhook_secret") {
    if (!receivedToken || typeof receivedToken !== "string" || !safeTokenCompare(receivedToken, config.webhookSecret)) {
      logger.warn("[WEBHOOK SECURITY] Invalid or missing X-Telegram-Bot-Api-Secret-Token");
      return res.status(401).json({ success: false, error: "UNAUTHORIZED_WEBHOOK_TOKEN" });
    }
  } else if (!isDevLike) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED_WEBHOOK_TOKEN" });
  }
  try {
    return grammyHandler(req, res);
  } catch (err) {
    logger.error("Error handling Telegram webhook update:", err);
    return res.status(500).json({ success: false, error: "WEBHOOK_HANDLING_FAILED" });
  }
};
router13.post("/bot/webhook", webhookRoute);
var webhook_default = router13;

// server/routes/cron.ts
import { Router as Router14 } from "express";
import crypto7 from "crypto";

// server/services/notifications.ts
var APP_URL2 = config.appUrl || "http://localhost:3000";
async function processNotificationQueue() {
  if (!isDbActive()) return;
  try {
    await query(`
      UPDATE notification_queue
      SET status = 'pending', scheduled_for = NOW() + INTERVAL '2 minutes', updated_at = NOW()
      WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '15 minutes'
    `);
    const { rows } = await query(
      `UPDATE notification_queue
       SET status = 'processing', updated_at = NOW()
       WHERE id IN (
         SELECT q.id
         FROM notification_queue q
         WHERE q.status = 'pending' AND q.scheduled_for <= NOW()
         ORDER BY q.priority ASC, q.scheduled_for ASC
         LIMIT 20
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, user_id, type, title, body, ab_variant, attempts, max_attempts`
    );
    if (rows.length === 0) return;
    for (const item of rows) {
      const userPrefsRes = await query(
        `SELECT u.language_code, p.quiet_start, p.quiet_end FROM users u LEFT JOIN notification_prefs p ON p.user_id = u.id WHERE u.id = $1`,
        [item.user_id]
      );
      const userPrefs = userPrefsRes.rows[0] || {};
      const currentHour = (/* @__PURE__ */ new Date()).getUTCHours();
      const quietStart = userPrefs.quiet_start !== void 0 && userPrefs.quiet_start !== null ? userPrefs.quiet_start : 23;
      const quietEnd = userPrefs.quiet_end !== void 0 && userPrefs.quiet_end !== null ? userPrefs.quiet_end : 8;
      let inQuietHours = false;
      if (quietStart > quietEnd) {
        inQuietHours = currentHour >= quietStart || currentHour < quietEnd;
      } else {
        inQuietHours = currentHour >= quietStart && currentHour < quietEnd;
      }
      if (inQuietHours) {
        await query(
          `UPDATE notification_queue SET status = 'pending', scheduled_for = NOW() + INTERVAL '4 hours', updated_at = NOW() WHERE id = $1`,
          [item.id]
        );
        continue;
      }
      const isRu2 = (userPrefs.language_code || "").toLowerCase().startsWith("ru");
      const messageText = `\u{1F6F8} **NEON ORBIT**

**${item.title}**
${item.body}`;
      const keyboard = {
        inline_keyboard: [
          [{ text: isRu2 ? "\u{1F3AE} \u0418\u0413\u0420\u0410\u0422\u042C \u0421\u0415\u0419\u0427\u0410\u0421" : "\u{1F3AE} PLAY NOW", web_app: { url: APP_URL2 } }],
          [{ text: isRu2 ? "\u{1F515} \u041E\u0442\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F" : "\u{1F515} Unsubscribe", callback_data: `unsub_${item.user_id}` }]
        ]
      };
      try {
        await bot.api.sendMessage(item.user_id, messageText, {
          parse_mode: "Markdown",
          reply_markup: keyboard
        });
        await query(
          `UPDATE notification_queue SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [item.id]
        );
        await query(
          `INSERT INTO notification_logs (user_id, type, ab_variant, sent_at) VALUES ($1, $2, $3, NOW())`,
          [item.user_id, item.type, item.ab_variant]
        );
      } catch (err) {
        const errStr = String(err?.message || err);
        const attempts = (item.attempts || 0) + 1;
        const maxAttempts = item.max_attempts || 3;
        if (errStr.includes("403") || errStr.includes("blocked") || errStr.includes("deactivated")) {
          logger.warn(`User ${item.user_id} blocked bot. Disabling notifications.`);
          await query(`UPDATE users SET notifications_enabled = FALSE WHERE id = $1`, [item.user_id]);
          await query(`UPDATE notification_queue SET status = 'failed', attempts = $1, error = $2, updated_at = NOW() WHERE id = $3`, [attempts, errStr, item.id]);
        } else if (errStr.includes("429") || errStr.includes("Too Many Requests") || err?.parameters?.retry_after) {
          const retryAfterSec = err?.parameters?.retry_after || 60;
          logger.warn(`Telegram rate limit (429) hit for notification ${item.id}. Retrying after ${retryAfterSec}s.`);
          await query(
            `UPDATE notification_queue SET status = 'pending', attempts = $1, scheduled_for = NOW() + INTERVAL '1 second' * $2, error = $3, updated_at = NOW() WHERE id = $4`,
            [attempts, retryAfterSec, errStr, item.id]
          );
        } else if (attempts < maxAttempts) {
          const backoffMinutes = Math.pow(2, attempts);
          logger.error(`Failed to send notification to ${item.user_id} (attempt ${attempts}/${maxAttempts}). Retrying in ${backoffMinutes}m:`, errStr);
          await query(
            `UPDATE notification_queue SET status = 'pending', attempts = $1, scheduled_for = NOW() + INTERVAL '1 minute' * $2, error = $3, updated_at = NOW() WHERE id = $4`,
            [attempts, backoffMinutes, errStr, item.id]
          );
        } else {
          logger.error(`Notification ${item.id} permanently failed after ${maxAttempts} attempts:`, errStr);
          await query(
            `UPDATE notification_queue SET status = 'dead_letter', attempts = $1, error = $2, updated_at = NOW() WHERE id = $3`,
            [attempts, errStr, item.id]
          );
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  } catch (err) {
    logger.error("Error processing notification queue:", err);
  }
}

// server/routes/cron.ts
var router14 = Router14();
function isAuthorizedCron(req) {
  const cronSecret = process.env.CRON_SECRET;
  const isDevLike = config.nodeEnv === "development" || config.nodeEnv === "test";
  if (!cronSecret) {
    if (isDevLike) {
      return { authorized: true };
    }
    return { authorized: false, status: 503 };
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authorized: false, status: 401 };
  }
  const token2 = authHeader.substring(7);
  try {
    const hashedProvided = crypto7.createHash("sha256").update(token2).digest();
    const hashedExpected = crypto7.createHash("sha256").update(cronSecret).digest();
    if (crypto7.timingSafeEqual(hashedProvided, hashedExpected)) {
      return { authorized: true };
    }
  } catch {
  }
  return { authorized: false, status: 401 };
}
router14.all("/cron/payments-reconcile", async (req, res) => {
  const auth = isAuthorizedCron(req);
  if (!auth.authorized) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.status === 503 ? "CRON_NOT_CONFIGURED" : "UNAUTHORIZED_CRON"
    });
  }
  try {
    const stats = await reconcilePendingPayments();
    return res.json({ success: true, stats, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (err) {
    logger.error("Cron payment reconciliation error:", err);
    return res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});
router14.all("/cron/notifications", async (req, res) => {
  const auth = isAuthorizedCron(req);
  if (!auth.authorized) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.status === 503 ? "CRON_NOT_CONFIGURED" : "UNAUTHORIZED_CRON"
    });
  }
  try {
    await processNotificationQueue();
    return res.json({ success: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (err) {
    logger.error("Cron notification processing error:", err);
    return res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});
router14.all("/cron/leaderboard-reset", async (req, res) => {
  const auth = isAuthorizedCron(req);
  if (!auth.authorized) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.status === 503 ? "CRON_NOT_CONFIGURED" : "UNAUTHORIZED_CRON"
    });
  }
  try {
    const season = await checkAndRolloverSeasons();
    return res.json({ success: true, activeSeason: season?.id || null, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (err) {
    logger.error("Cron season reset error:", err);
    return res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
  }
});
var cron_default = router14;

// server/app.ts
var CorsError = class extends Error {
  constructor(message = "CORS policy error: Origin not allowed.") {
    super(message);
    this.name = "CorsError";
    this.status = 403;
  }
};
function createApp() {
  const app2 = express();
  app2.set("trust proxy", 1);
  app2.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "frame-ancestors": ["'self'", "https://web.telegram.org", "https://webk.telegram.org", "https://webz.telegram.org"]
        }
      }
    })
  );
  app2.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins2 = getEffectiveAllowedOrigins(config);
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins2.includes(origin)) {
          return callback(null, true);
        }
        if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new CorsError("CORS policy error: Origin not allowed."));
      },
      credentials: true
    })
  );
  app2.use(express.json({ limit: "100kb" }));
  app2.use("/api", health_default);
  app2.use("/api", (_req, res, next) => {
    if (configErrors && configErrors.length > 0) {
      return res.status(500).json({
        success: false,
        error: "CONFIGURATION_ERROR",
        message: "Server misconfigured. Missing required production environment variables.",
        details: configErrors
      });
    }
    next();
  });
  app2.use("/api", metrics_default);
  app2.use("/api", webhook_default);
  app2.use("/api", cron_default);
  app2.use((_req, _res, next) => {
    incrementHttpRequests();
    next();
  });
  const localRateLimitMap = /* @__PURE__ */ new Map();
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: Number(process.env.RATE_LIMIT_MAX) || 150,
    skip: () => process.env.SKIP_RATE_LIMIT === "true" || process.env.NODE_ENV === "test",
    message: { success: false, error: "Too many requests." },
    store: {
      init: () => {
      },
      increment: async (key) => {
        try {
          const hits = await redisIncrWithExpire(`ratelimit:api:${key}`, 900);
          return { totalHits: hits, resetTime: new Date(Date.now() + 15 * 60 * 1e3) };
        } catch (err) {
          logger.warn(`Redis rate limit failed for ${key}, falling back to in-memory counter:`, err);
          const now = Date.now();
          const entry = localRateLimitMap.get(key);
          if (!entry || entry.resetTime <= now) {
            const resetTime = now + 15 * 60 * 1e3;
            localRateLimitMap.set(key, { count: 1, resetTime });
            return { totalHits: 1, resetTime: new Date(resetTime) };
          }
          entry.count += 1;
          return { totalHits: entry.count, resetTime: new Date(entry.resetTime) };
        }
      },
      decrement: async (key) => {
        const entry = localRateLimitMap.get(key);
        if (entry && entry.count > 0) {
          entry.count -= 1;
        }
      },
      resetKey: async (key) => {
        localRateLimitMap.delete(key);
      }
    }
  });
  app2.use("/api/", apiLimiter);
  app2.use("/api/auth", auth_default);
  app2.use("/api", auth_default);
  app2.use("/api", game_default);
  app2.use("/api", stars_default);
  app2.use("/api", economy_default);
  app2.use("/api", admin_default);
  app2.use("/api", analytics_default);
  app2.use("/api", seasons_default);
  app2.use("/api", dailyContent_default);
  app2.use("/api", viral_default);
  app2.use("/api", notifications_default);
  app2.use("/api/*", (_req, res) => {
    res.status(404).json({ success: false, error: "NOT_FOUND" });
  });
  app2.use((err, _req, res, _next) => {
    logger.error("Unhandled API Error:", err);
    if (err.name === "CorsError" || err.message && err.message.includes("CORS policy error")) {
      return res.status(403).json({
        success: false,
        error: "CORS_FORBIDDEN"
      });
    }
    const statusCode = typeof err.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
    const isDev = config.nodeEnv === "development" || config.nodeEnv === "test";
    const clientError = statusCode < 500 ? err.message : isDev ? err.message || "INTERNAL_SERVER_ERROR" : "INTERNAL_SERVER_ERROR";
    res.status(statusCode).json({
      success: false,
      error: clientError || "INTERNAL_SERVER_ERROR"
    });
  });
  return app2;
}
var app = createApp();
var app_default = app;

// api/serverless.ts
function handler(req, res) {
  if (req.url) {
    const forwardedUri = req.headers["x-forwarded-uri"] || req.headers["x-matched-path"];
    if (typeof forwardedUri === "string" && forwardedUri.startsWith("/api")) {
      req.url = forwardedUri;
    } else if (req.url.startsWith("/api/index")) {
      try {
        const urlObj = new URL(req.url, "http://localhost");
        const paramPath = urlObj.searchParams.get("__path");
        if (paramPath) {
          req.url = `/api/${paramPath}`;
        }
      } catch {
      }
    }
  }
  return new Promise((resolve, reject) => {
    res.on("finish", () => resolve());
    res.on("close", () => resolve());
    res.on("error", (err) => reject(err));
    try {
      app_default(req, res, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  }).catch((err) => {
    console.error("Unhandled Vercel serverless function invocation error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        success: false,
        error: "SERVERLESS_INVOCATION_ERROR",
        message: err?.message || "Internal Server Error"
      }));
    }
  });
}
export {
  handler as default
};
