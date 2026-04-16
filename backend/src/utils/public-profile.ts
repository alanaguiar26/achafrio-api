import type { Profile, ProfileCity, Photo, Review, Specialty } from '../generated/prisma/client.js'
import { PLAN_LIMITS } from './plans.js'

type ProfileWithRelations = Profile & {
  cities: ProfileCity[]
  photos: Photo[]
  reviews: Review[]
  specialties: Array<{
    specialty: Specialty
  }>
}

export function toPublicProfile(profile: ProfileWithRelations) {
  const limits = PLAN_LIMITS[profile.plan]
  return {
    id: profile.id,
    type: profile.type,
    name: profile.name,
    slug: profile.slug,
    bio: profile.bio,
    city: profile.city,
    state: profile.state,
    avatarUrl: profile.avatarUrl,
    plan: profile.plan,
    verified: profile.verified,
    featured: profile.featured,
    averageRating: profile.averageRating,
    reviewsCount: profile.reviewsCount,
    viewsCount: profile.viewsCount,
    specialties: profile.specialties.map((item) => item.specialty),
    cities: profile.cities,
    photos: profile.photos,
    reviews: profile.reviews,
    contact: limits.showContact
      ? {
          phone: profile.phone,
          whatsapp: profile.whatsapp,
          emailContact: profile.emailContact,
          website: profile.website,
        }
      : null,
  }
}
