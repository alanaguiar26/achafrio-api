import crypto from 'node:crypto'

export function hashValue(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function randomToken(length = 32) {
  return crypto.randomBytes(length).toString('hex')
}
