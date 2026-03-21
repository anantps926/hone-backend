import express from 'express'
import cors from 'cors'
import { pinoHttp } from 'pino-http'
import { clerk } from './middleware/auth'
import { errorHandler } from './middleware/errorHandler'
import planRouter from './routes/plan'
import contentRouter from './routes/content'
import videoRouter from './routes/video'
import explainRouter from './routes/explain'
import askRouter from './routes/ask'
import progressRouter from './routes/progress'
import notesRouter from './routes/notes'
import hobbiesRouter from './routes/hobbies'
import userRouter from './routes/user'

export function createApp() {
  const app = express()

  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json({ limit: '1mb' }))
  app.use(pinoHttp())
  app.use(clerk)

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  app.use('/api/plan',     planRouter)
  app.use('/api/content',  contentRouter)
  app.use('/api/video',    videoRouter)
  app.use('/api/explain',  explainRouter)
  app.use('/api/ask',      askRouter)
  app.use('/api/progress', progressRouter)
  app.use('/api/notes',    notesRouter)
  app.use('/api/hobbies',  hobbiesRouter)
  app.use('/api/user',     userRouter)

  app.use(errorHandler)

  return app
}
