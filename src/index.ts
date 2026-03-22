import { createApp } from './app'
import { config } from './config'
import { db } from './db'
import { logger } from './logger'
import { redis } from './redis'

async function main() {
  try {
    await redis.connect()
    logger.info('Redis connected')
  } catch (err) {
    logger.warn({ err }, 'Redis unavailable; starting without cache.')
  }

  try {
    await db.$connect()
    logger.info('Database connected')
  } catch (error) {
    logger.warn({ err: error }, 'Error connecting to database')
  }

  const app = createApp()
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'Hone backend listening')
  })
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error')
  process.exit(1)
})
