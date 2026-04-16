import { buildServer } from './app.js'
import { env } from './config/env.js'

async function start() {
  const app = await buildServer()
  try {
    await app.listen({ host: env.HOST, port: env.PORT })
    app.log.info(`API rodando em ${env.BACKEND_URL}`)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

start()
