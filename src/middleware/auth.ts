import { clerkMiddleware, getAuth } from '@clerk/express'
import { NextFunction, Request, Response, RequestHandler } from 'express'
import { db } from '../db'
import { config } from '../config'

// Important: avoid initializing Clerk middleware when skipping auth.
export const clerk: RequestHandler = config.SKIP_CLERK_AUTH
  ? (_req: Request, _res: Response, next: NextFunction) => next()
  : clerkMiddleware()

const DEV_CLERK_ID = process.env.DEV_CLERK_ID || 'local-dev'

export const requireAuth: RequestHandler = async (req, res, next) => {
  if (config.SKIP_CLERK_AUTH) {
    const clerkId = DEV_CLERK_ID

    let user = await db.user.findUnique({ where: { clerkId } })
    if (!user) {
      user = await db.user.create({
        data: { clerkId, email: `${clerkId}@local.dev` },
      })
    }

    ;(req as any).dbUser = user
    next()
    return
  }

  const { userId: clerkId } = getAuth(req)
  if (!clerkId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  let user = await db.user.findUnique({ where: { clerkId } })
  if (!user) {
    user = await db.user.create({
      data: { clerkId, email: `${clerkId}@placeholder.com` },
    })
  }

  ;(req as any).dbUser = user
  next()
}
