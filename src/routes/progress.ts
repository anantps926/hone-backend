import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { db } from '../db'
import { masteryBreakdown } from '../types'

const router = Router()

const progressSchema = z.object({
  format: z.enum(['read', 'watch', 'listen', 'practice', 'quiz']),
  value: z.number().min(0).max(100),
})

router.put('/:techniqueId', requireAuth, validateBody(progressSchema), async (req, res) => {
  const user = (req as any).dbUser
  const techniqueId = req.params.techniqueId as string
  const { format, value } = req.body

  const technique = await db.technique.findUnique({ where: { id: techniqueId } })
  if (!technique) {
    res.status(404).json({ error: 'Technique not found' })
    return
  }

  const existing = await db.techniqueProgress.findUnique({
    where: { techniqueId_userId: { techniqueId, userId: user.id } },
  })

  const read = existing?.read ?? 0
  const watch = existing?.watch ?? 0
  const listen = existing?.listen ?? 0
  const practice = existing?.practice ?? 0
  const quiz = existing?.quiz ?? 0

  const mergedValue = Math.max(
    format === 'read'
      ? read
      : format === 'watch'
        ? watch
        : format === 'listen'
          ? listen
          : format === 'practice'
            ? practice
            : quiz,
    value
  )

  const updatedProgress = {
    read,
    watch,
    listen,
    practice,
    quiz,
    [format]: mergedValue,
  }

  const breakdown = masteryBreakdown(updatedProgress)

  const progress = await db.techniqueProgress.upsert({
    where: { techniqueId_userId: { techniqueId, userId: user.id } },
    create: {
      techniqueId,
      userId: user.id,
      status: 'LOCKED',
      ...updatedProgress,
      mastery: breakdown.mastery,
    },
    update: {
      ...updatedProgress,
      mastery: breakdown.mastery,
    },
  })

  res.json({ progress, ...breakdown })
})

router.post('/:techniqueId/master', requireAuth, async (req, res) => {
  const user = (req as any).dbUser
  const techniqueId = req.params.techniqueId as string

  const technique = await db.technique.findUnique({
    where: { id: techniqueId },
    include: { hobby: { include: { techniques: { orderBy: { orderIndex: 'asc' } } } } },
  })

  if (!technique) {
    res.status(404).json({ error: 'Technique not found' })
    return
  }

  let progressRecord = await db.techniqueProgress.findUnique({
    where: { techniqueId_userId: { techniqueId, userId: user.id } },
  })

  if (!progressRecord) {
    progressRecord = await db.techniqueProgress.create({
      data: {
        techniqueId,
        userId: user.id,
        status: 'LOCKED',
      },
    })
  }

  const breakdown = masteryBreakdown({
    read: progressRecord.read,
    watch: progressRecord.watch,
    listen: progressRecord.listen,
    practice: progressRecord.practice,
    quiz: progressRecord.quiz,
  })

  if (breakdown.mastery < 70) {
    res.status(400).json({
      error: 'Not ready',
      mastery: breakdown.mastery,
      cappedReason: breakdown.cappedReason,
    })
    return
  }

  await db.techniqueProgress.update({
    where: { techniqueId_userId: { techniqueId, userId: user.id } },
    data: { status: 'MASTERED', mastery: 100 },
  })

  const XP_PER_MASTERY = 100
  await db.user.update({
    where: { id: user.id },
    data: { xp: { increment: XP_PER_MASTERY } },
  })

  const sortedTechniques = technique.hobby.techniques
  const currentIndex = sortedTechniques.findIndex((t: { id: string }) => t.id === techniqueId)
  const nextTechnique = sortedTechniques[currentIndex + 1]

  let nextTechniqueId: string | null = null
  if (nextTechnique) {
    await db.techniqueProgress.upsert({
      where: { techniqueId_userId: { techniqueId: nextTechnique.id, userId: user.id } },
      create: { techniqueId: nextTechnique.id, userId: user.id, status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    })
    nextTechniqueId = nextTechnique.id
  }

  res.json({ masteredTechniqueId: techniqueId, nextTechniqueId, xpAwarded: XP_PER_MASTERY })
})

export default router
