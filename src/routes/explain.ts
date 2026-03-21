import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { explainWord } from '../services/explainService'

const router = Router()

const explainSchema = z.object({
  hobbyName: z.string().min(1),
  techniqueName: z.string().min(1),
  word: z.string().min(1).max(100),
  sentence: z.string().min(1).max(500),
})

router.post('/', requireAuth, validateBody(explainSchema), async (req, res) => {
  const { hobbyName, techniqueName, word, sentence } = req.body
  const result = await explainWord(hobbyName, techniqueName, word, sentence)
  res.json(result)
})

export default router
