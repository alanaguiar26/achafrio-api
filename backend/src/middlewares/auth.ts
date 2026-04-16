import type { FastifyReply, FastifyRequest } from 'fastify'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Não autenticado.' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    if (request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso restrito ao admin.' })
    }
  } catch {
    return reply.status(401).send({ error: 'Não autenticado.' })
  }
}
