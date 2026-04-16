import { Plan } from '../generated/prisma/client.js'

export const PLAN_LIMITS = {
  [Plan.FREE]: {
    photos: 0,
    specialties: 2,
    cities: 1,
    showContact: false,
    canRequestReview: false,
    canReceiveQuotes: false,
    canRequestVerification: false,
    featuredLabel: 'Grátis',
    price: 0,
  },
  [Plan.STARTER]: {
    photos: 5,
    specialties: 5,
    cities: 3,
    showContact: true,
    canRequestReview: true,
    canReceiveQuotes: false,
    canRequestVerification: true,
    featuredLabel: 'Starter',
    price: 39.9,
  },
  [Plan.PRO]: {
    photos: 15,
    specialties: 15,
    cities: 10,
    showContact: true,
    canRequestReview: true,
    canReceiveQuotes: true,
    canRequestVerification: true,
    featuredLabel: 'Pro',
    price: 79.9,
  },
  [Plan.PREMIUM]: {
    photos: 999,
    specialties: 999,
    cities: 999,
    showContact: true,
    canRequestReview: true,
    canReceiveQuotes: true,
    canRequestVerification: true,
    featuredLabel: 'Premium',
    price: 149.9,
  },
} as const

export function ensurePlanLimit(kind: 'photos' | 'specialties' | 'cities', plan: Plan, currentCount: number, increment = 1) {
  const limit = PLAN_LIMITS[plan][kind]
  if (currentCount + increment > limit) {
    throw new Error(`Limite do plano excedido para ${kind}.`)
  }
}

export function profileRank(plan: Plan, verified: boolean, averageRating: number, viewsCount: number, createdAt: Date) {
  const planScore = {
    [Plan.PREMIUM]: 400,
    [Plan.PRO]: 300,
    [Plan.STARTER]: 200,
    [Plan.FREE]: 100,
  }[plan]

  const verifiedScore = verified ? 40 : 0
  const ratingScore = Math.round(averageRating * 10)
  const viewsScore = Math.min(viewsCount, 100)
  const freshnessScore = Math.max(0, 30 - Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))

  return planScore + verifiedScore + ratingScore + viewsScore + freshnessScore
}
