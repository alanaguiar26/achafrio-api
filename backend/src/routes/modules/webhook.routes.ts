import type { FastifyPluginAsync } from 'fastify'
import { handleAsaasWebhook } from '../../services/asaas.service.js'
import { sendValidationError } from '../../utils/http.js'

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/asaas', async (request, reply) => {
    try {
      const token = request.headers['asaas-access-token']
      const asaasToken = Array.isArray(token) ? token[0] : token
      return await handleAsaasWebhook(app, request.body, asaasToken)
    } catch (error) {
      return sendValidationError(reply, error, 'Falha ao processar webhook.')
    }
  })
}
