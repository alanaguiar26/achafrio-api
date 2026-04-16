import slugify from 'slugify'

export function slugifyProfileName(value: string) {
  return slugify(value, {
    lower: true,
    strict: true,
    trim: true,
    locale: 'pt',
  })
}

export async function generateUniqueSlug(baseName: string, exists: (slug: string) => Promise<boolean>) {
  const base = slugifyProfileName(baseName)
  let candidate = base || 'perfil'
  let suffix = 2

  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}
