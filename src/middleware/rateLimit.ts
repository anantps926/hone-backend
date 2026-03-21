import { RequestHandler } from 'express'
import { redis } from '../redis'
import { config } from '../config'

export function rateLimitMiddleware(
  action: 'plan' | 'content',
  windowSecs = 3600
): RequestHandler {
  // In local/dev we often don't have a stable auth identity (or we intentionally bypass auth).
  // Avoid blocking our own development requests with rate limits.
  if (config.SKIP_CLERK_AUTH) {
    return async (_req, _res, next) => next()
  }

  const maxRequests = action === 'plan'
    ? config.RATE_LIMIT_MAX_PLAN
    : config.RATE_LIMIT_MAX_CONTENT

  return async (req, res, next) => {
    const user = (req as any).dbUser
    if (!user) { next(); return }

    const key = `ratelimit:${action}:${user.id}`
    const count = await redis.incr(key)

    if (count === 1) {
      await redis.expire(key, windowSecs)
    }

    if (count > maxRequests) {
      const ttl = await redis.ttl(key)
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterSeconds: ttl,
      })
      return
    }

    next()
  }
}
