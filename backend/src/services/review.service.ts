import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { ReviewChannel, ReviewStatus } from '../generated/prisma/client.js'
import { PLAN_LIMITS } from '../utils/plans.js'
import { hashValue, randomToken } from '../utils/security.js'
import { triggerReviewRequestWebhook } from './notification.service.js'
import { sendReviewRequestEmail } from './email.service.js'
import { env } from '../config/env.js'

export const requestReviewSchema = z.object({
  clientName: z.string().min(2),
  clientContact: z.string().min(5),
  channel: z.nativeEnum(ReviewChannel),
})

export const submitReviewSchema = z.object({
  token: z.string().min(10),
  reviewerName: z.string().min(2),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
})

export async function requestReview(app: FastifyInstance, userId: string, input: z.infer<typeof requestReviewSchema>) {
  const profile = await app.prisma.profile.findFirst({ where: { userId } })
  if (!profile) throw new Error('Perfil não encontrado.')
  if (!PLAN_LIMITS[profile.plan].canRequestReview) throw new Error('Seu plano atual não permite solicitar avaliações.')

  const tokenValue = randomToken(24)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

  const token = await app.prisma.reviewToken.create({
    data: {
      profileId: profile.id,
      token: tokenValue,
      channel: input.channel,
      clientName: input.clientName,
      clientContact: input.clientContact,
      requestedById: userId,
      expiresAt,
    },
  })

  const reviewUrl = `${env.FRONTEND_URL}/avaliar/${token.token}`

  if (input.channel === ReviewChannel.WHATSAPP) {
    await triggerReviewRequestWebhook({
      profileName: profile.name,
      profileSlug: profile.slug,
      clientName: input.clientName,
      clientContact: input.clientContact,
      reviewToken: token.token,
      reviewUrl,
    })
  } else {
    await sendReviewRequestEmail({ to: input.clientContact, profileName: profile.name, reviewUrl, clientName: input.clientName })
  }

  return { ok: true, token: token.token, expiresAt, reviewUrl }
}

export async function getReviewTokenInfo(app: FastifyInstance, tokenValue: string) {
  const token = await app.prisma.reviewToken.findUnique({ where: { token: tokenValue }, include: { profile: true } })
  if (!token) throw new Error('Link de avaliação inválido.')
  if (token.usedAt) throw new Error('Este link de avaliação já foi usado.')
  if (token.expiresAt < new Date()) throw new Error('Este link de avaliação expirou.')

  return {
    token: token.token,
    clientName: token.clientName,
    profile: { name: token.profile.name, slug: token.profile.slug, avatarUrl: token.profile.avatarUrl },
    expiresAt: token.expiresAt,
  }
}

export async function submitReview(app: FastifyInstance, input: z.infer<typeof submitReviewSchema>, ip?: string) {
  const token = await app.prisma.reviewToken.findUnique({ where: { token: input.token }, include: { profile: true } })
  if (!token) throw new Error('Link de avaliação inválido.')
  if (token.usedAt) throw new Error('Este link de avaliação já foi usado.')
  if (token.expiresAt < new Date()) throw new Error('Este link de avaliação expirou.')

  const review = await app.prisma.review.create({
    data: {
      profileId: token.profileId,
      tokenId: token.id,
      reviewerName: input.reviewerName,
      rating: input.rating,
      comment: input.comment ?? null,
      ipHash: ip ? hashValue(ip) : null,
      status: ReviewStatus.PENDING,
    },
  })

  await app.prisma.reviewToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })
  return review
}

export async function moderateReview(app: FastifyInstance, reviewId: string, status: ReviewStatus) {
  const review = await app.prisma.review.findUnique({ where: { id: reviewId } })
  if (!review) throw new Error('Avaliação não encontrada.')

  await app.prisma.review.update({ where: { id: reviewId }, data: { status, approvedAt: status === ReviewStatus.APPROVED ? new Date() : null } })

  const approvedReviews = await app.prisma.review.findMany({ where: { profileId: review.profileId, status: ReviewStatus.APPROVED }, select: { rating: true } })
  const reviewsCount = approvedReviews.length
  const averageRating = reviewsCount ? approvedReviews.reduce((acc, item) => acc + item.rating, 0) / reviewsCount : 0

  await app.prisma.profile.update({ where: { id: review.profileId }, data: { reviewsCount, averageRating } })
  return { ok: true }
}
