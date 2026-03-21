import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { db } from '../db'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const user = (req as any).dbUser

  const hobbies = await db.hobby.findMany({
    where: { userId: user.id },
    include: {
      techniques: {
        orderBy: { orderIndex: 'asc' },
        include: {
          progress: { where: { userId: user.id } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  res.json(hobbies)
})

router.get('/:hobbyId', requireAuth, async (req, res) => {
  const user = (req as any).dbUser
  const hobbyId = req.params.hobbyId as string

  const hobby = await db.hobby.findFirst({
    where: { id: hobbyId, userId: user.id },
    include: {
      techniques: {
        orderBy: { orderIndex: 'asc' },
        include: {
          progress: { where: { userId: user.id } },
        },
      },
    },
  })

  if (!hobby) {
    res.status(404).json({ error: 'Hobby not found' })
    return
  }

  res.json(hobby)
})

router.delete('/:hobbyId', requireAuth, async (req, res) => {
  const user = (req as any).dbUser
  const hobbyId = req.params.hobbyId as string
  await db.hobby.deleteMany({
    where: { id: hobbyId, userId: user.id },
  })
  res.status(204).end()
})

export default router
