import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { db } from '../db'
import { fetchAndRankVideos } from '../services/videoService'
import type { TechniqueContent } from '../types'

const router = Router()

router.get('/:techniqueId', requireAuth, async (req, res) => {
  const techniqueId = req.params.techniqueId as string

  const technique = await db.technique.findUnique({
    where: { id: techniqueId },
    include: { hobby: true },
  })

  if (!technique) {
    res.status(404).json({ error: 'Technique not found' })
    return
  }

  if (!technique.contentJson) {
    res.json({ videos: [] })
    return
  }

  const content = technique.contentJson as unknown as TechniqueContent
  const searchQueries = content.watch?.searchQueries ?? []

  const videos = await fetchAndRankVideos(
    technique.id,
    technique.hobby.name,
    technique.name,
    searchQueries
  )

  res.json({ videos })
})

export default router
