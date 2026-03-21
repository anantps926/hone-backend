import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { rateLimitMiddleware } from '../middleware/rateLimit'
import { validateBody } from '../middleware/validate'
import { generatePlan } from '../services/planService'

const router = Router()

const planSchema = z.object({
  input: z.string().min(3).max(500),
  goalLevel: z.enum(['FUN', 'GOOD_ENOUGH', 'COMPETITIVE']),
  stream: z.boolean().optional().default(false),
})

router.post('/',
  requireAuth,
  rateLimitMiddleware('plan'),
  validateBody(planSchema),
  async (req, res) => {
    const user = (req as any).dbUser
    const { input, goalLevel, stream } = req.body

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const result = await generatePlan(
        user.id,
        input,
        goalLevel,
        (chunk) => res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      )

      res.write(`data: ${JSON.stringify({ done: true, result })}\n\n`)
      res.end()
    } else {
      const result = await generatePlan(user.id, input, goalLevel)
      res.json(result)
    }
  }
)

export default router
