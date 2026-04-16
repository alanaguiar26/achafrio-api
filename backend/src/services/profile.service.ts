import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { Plan, ReviewStatus, Role, VerificationStatus } from '../generated/prisma/client.js'
import { generateUniqueSlug } from '../utils/slug.js'
import { ensurePlanLimit, profileRank } from '../utils/plans.js'
import { saveWebpBuffer, deleteRelativeFile } from '../utils/storage.js'
import { randomToken } from '../utils/security.js'
import { toPublicProfile } from '../utils/public-profile.js'
import { triggerAdminVerificationWebhook, triggerVerificationDecisionWebhook } from './notification.service.js'

export const updateProfileSchema = z.object({
  name: z.string().min(3),
  bio: z.string().max(3000).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  emailContact: z.string().email().optional().nullable(),
  website: z.string().url().optional().nullable(),
  city: z.string().min(2),
  state: z.string().min(2).max(2),
  zipCode: z.string().max(20).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  specialties: z.array(z.string()).max(30).optional().default([]),
  cities: z.array(z.object({ city: z.string().min(2), state: z.string().min(2).max(2) })).max(100).optional().default([]),
})

export const searchProfilesSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  specialty: z.string().optional(),
  verified: z.coerce.boolean().optional(),
  type: z.enum(['TECNICO', 'EMPRESA']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(48).default(12),
})

export async function getPublicProfile(app: FastifyInstance, slug: string, ipHash?: string | null) {
  const profile = await app.prisma.profile.findFirst({
    where: { slug, active: true, user: { role: Role.USER } },
    include: {
      cities: true,
      photos: { orderBy: { sortOrder: 'asc' } },
      specialties: { include: { specialty: true } },
      reviews: { where: { status: ReviewStatus.APPROVED }, orderBy: { createdAt: 'desc' }, take: 12 },
    },
  })

  if (!profile) throw new Error('Perfil não encontrado.')

  await app.prisma.profileView.create({
    data: { profileId: profile.id, ipHash: ipHash ?? undefined },
  })

  await app.prisma.profile.update({
    where: { id: profile.id },
    data: { viewsCount: { increment: 1 } },
  })

  return toPublicProfile({ ...profile, viewsCount: profile.viewsCount + 1 })
}

export async function listProfiles(app: FastifyInstance, query: z.infer<typeof searchProfilesSchema>) {
  const where = {
    active: true,
    user: { role: Role.USER },
    ...(query.city ? { city: { contains: query.city, mode: 'insensitive' as const } } : {}),
    ...(query.state ? { state: query.state.toUpperCase() } : {}),
    ...(typeof query.verified === 'boolean' ? { verified: query.verified } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' as const } }, { bio: { contains: query.q, mode: 'insensitive' as const } }] } : {}),
    ...(query.specialty ? {
      specialties: {
        some: {
          OR: [
            { specialty: { slug: query.specialty } },
            { specialty: { name: { contains: query.specialty, mode: 'insensitive' as const } } },
          ],
        },
      },
    } : {}),
  }

  const all = await app.prisma.profile.findMany({
    where,
    include: {
      cities: true,
      photos: { take: 1, orderBy: { sortOrder: 'asc' } },
      specialties: { include: { specialty: true } },
      reviews: { where: { status: ReviewStatus.APPROVED }, orderBy: { createdAt: 'desc' }, take: 3 },
    },
  })

  const sorted = all.sort((a, b) => {
    const ar = profileRank(a.plan, a.verified, a.averageRating, a.viewsCount, a.createdAt)
    const br = profileRank(b.plan, b.verified, b.averageRating, b.viewsCount, b.createdAt)
    return br - ar
  })

  const start = (query.page - 1) * query.limit
  const data = sorted.slice(start, start + query.limit).map((profile) => toPublicProfile(profile as any))

  return { page: query.page, limit: query.limit, total: sorted.length, data }
}

export async function getOwnProfile(app: FastifyInstance, userId: string) {
  const profile = await app.prisma.profile.findFirst({
    where: { userId },
    include: {
      cities: true,
      photos: { orderBy: { sortOrder: 'asc' } },
      specialties: { include: { specialty: true } },
      reviews: { orderBy: { createdAt: 'desc' }, take: 20 },
      verificationDocuments: { orderBy: { createdAt: 'desc' }, take: 10 },
      subscription: { include: { payments: { orderBy: { createdAt: 'desc' }, take: 12 } } },
      quotes: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })

  if (!profile) throw new Error('Perfil não encontrado.')
  return profile
}

export async function updateOwnProfile(app: FastifyInstance, userId: string, input: z.infer<typeof updateProfileSchema>) {
  const current = await app.prisma.profile.findFirst({ where: { userId }, include: { specialties: true, cities: true } })
  if (!current) throw new Error('Perfil não encontrado.')

  ensurePlanLimit('specialties', current.plan, 0, input.specialties.length)
  ensurePlanLimit('cities', current.plan, 0, input.cities.length)

  const slug = input.name !== current.name
    ? await generateUniqueSlug(input.name, async (candidate) => {
        const profile = await app.prisma.profile.findUnique({ where: { slug: candidate } })
        return Boolean(profile && profile.id !== current.id)
      })
    : current.slug

  await app.prisma.$transaction([
    app.prisma.profile.update({
      where: { id: current.id },
      data: {
        name: input.name,
        slug,
        bio: input.bio ?? null,
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        emailContact: input.emailContact ?? null,
        website: input.website ?? null,
        city: input.city,
        state: input.state.toUpperCase(),
        zipCode: input.zipCode ?? null,
        address: input.address ?? null,
      },
    }),
    app.prisma.profileSpecialty.deleteMany({ where: { profileId: current.id } }),
    app.prisma.profileCity.deleteMany({ where: { profileId: current.id } }),
  ])

  if (input.specialties.length) {
    const specialties = await app.prisma.specialty.findMany({ where: { id: { in: input.specialties } } })
    await app.prisma.profileSpecialty.createMany({
      data: specialties.map((item) => ({ profileId: current.id, specialtyId: item.id })),
    })
  }

  if (input.cities.length) {
    await app.prisma.profileCity.createMany({
      data: input.cities.map((item) => ({ profileId: current.id, city: item.city, state: item.state.toUpperCase() })),
    })
  }

  return getOwnProfile(app, userId)
}

export async function uploadAvatar(app: FastifyInstance, userId: string, buffer: Buffer) {
  const profile = await app.prisma.profile.findFirst({ where: { userId } })
  if (!profile) throw new Error('Perfil não encontrado.')

  const filename = `${profile.id}-${randomToken(8)}`
  const url = await saveWebpBuffer(buffer, 'avatars', filename, 600)
  await deleteRelativeFile(profile.avatarUrl)

  return app.prisma.profile.update({ where: { id: profile.id }, data: { avatarUrl: url } })
}

export async function uploadPhotos(app: FastifyInstance, userId: string, files: Buffer[]) {
  const profile = await app.prisma.profile.findFirst({ where: { userId }, include: { photos: true } })
  if (!profile) throw new Error('Perfil não encontrado.')

  ensurePlanLimit('photos', profile.plan, profile.photos.length, files.length)

  const created = []
  let currentOrder = profile.photos.length

  for (const fileBuffer of files) {
    const filename = `${profile.id}-${randomToken(8)}`
    const url = await saveWebpBuffer(fileBuffer, 'gallery', filename, 1600)
    const photo = await app.prisma.photo.create({ data: { profileId: profile.id, url, sortOrder: currentOrder } })
    currentOrder += 1
    created.push(photo)
  }

  return created
}

export async function deletePhoto(app: FastifyInstance, userId: string, photoId: string) {
  const profile = await app.prisma.profile.findFirst({ where: { userId } })
  if (!profile) throw new Error('Perfil não encontrado.')

  const photo = await app.prisma.photo.findFirst({ where: { id: photoId, profileId: profile.id } })
  if (!photo) throw new Error('Foto não encontrada.')

  await deleteRelativeFile(photo.url)
  await app.prisma.photo.delete({ where: { id: photo.id } })
  return { ok: true }
}

export async function submitVerification(app: FastifyInstance, userId: string, documentBuffer: Buffer, selfieBuffer?: Buffer) {
  const profile = await app.prisma.profile.findFirst({ where: { userId } })
  if (!profile) throw new Error('Perfil não encontrado.')
  if (profile.plan === Plan.FREE) throw new Error('Seu plano atual não permite solicitar verificação.')

  const base = `${profile.id}-${randomToken(8)}`
  const documentUrl = await saveWebpBuffer(documentBuffer, 'verification', `${base}-documento`, 1800)
  const selfieUrl = selfieBuffer ? await saveWebpBuffer(selfieBuffer, 'verification', `${base}-selfie`, 1800) : null

  const verification = await app.prisma.verificationDoc.create({
    data: { profileId: profile.id, documentUrl, selfieUrl, status: VerificationStatus.PENDING },
  })

  await triggerAdminVerificationWebhook({ profileId: profile.id, profileName: profile.name, profileSlug: profile.slug })
  return verification
}

export async function reviewVerification(app: FastifyInstance, id: string, status: VerificationStatus, adminNote?: string) {
  const doc = await app.prisma.verificationDoc.findUnique({ where: { id }, include: { profile: true } })
  if (!doc) throw new Error('Solicitação não encontrada.')

  const reviewedAt = new Date()

  await app.prisma.$transaction([
    app.prisma.verificationDoc.update({ where: { id }, data: { status, adminNote: adminNote ?? null, reviewedAt } }),
    app.prisma.profile.update({ where: { id: doc.profileId }, data: { verified: status === VerificationStatus.APPROVED, verifiedAt: status === VerificationStatus.APPROVED ? reviewedAt : null } }),
  ])

  await triggerVerificationDecisionWebhook({ profileId: doc.profileId, profileName: doc.profile.name, status, reason: adminNote ?? undefined })
  return { ok: true }
}
