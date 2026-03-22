import pino from 'pino'

/** JSON lines to stdout — picked up by Render and other hosts that aggregate process logs. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
})
