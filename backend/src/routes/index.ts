import type { FastifyPluginAsync } from 'fastify'
import { authRoutes } from './modules/auth.routes.js'
import { profileRoutes } from './modules/profile.routes.js'
import { reviewRoutes } from './modules/review.routes.js'
import { quoteRoutes } from './modules/quote.routes.js'
import { billingRoutes } from './modules/billing.routes.js'
import { adminRoutes } from './modules/admin.routes.js'
import { webhookRoutes } from './modules/webhook.routes.js'

export const apiRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(profileRoutes, { prefix: '/profiles' })
  await app.register(reviewRoutes, { prefix: '/reviews' })
  await app.register(quoteRoutes, { prefix: '/quotes' })
  await app.register(billingRoutes, { prefix: '/billing' })
  await app.register(adminRoutes, { prefix: '/admin' })
  await app.register(webhookRoutes, { prefix: '/webhooks' })
}
