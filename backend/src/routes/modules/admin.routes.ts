import type { FastifyPluginAsync } from 'fastify'
import { ReviewStatus, Role, VerificationStatus } from '../../generated/prisma/client.js'
import { requireAdmin } from '../../middlewares/auth.js'
import { moderateReview } from '../../services/review.service.js'
import { reviewVerification } from '../../services/profile.service.js'
import { sendValidationError } from '../../utils/http.js'

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard', { preHandler: requireAdmin }, async () => {
    const [users, profiles, quotes, reviewsPending, verificationsPending, recentUsers, recentProfiles, recentQuotes] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.profile.count({ where: { user: { role: Role.USER } } }),
      app.prisma.quote.count(),
      app.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      app.prisma.verificationDoc.count({ where: { status: VerificationStatus.PENDING } }),
      app.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { profile: { select: { id: true, name: true, slug: true, plan: true, active: true, verified: true } } },
      }),
      app.prisma.profile.findMany({
        where: { user: { role: Role.USER } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { user: { select: { email: true, role: true } } },
      }),
      app.prisma.quote.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { profile: { select: { id: true, name: true, slug: true, plan: true } } },
      }),
    ])

    return { users, profiles, quotes, reviewsPending, verificationsPending, recentUsers, recentProfiles, recentQuotes }
  })

  app.get('/users', { preHandler: requireAdmin }, async () => {
    return app.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { profile: { select: { id: true, name: true, slug: true, plan: true, active: true, verified: true } } },
    })
  })

  app.get('/profiles', { preHandler: requireAdmin }, async () => {
    return app.prisma.profile.findMany({
      where: { user: { role: Role.USER } },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, role: true } } },
    })
  })

  app.put('/profiles/:id', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const params = request.params as { id: string }
      const body = request.body as { active?: boolean; featured?: boolean }
      return await app.prisma.profile.update({
        where: { id: params.id },
        data: {
          ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
          ...(typeof body.featured === 'boolean' ? { featured: body.featured } : {}),
        },
      })
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.get('/quotes', { preHandler: requireAdmin }, async () => {
    return app.prisma.quote.findMany({
      orderBy: { createdAt: 'desc' },
      include: { profile: { select: { id: true, name: true, slug: true, plan: true } } },
    })
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
