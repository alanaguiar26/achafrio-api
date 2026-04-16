import { mkdirSync, cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const source = resolve('src/generated')
const target = resolve('dist/generated')

if (existsSync(source)) {
  mkdirSync(target, { recursive: true })
  cpSync(source, target, { recursive: true })
  console.log('Copied Prisma generated client to dist/generated')
} else {
  console.warn('No generated client found at src/generated')
}
