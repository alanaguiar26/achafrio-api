import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { PLAN_LIMITS } from '../utils/plans.js'
import { QuoteStatus } from '../generated/prisma/client.js'
import { triggerNewQuoteWebhook } from './notification.service.js'

export const createQuoteSchema = z.object({
  profileId: z.string().min(5),
  clientName: z.string().min(2),
  clientPhone: z.string().min(8),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientCity: z.string().min(2),
  clientState: z.string().min(2).max(2),
  serviceType: z.string().max(120).optional(),
  description: z.string().min(10).max(4000),
})

export async function createQuote(app: FastifyInstance, input: z.infer<typeof createQuoteSchema>) {
  const profile = await app.prisma.profile.findUnique({ where: { id: input.profileId } })
  if (!profile) throw new Error('Perfil não encontrado.')
  if (!PLAN_LIMITS[profile.plan].canReceiveQuotes) throw new Error('Este perfil não recebe orçamentos pelo site.')

  const quote = await app.prisma.quote.create({
    data: {
      profileId: input.profileId,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      clientEmail: input.clientEmail || null,
      clientCity: input.clientCity,
      clientState: input.clientState.toUpperCase(),
      serviceType: input.serviceType ?? null,
      description: input.description,
    },
  })

  await triggerNewQuoteWebhook({
    profileId: profile.id,
    profileName: profile.name,
    clientName: quote.clientName,
    clientPhone: quote.clientPhone,
    clientCity: `${quote.clientCity}/${quote.clientState}`,
    description: quote.description,
    quoteId: quote.id,
  })

  return quote
}

export async function getMyQuotes(app: FastifyInstance, userId: string) {
  const profile = await app.prisma.profile.findFirst({ where: { userId } })
  if (!profile) throw new Error('Perfil não encontrado.')

  return app.prisma.quote.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: 'desc' } })
}

export async function updateQuoteStatus(app: FastifyInstance, userId: string, quoteId: string, status: QuoteStatus) {
  const profile = await app.prisma.profile.findFirst({ where: { userId } })
  if (!profile) throw new Error('Perfil não encontrado.')

  const quote = await app.prisma.quote.findFirst({ where: { id: quoteId, profileId: profile.id } })
  if (!quote) throw new Error('Lead não encontrado.')

  return app.prisma.quote.update({ where: { id: quote.id }, data: { status } })
}
