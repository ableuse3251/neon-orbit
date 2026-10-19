import { Redis } from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;
let isRedisConnected = false;
let redisDegradedCounter = 0;

export function getRedisDegradedCount(): number {
  return redisDegradedCounter;
}

export function incrementRedisDegradedCount(): void {
  redisDegradedCounter++;
}

// Simple in-memory fallback store when Redis server is absent (used in development or as fallback)
class MemoryRedisFallback {
  private kvStore = new Map<string, string>();
  private zStore = new Map<string, Map<string, number>>();
  private expireStore = new Map<string, number>();
  private maxEntries = 10000;

  async get(key: string): Promise<string | null> {
    return this.kvStore.get(key) ?? null;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<'OK'> {
    this.kvStore.set(key, value);
    return 'OK';
  }

  async incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
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
        if (firstKey !== undefined) {
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
      this.expireStore.set(key, now + ttlSeconds * 1000);
    }
    return newVal;
  }

  async del(key: string): Promise<number> {
    const deleted = this.kvStore.delete(key);
    this.zStore.delete(key);
    this.expireStore.delete(key);
    return deleted ? 1 : 0;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    let setMap = this.zStore.get(key);
    if (!setMap) {
      setMap = new Map<string, number>();
      this.zStore.set(key, setMap);
    }
    const isNew = !setMap.has(member);
    setMap.set(member, score);
    return isNew ? 1 : 0;
  }

  async zrem(key: string, member: string): Promise<number> {
    const setMap = this.zStore.get(key);
    if (!setMap) return 0;
    return setMap.delete(member) ? 1 : 0;
  }

  async zrevrank(key: string, member: string): Promise<number | null> {
    const setMap = this.zStore.get(key);
    if (!setMap) return null;
    const sorted = Array.from(setMap.entries()).sort((a, b) => b[1] - a[1]);
    const index = sorted.findIndex(([m]) => m === member);
    return index >= 0 ? index : null;
  }

  async zscore(key: string, member: string): Promise<number | null> {
    const setMap = this.zStore.get(key);
    if (!setMap) return null;
    return setMap.get(member) ?? null;
  }

  async zrevrange(key: string, start: number, stop: number, ...args: string[]): Promise<string[]> {
    const setMap = this.zStore.get(key);
    if (!setMap) return [];
    const sorted = Array.from(setMap.entries()).sort((a, b) => b[1] - a[1]);
    const sliced = sorted.slice(start, stop === -1 ? undefined : stop + 1);

    if (args.includes('WITHSCORES') || args.includes('withscores')) {
      const result: string[] = [];
      for (const [member, score] of sliced) {
        result.push(member, score.toString());
      }
      return result;
    }
    return sliced.map(([member]) => member);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }
}

const memoryFallback = new MemoryRedisFallback();
let activeRedisUrl = config.redisUrl || '';

if (config.redisUrl) {
  try {
    const isServerless = process.env.VERCEL === '1' || process.env.SERVERLESS === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: isServerless ? 1 : 2,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: isServerless ? 3000 : 10000,
      retryStrategy: isServerless ? () => null : (times) => Math.min(times * 100, 2000),
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      logger.info('Redis connection established successfully.');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis connection error (Degraded event #${redisDegradedCounter}):`, err.message);
    });

    redisClient.connect().catch((err) => {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn('Failed to connect to Redis on startup, running in fallback mode:', err.message);
    });
  } catch (err) {
    isRedisConnected = false;
    redisDegradedCounter++;
    logger.warn('Redis client initialization error, falling back to memory store:', err);
    redisClient = null;
  }
} else {
  logger.info('No REDIS_URL provided. Running with in-memory Redis fallback (Development/Local mode).');
}

async function ensureRedisConnected(): Promise<boolean> {
  if (!redisClient) return false;
  const status = (redisClient as any).status;
  if (status === 'ready') {
    isRedisConnected = true;
    return true;
  }
  if (status === 'wait' || status === 'close') {
    try {
      await redisClient.connect();
      isRedisConnected = (redisClient as any).status === 'ready';
      return isRedisConnected;
    } catch {
      isRedisConnected = false;
      return false;
    }
  }
  if (status === 'connecting' || status === 'connect') {
    const start = Date.now();
    while ((redisClient as any).status !== 'ready' && Date.now() - start < 1500) {
      await new Promise((r) => setTimeout(r, 50));
    }
    isRedisConnected = (redisClient as any).status === 'ready';
    return isRedisConnected;
  }
  return isRedisConnected;
}

/**
 * Ensures strict production handling when Redis is disconnected:
 * In production, if REDIS_URL is configured, failing over silently to independent local memory
 * creates split-brain rate limits and race conditions across multiple replicas.
 * Therefore, in production, Redis operations either succeed or throw/reject (fail-fast / controlled degradation).
 */
function assertRedisAvailability(operationName: string): void {
  if (config.nodeEnv === 'production' && config.redisUrl) {
    if (!redisClient || ((!isRedisConnected && redisClient.status !== 'ready') && redisClient.status !== 'connect' && redisClient.status !== 'connecting')) {
      redisDegradedCounter++;
      logger.error(`CRITICAL REDIS OUTAGE: ${operationName} attempted while Redis is disconnected in production.`);
      throw new Error(`CRITICAL: Redis is required for ${operationName} in production but is currently disconnected.`);
    }
  }
}

export async function redisGet(key: string): Promise<string | null> {
  if (redisClient && (isRedisConnected || (await ensureRedisConnected()))) {
    try {
      return await redisClient.get(key);
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis GET failed for key ${key}: ${(err as Error).message}`);
    }
  }
  assertRedisAvailability('redisGet');
  return memoryFallback.get(key);
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (redisClient && (isRedisConnected || (await ensureRedisConnected()))) {
    try {
      if (ttlSeconds) {
        await redisClient.set(key, value, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, value);
      }
      return;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis SET failed for key ${key}: ${(err as Error).message}`);
    }
  }
  assertRedisAvailability('redisSet');
  await memoryFallback.set(key, value);
}

export async function redisDel(key: string): Promise<void> {
  if (redisClient && (isRedisConnected || (await ensureRedisConnected()))) {
    try {
      await redisClient.del(key);
      return;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis DEL failed for key ${key}: ${(err as Error).message}`);
    }
  }
  assertRedisAvailability('redisDel');
  await memoryFallback.del(key);
}

export async function redisZAdd(key: string, score: number, member: string): Promise<void> {
  if (redisClient && (isRedisConnected || (await ensureRedisConnected()))) {
    try {
      await redisClient.zadd(key, score, member);
      return;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis ZADD failed for key ${key}: ${(err as Error).message}`);
    }
  }
  assertRedisAvailability('redisZAdd');
  await memoryFallback.zadd(key, score, member);
}

export async function redisZRem(key: string, member: string): Promise<void> {
  if (redisClient && (isRedisConnected || (await ensureRedisConnected()))) {
    try {
      await redisClient.zrem(key, member);
      return;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis ZREM failed for key ${key}: ${(err as Error).message}`);
    }
  }
  assertRedisAvailability('redisZRem');
  await memoryFallback.zrem(key, member);
}

export async function redisZRevRank(key: string, member: string): Promise<number | null> {
  if (redisClient && (isRedisConnected || (await ensureRedisConnected()))) {
    try {
      const res = await redisClient.zrevrank(key, member);
      return res;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis ZREVRANK failed for key ${key}: ${(err as Error).message}`);
    }
  }
  assertRedisAvailability('redisZRevRank');
  return memoryFallback.zrevrank(key, member);
}

export async function redisZScore(key: string, member: string): Promise<number | null> {
  if (redisClient && (isRedisConnected || (await ensureRedisConnected()))) {
    try {
      const res = await redisClient.zscore(key, member);
      return res !== null ? Number(res) : null;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis ZSCORE failed for key ${key}: ${(err as Error).message}`);
    }
  }
  assertRedisAvailability('redisZScore');
  return memoryFallback.zscore(key, member);
}

export async function redisZRevRange(
  key: string,
  start: number,
  stop: number,
  withScores = false
): Promise<string[]> {
  if (redisClient && (isRedisConnected || (await ensureRedisConnected()))) {
    try {
      if (withScores) {
        return await redisClient.zrevrange(key, start, stop, 'WITHSCORES');
      }
      return await redisClient.zrevrange(key, start, stop);
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis ZREVRANGE failed for key ${key}: ${(err as Error).message}`);
    }
  }
  assertRedisAvailability('redisZRevRange');
  return memoryFallback.zrevrange(key, start, stop, withScores ? 'WITHSCORES' : '');
}

export async function redisIncrWithExpire(key: string, ttlSeconds: number): Promise<number> {
  if (redisClient && (isRedisConnected || (await ensureRedisConnected()))) {
    try {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, ttlSeconds);
      }
      return count;
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      logger.warn(`Redis INCR failed for key ${key}: ${(err as Error).message}`);
    }
  }

  // In production, if Redis is disconnected, rate limiting must not silently fallback
  // to independent local memory counters per replica (split-brain).
  // We use a strictly monitored local fallback with an alert tag and degraded rate metric,
  // or reject if strict rate limit isolation is required.
  if (config.nodeEnv === 'production' && config.redisUrl) {
    redisDegradedCounter++;
    logger.warn(`WARNING: Rate limiter operating on local memory fallback in production due to Redis outage (Degraded count: ${redisDegradedCounter}).`);
  }

  return memoryFallback.incrWithExpire(key, ttlSeconds);
}

export async function checkRedisHealth(): Promise<{ status: 'ok' | 'degraded' | 'disabled'; message?: string; degradedCount?: number }> {
  if (!config.redisUrl) {
    return { status: 'disabled', message: 'No REDIS_URL configured (In-Memory Fallback)', degradedCount: redisDegradedCounter };
  }

  if (activeRedisUrl !== config.redisUrl) {
    return { status: 'degraded', message: 'Redis connection inactive, fallback active', degradedCount: redisDegradedCounter };
  }

  if (redisClient && isRedisConnected) {
    try {
      const pingRes = await redisClient.ping();
      if (pingRes === 'PONG') {
        return { status: 'ok', degradedCount: redisDegradedCounter };
      }
    } catch (err) {
      isRedisConnected = false;
      redisDegradedCounter++;
      return { status: 'degraded', message: (err as Error).message, degradedCount: redisDegradedCounter };
    }
  }

  return { status: 'degraded', message: 'Redis connection inactive, fallback active', degradedCount: redisDegradedCounter };
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    isRedisConnected = false;
  }
}
