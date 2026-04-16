import path from 'node:path'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import swagger from '@fastify/swagger'
import { env } from './config/env.js'
import { apiRoutes } from './routes/index.js'
import { prismaPlugin } from './plugins/prisma.js'

export async function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV === 'production'
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        },
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'AchaFrio API',
        version: '1.0.0',
      },
    },
  })

  await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  })

  await app.register(cookie)
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    cookie: {
      cookieName: 'achafrio_access_token',
      signed: false,
    },
  })

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
      files: 10,
    },
  })

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
  })

  await app.register(prismaPlugin)

  await app.register(fastifyStatic, {
    root: path.resolve(env.UPLOAD_DIR),
    prefix: '/uploads/',
    decorateReply: false,
  })

  app.get('/health', async () => ({
    ok: true,
    app: env.APP_NAME,
    now: new Date().toISOString(),
  }))

  await app.register(apiRoutes, { prefix: '/api' })

  app.setNotFoundHandler((_, reply) => {
    reply.status(404).send({ error: 'Rota não encontrada.' })
  })

  return app
}
