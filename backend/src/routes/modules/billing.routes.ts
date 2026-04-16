import type { FastifyPluginAsync } from 'fastify'
import { Plan } from '../../generated/prisma/client.js'
import { requireAuth } from '../../middlewares/auth.js'
import { createCheckout, getMyBilling } from '../../services/asaas.service.js'
import { sendValidationError } from '../../utils/http.js'

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.post('/checkout', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const body = request.body as { plan: Plan; billingType?: 'PIX' | 'BOLETO' }
      const profile = await app.prisma.profile.findFirst({ where: { userId: request.user.userId } })
      if (!profile) return reply.status(404).send({ error: 'Perfil não encontrado.' })
      return await createCheckout(app, profile.id, body.plan, body.billingType ?? 'PIX')
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const profile = await app.prisma.profile.findFirst({ where: { userId: request.user.userId } })
      if (!profile) return reply.status(404).send({ error: 'Perfil não encontrado.' })
      return await getMyBilling(app, profile.id)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })
}
