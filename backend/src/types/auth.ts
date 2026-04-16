import type { Role, Plan, ProfileType } from '../generated/prisma/client.js'

export interface AuthUser {
  sub: string
  userId: string
  profileId?: string
  role: Role
  plan?: Plan
  type?: ProfileType
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser
    user: AuthUser
  }
}
