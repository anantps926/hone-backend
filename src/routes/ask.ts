import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { streamAsk } from '../services/askService'

const router = Router()

const askSchema = z.object({
  hobbyName: z.string(),
  techniqueName: z.string(),
  word: z.string(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(12),
})

router.post('/', requireAuth, async (req, res) => {
  const parsed = askSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }
  const { hobbyName, techniqueName, word, messages } = parsed.data
  await streamAsk(res, hobbyName, techniqueName, word, messages)
})

export default router
