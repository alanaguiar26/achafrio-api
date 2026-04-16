import type { FastifyReply } from 'fastify'

export function sendValidationError(reply: FastifyReply, error: unknown, fallback = 'Dados inválidos.') {
  if (error instanceof Error) {
    return reply.status(400).send({ error: error.message })
  }
  return reply.status(400).send({ error: fallback })
}
