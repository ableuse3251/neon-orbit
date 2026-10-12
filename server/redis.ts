import { Redis } from 'ioredis';
import { config } from './config.js';

let redisClient: Redis | null = null;
let isRedisConnected = false;

// Simple in-memory fallback store when Redis server is absent
class MemoryRedisFallback {
  private kvStore = new Map<string, string>();
  private zStore = new Map<string, Map<string, number>>();
  private expireStore = new Map<string, number>();

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

if (config.redisUrl) {
  try {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
    });

    redisClient.on('error', (err) => {
      console.warn('Redis connection warning:', err.message);
      isRedisConnected = false;
    });

    redisClient.connect().catch((err) => {
      console.warn('Failed to connect to Redis, running fallback mode:', err.message);
    });
  } catch (err) {
    console.warn('Redis client initialization error, falling back to memory store:', err);
    redisClient = null;
  }
} else {
  console.info('No REDIS_URL provided. Running with in-memory Redis fallback.');
}

export async function redisGet(key: string): Promise<string | null> {
  if (redisClient && isRedisConnected) {
    try {
      return await redisClient.get(key);
    } catch {
      return memoryFallback.get(key);
    }
  }
  return memoryFallback.get(key);
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (redisClient && isRedisConnected) {
    try {
      if (ttlSeconds) {
        await redisClient.set(key, value, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, value);
      }
      return;
    } catch (err) {
      if (config.nodeEnv === 'production' && config.redisUrl) {
        throw new Error(`Redis SET failed in production: ${(err as Error).message}`);
      }
      await memoryFallback.set(key, value);
      return;
    }
  }
  if (config.nodeEnv === 'production' && config.redisUrl) {
    throw new Error('Redis is required in production but disconnected.');
  }
  await memoryFallback.set(key, value);
}

export async function redisDel(key: string): Promise<void> {
  if (redisClient && isRedisConnected) {
    try {
      await redisClient.del(key);
      return;
    } catch (err) {
      if (config.nodeEnv === 'production' && config.redisUrl) {
        throw new Error(`Redis DEL failed in production: ${(err as Error).message}`);
      }
      await memoryFallback.del(key);
      return;
    }
  }
  if (config.nodeEnv === 'production' && config.redisUrl) {
    throw new Error('Redis DEL failed: Redis disconnected in production.');
  }
  await memoryFallback.del(key);
}

export async function redisZAdd(key: string, score: number, member: string): Promise<void> {
  if (redisClient && isRedisConnected) {
    try {
      await redisClient.zadd(key, score, member);
      return;
    } catch (err) {
      if (config.nodeEnv === 'production' && config.redisUrl) {
        throw new Error(`Redis ZADD failed in production: ${(err as Error).message}`);
      }
      await memoryFallback.zadd(key, score, member);
      return;
    }
  }
  if (config.nodeEnv === 'production' && config.redisUrl) {
    throw new Error('Redis ZADD failed: Redis disconnected in production.');
  }
  await memoryFallback.zadd(key, score, member);
}

export async function redisZRem(key: string, member: string): Promise<void> {
  if (redisClient && isRedisConnected) {
    try {
      await redisClient.zrem(key, member);
      return;
    } catch (err) {
      if (config.nodeEnv === 'production' && config.redisUrl) {
        throw new Error(`Redis ZREM failed in production: ${(err as Error).message}`);
      }
      await memoryFallback.zrem(key, member);
      return;
    }
  }
  if (config.nodeEnv === 'production' && config.redisUrl) {
    throw new Error('Redis ZREM failed: Redis disconnected in production.');
  }
  await memoryFallback.zrem(key, member);
}

export async function redisZRevRank(key: string, member: string): Promise<number | null> {
  if (redisClient && isRedisConnected) {
    try {
      const res = await redisClient.zrevrank(key, member);
      return res;
    } catch {
      return memoryFallback.zrevrank(key, member);
    }
  }
  return memoryFallback.zrevrank(key, member);
}

export async function redisZScore(key: string, member: string): Promise<number | null> {
  if (redisClient && isRedisConnected) {
    try {
      const res = await redisClient.zscore(key, member);
      return res !== null ? Number(res) : null;
    } catch {
      return memoryFallback.zscore(key, member);
    }
  }
  return memoryFallback.zscore(key, member);
}

export async function redisZRevRange(
  key: string,
  start: number,
  stop: number,
  withScores = false
): Promise<string[]> {
  if (redisClient && isRedisConnected) {
    try {
      if (withScores) {
        return await redisClient.zrevrange(key, start, stop, 'WITHSCORES');
      }
      return await redisClient.zrevrange(key, start, stop);
    } catch {
      return memoryFallback.zrevrange(key, start, stop, withScores ? 'WITHSCORES' : '');
    }
  }
  return memoryFallback.zrevrange(key, start, stop, withScores ? 'WITHSCORES' : '');
}

export async function redisIncrWithExpire(key: string, ttlSeconds: number): Promise<number> {
  if (redisClient && isRedisConnected) {
    try {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, ttlSeconds);
      }
      return count;
    } catch {
      return memoryFallback.incrWithExpire(key, ttlSeconds);
    }
  }
  return memoryFallback.incrWithExpire(key, ttlSeconds);
}

export async function checkRedisHealth(): Promise<{ status: 'ok' | 'degraded' | 'disabled'; message?: string }> {
  if (!config.redisUrl) {
    return { status: 'disabled', message: 'No REDIS_URL configured (In-Memory Fallback)' };
  }

  if (redisClient && isRedisConnected) {
    try {
      const pingRes = await redisClient.ping();
      if (pingRes === 'PONG') {
        return { status: 'ok' };
      }
    } catch (err) {
      return { status: 'degraded', message: (err as Error).message };
    }
  }

  return { status: 'degraded', message: 'Redis connection inactive, fallback active' };
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
  }
}
