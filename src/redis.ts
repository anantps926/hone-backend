import Redis from 'ioredis'
import { config } from './config'

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('error', (err) => console.error('Redis error:', err))

export async function cacheGetOrSet<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached) as T
  const result = await fn()
  await redis.setex(key, ttl, JSON.stringify(result))
  return result
}
