import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { db } from '../db'

const router = Router()

router.get('/me', requireAuth, async (req, res) => {
  const user = (req as any).dbUser
  res.json(user)
})

router.put('/me', requireAuth, validateBody(z.object({ name: z.string().optional() })), async (req, res) => {
  const user = (req as any).dbUser
  const updated = await db.user.update({
    where: { id: user.id },
    data: req.body,
  })
  res.json(updated)
})

router.post('/streak', requireAuth, async (req, res) => {
  const user = (req as any).dbUser
  const now = new Date()
  const last = user.lastActiveAt

  let newStreak = user.streak

  if (last) {
    const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60)
    if (hoursSince >= 20 && hoursSince <= 48) {
      newStreak += 1
    } else if (hoursSince > 48) {
      newStreak = 1
    }
  } else {
    newStreak = 1
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { streak: newStreak, lastActiveAt: now },
  })

  res.json({ streak: updated.streak, xp: updated.xp })
})

export default router
