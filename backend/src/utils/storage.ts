import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { env } from '../config/env.js'

export async function ensureUploadDir(...segments: string[]) {
  const dir = path.resolve(env.UPLOAD_DIR, ...segments)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function saveWebpBuffer(buffer: Buffer, folder: string, filename: string, width = 1200) {
  const dir = await ensureUploadDir(folder)
  const fullPath = path.join(dir, `${filename}.webp`)

  await sharp(buffer)
    .rotate()
    .resize({ width, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(fullPath)

  return `/uploads/${folder}/${filename}.webp`
}

export async function deleteRelativeFile(relativeUrl?: string | null) {
  if (!relativeUrl) return
  const absolutePath = path.resolve(relativeUrl.replace('/uploads', env.UPLOAD_DIR))
  try {
    await fs.unlink(absolutePath)
  } catch {
  }
}
