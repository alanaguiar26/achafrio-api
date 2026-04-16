import { hashValue, randomToken } from '../utils/security.js'
import { env } from '../config/env.js'
import type { FastifyInstance } from 'fastify'
import type { User, Profile } from '../generated/prisma/client.js'

export async function issueAuthTokens(app: FastifyInstance, user: User & { profile: Profile | null }) {
  const accessToken = await app.jwt.sign(
    {
      sub: user.id,
      userId: user.id,
      profileId: user.profile?.id,
      role: user.role,
      plan: user.profile?.plan,
      type: user.profile?.type,
    },
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  )

  const rawRefreshToken = randomToken(48)
  const refreshHash = hashValue(rawRefreshToken)

  const now = new Date()
  const refreshExpiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30)

  await app.prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: refreshExpiresAt,
    },
  })

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    refreshExpiresAt,
  }
}
