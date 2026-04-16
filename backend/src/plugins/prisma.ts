import fp from 'fastify-plugin'
import { PrismaClient } from '../generated/prisma/client.js'

const prisma = new PrismaClient()

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

export const prismaPlugin = fp(async (app) => {
  app.decorate('prisma', prisma)

  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
})
