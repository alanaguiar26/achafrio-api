import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../middlewares/auth.js'
import { deletePhoto, getOwnProfile, getPublicProfile, listProfiles, searchProfilesSchema, submitVerification, updateOwnProfile, updateProfileSchema, uploadAvatar, uploadPhotos } from '../../services/profile.service.js'
import { sendValidationError } from '../../utils/http.js'
import { hashValue } from '../../utils/security.js'

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get('/list', async (request, reply) => {
    try {
      const query = searchProfilesSchema.parse(request.query)
      return await listProfiles(app, query)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.get('/public/:slug', async (request, reply) => {
    try {
      const params = request.params as { slug: string }
      const ip = request.ip ? hashValue(request.ip) : null
      return await getPublicProfile(app, params.slug, ip)
    } catch (error) {
      return sendValidationError(reply, error, 'Perfil não encontrado.')
    }
  })

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    try {
      return await getOwnProfile(app, request.user.userId)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.put('/me', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const input = updateProfileSchema.parse(request.body)
      return await updateOwnProfile(app, request.user.userId, input)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.post('/me/avatar', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const file = await request.file()
      if (!file) return reply.status(400).send({ error: 'Arquivo não enviado.' })
      const buffer = await file.toBuffer()
      return await uploadAvatar(app, request.user.userId, buffer)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.post('/me/photos', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const parts = request.files()
      const buffers: Buffer[] = []
      for await (const part of parts) {
        if (part.type === 'file') buffers.push(await part.toBuffer())
      }
      if (!buffers.length) return reply.status(400).send({ error: 'Nenhuma foto enviada.' })
      return await uploadPhotos(app, request.user.userId, buffers)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.delete('/me/photos/:photoId', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const params = request.params as { photoId: string }
      return await deletePhoto(app, request.user.userId, params.photoId)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })

  app.post('/me/verification', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const parts = request.parts()
      let documentBuffer: Buffer | undefined
      let selfieBuffer: Buffer | undefined
      for await (const part of parts) {
        if (part.type !== 'file') continue
        if (part.fieldname === 'document') documentBuffer = await part.toBuffer()
        if (part.fieldname === 'selfie') selfieBuffer = await part.toBuffer()
      }
      if (!documentBuffer) return reply.status(400).send({ error: 'Documento é obrigatório.' })
      return await submitVerification(app, request.user.userId, documentBuffer, selfieBuffer)
    } catch (error) {
      return sendValidationError(reply, error)
    }
  })
}
