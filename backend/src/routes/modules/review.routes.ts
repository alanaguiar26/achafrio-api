import type { FastifyPluginAsync } from 'fastify'
import { ReviewStatus } from '../../generated/prisma/client.js'
import { requireAuth } from '../../middlewares/auth.js'
import { getReviewTokenInfo, moderateReview, requestReview, requestReviewSchema, submitReview, submitReviewSchema } from '../../services/review.service.js'
import { sendValidationError } from '../../utils/http.js'

export const reviewRoutes: FastifyPluginAsync = async (app) => {
  app.post('/request', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const input = requestReviewSchema.parse(request.body)
      return await requestReview(app, request.user.userId, input)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.get('/token/:token', async (request, reply) => {
    try {
      const params = request.params as { token: string }
      return await getReviewTokenInfo(app, params.token)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.post('/submit', async (request, reply) => {
    try {
      const body = request.body as any
      const input = submitReviewSchema.parse({ ...body, rating: Number(body.rating) })
      return await submitReview(app, input, request.ip)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const profile = await app.prisma.profile.findFirst({ where: { userId: request.user.userId } })
      if (!profile) return reply.status(404).send({ error: 'Perfil não encontrado.' })
      return app.prisma.review.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: 'desc' } })
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.put('/:reviewId/status', { preHandler: requireAuth }, async (request, reply) => {
    try {
      if (request.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Acesso restrito ao admin.' })
      const { reviewId } = request.params as { reviewId: string }
      const { status } = request.body as { status: ReviewStatus }
      return await moderateReview(app, reviewId, status)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })
}
