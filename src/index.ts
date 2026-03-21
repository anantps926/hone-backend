import { createApp } from './app'
import { config } from './config'
import { db } from './db'
import { redis } from './redis'

async function main() {
  try {
    await redis.connect()
    console.log('Redis connected')
  } catch (err) {
    console.warn('Redis unavailable; starting without cache.', err)
  }

  try {
    await db.$connect()
    console.log('Database connected')
  } catch (error) {
    console.warn('Error connecting to database:', error)
  }

  const app = createApp()
  app.listen(config.PORT, () => {
    console.log(`Hone backend running on port ${config.PORT}`)
  })
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
