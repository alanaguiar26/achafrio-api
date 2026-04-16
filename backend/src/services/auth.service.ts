import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { generateUniqueSlug } from '../utils/slug.js'
import { hashValue } from '../utils/security.js'
import { issueAuthTokens } from './token.service.js'
import { ProfileType } from '../generated/prisma/client.js'
import { triggerWelcomeWebhook } from './notification.service.js'

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2).max(2),
  type: z.nativeEnum(ProfileType),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function registerUser(app: FastifyInstance, input: z.infer<typeof registerSchema>) {
  const existing = await app.prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    throw new Error('Já existe uma conta com este email.')
  }

  const slug = await generateUniqueSlug(input.name, async (candidate) => {
    const profile = await app.prisma.profile.findUnique({ where: { slug: candidate } })
    return Boolean(profile)
  })

  const passwordHash = await bcrypt.hash(input.password, 12)

  const user = await app.prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      profile: {
        create: {
          name: input.name,
          slug,
          city: input.city,
          state: input.state.toUpperCase(),
          type: input.type,
          emailContact: input.email,
        },
      },
    },
    include: {
      profile: true,
    },
  })

  await triggerWelcomeWebhook({
    name: user.profile?.name ?? input.name,
    email: user.email,
    profileSlug: user.profile?.slug ?? slug,
  })

  return issueAuthTokens(app, user)
}

export async function loginUser(app: FastifyInstance, input: z.infer<typeof loginSchema>) {
  const user = await app.prisma.user.findUnique({
    where: { email: input.email },
    include: { profile: true },
  })

  if (!user) {
    throw new Error('Email ou senha inválidos.')
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash)
  if (!ok) {
    throw new Error('Email ou senha inválidos.')
  }

  return issueAuthTokens(app, user)
}

export async function refreshSession(app: FastifyInstance, refreshToken: string) {
  const tokenHash = hashValue(refreshToken)
  const found = await app.prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  })

  if (!found || found.revokedAt || found.expiresAt < new Date()) {
    throw new Error('Refresh token inválido ou expirado.')
  }

  await app.prisma.refreshToken.update({
    where: { id: found.id },
    data: { revokedAt: new Date() },
  })

  return issueAuthTokens(app, found.user)
}
