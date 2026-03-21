import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { rateLimitMiddleware } from '../middleware/rateLimit'
import { db } from '../db'
import { generateAndCacheContent } from '../services/planService'
import type { DepthLevel } from '../types'

const router = Router()

router.get('/:techniqueId', requireAuth, rateLimitMiddleware('content'), async (req, res) => {
  const techniqueId = req.params.techniqueId as string

  const technique = await db.technique.findUnique({
    where: { id: techniqueId },
    include: { hobby: true },
  })

  if (!technique) {
    res.status(404).json({ error: 'Technique not found' })
    return
  }

  const audioMeta = {
    audioLectureUrl: technique.audioLectureUrl ?? null,
    audioPodcastUrl: technique.audioPodcastUrl ?? null,
  }

  if (technique.contentJson) {
    res.json({
      content: technique.contentJson,
      videos: technique.videoJson ?? [],
      ...audioMeta,
    })
    return
  }

  const [content, videos] = await Promise.all([
    generateAndCacheContent(
      technique.id,
      technique.hobby.name,
      technique.name,
      technique.whyItMatters,
      technique.depthLevel as DepthLevel
    ),
    technique.videoJson
      ? Promise.resolve(technique.videoJson)
      : Promise.resolve([]),
  ])

  res.json({ content, videos, ...audioMeta })
})

export default router
