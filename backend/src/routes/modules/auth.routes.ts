import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../middlewares/auth.js'
import { loginSchema, loginUser, refreshSession, registerSchema, registerUser } from '../../services/auth.service.js'
import { sendValidationError } from '../../utils/http.js'

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    try {
      const input = registerSchema.parse(request.body)
      const tokens = await registerUser(app, input)

      reply
        .setCookie('achafrio_refresh_token', tokens.refreshToken, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: false,
          expires: tokens.refreshExpiresAt,
        })
        .send({ accessToken: tokens.accessToken })
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.post('/login', async (request, reply) => {
    try {
      const input = loginSchema.parse(request.body)
      const tokens = await loginUser(app, input)

      reply
        .setCookie('achafrio_refresh_token', tokens.refreshToken, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: false,
          expires: tokens.refreshExpiresAt,
        })
        .send({ accessToken: tokens.accessToken })
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.post('/refresh', async (request, reply) => {
    try {
      const refreshToken = request.cookies.achafrio_refresh_token
      if (!refreshToken) return reply.status(401).send({ error: 'Refresh token ausente.' })
      const tokens = await refreshSession(app, refreshToken)

      reply
        .setCookie('achafrio_refresh_token', tokens.refreshToken, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: false,
          expires: tokens.refreshExpiresAt,
        })
        .send({ accessToken: tokens.accessToken })
    } catch (error) {
      return sendValidationError(reply, error, 'Falha ao renovar sessão.')
    }
  })

  app.post('/logout', async (_request, reply) => {
    reply.clearCookie('achafrio_refresh_token', { path: '/' }).send({ ok: true })
  })

  app.get('/me', { preHandler: requireAuth }, async (request) => {
    return app.prisma.user.findUnique({ where: { id: request.user.userId }, include: { profile: true } })
  })
}
