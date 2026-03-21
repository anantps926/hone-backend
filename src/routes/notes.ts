import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { db } from '../db'

const router = Router()

const noteSchema = z.object({
  techniqueId: z.string().cuid(),
  body: z.string().min(1).max(2000),
  tags: z.array(z.string()).max(5).default([]),
})

router.post('/', requireAuth, validateBody(noteSchema), async (req, res) => {
  const user = (req as any).dbUser
  const note = await db.note.create({
    data: { userId: user.id, ...req.body },
  })
  res.status(201).json(note)
})

router.get('/', requireAuth, async (req, res) => {
  const user = (req as any).dbUser
  const techniqueId = req.query.techniqueId as string | undefined
  const notes = await db.note.findMany({
    where: {
      userId: user.id,
      ...(techniqueId ? { techniqueId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(notes)
})

router.delete('/:id', requireAuth, async (req, res) => {
  const user = (req as any).dbUser
  const id = req.params.id as string
  await db.note.deleteMany({
    where: { id, userId: user.id },
  })
  res.status(204).end()
})

export default router
