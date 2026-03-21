import { ErrorRequestHandler } from 'express'
import pino from 'pino'

const log = pino()

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  log.error({ err, path: _req.path }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error' })
}
