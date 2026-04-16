import type { FastifyPluginAsync } from 'fastify'
import { ReviewStatus, VerificationStatus } from '../../generated/prisma/client.js'
import { requireAdmin } from '../../middlewares/auth.js'
import { moderateReview } from '../../services/review.service.js'
import { reviewVerification } from '../../services/profile.service.js'
import { sendValidationError } from '../../utils/http.js'

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard', { preHandler: requireAdmin }, async () => {
    const [users, profiles, quotes, reviewsPending, verificationsPending] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.profile.count(),
      app.prisma.quote.count(),
      app.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      app.prisma.verificationDoc.count({ where: { status: VerificationStatus.PENDING } }),
    ])

    return { users, profiles, quotes, reviewsPending, verificationsPending }
  })

  app.get('/verifications', { preHandler: requireAdmin }, async () => {
    return app.prisma.verificationDoc.findMany({ include: { profile: true }, orderBy: { createdAt: 'desc' } })
  })

  app.put('/verifications/:id', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const params = request.params as { id: string }
      const body = request.body as { status: VerificationStatus; adminNote?: string }
      return await reviewVerification(app, params.id, body.status, body.adminNote)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.get('/reviews', { preHandler: requireAdmin }, async () => {
    return app.prisma.review.findMany({ include: { profile: true }, orderBy: { createdAt: 'desc' } })
  })

  app.put('/reviews/:id', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const params = request.params as { id: string }
      const body = request.body as { status: ReviewStatus }
      return await moderateReview(app, params.id, body.status)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.get('/specialties', { preHandler: requireAdmin }, async () => {
    return app.prisma.specialty.findMany({ orderBy: { name: 'asc' } })
  })
}
