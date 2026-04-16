import type { FastifyPluginAsync } from 'fastify'
import { QuoteStatus } from '../../generated/prisma/client.js'
import { requireAuth } from '../../middlewares/auth.js'
import { createQuote, createQuoteSchema, getMyQuotes, updateQuoteStatus } from '../../services/quote.service.js'
import { sendValidationError } from '../../utils/http.js'

export const quoteRoutes: FastifyPluginAsync = async (app) => {
  app.post('/create', async (request, reply) => {
    try {
      const input = createQuoteSchema.parse(request.body)
      return await createQuote(app, input)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.get('/my', { preHandler: requireAuth }, async (request, reply) => {
    try {
      return await getMyQuotes(app, request.user.userId)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.put('/:quoteId/status', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { quoteId } = request.params as { quoteId: string }
      const { status } = request.body as { status: QuoteStatus }
      return await updateQuoteStatus(app, request.user.userId, quoteId, status)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })
}
