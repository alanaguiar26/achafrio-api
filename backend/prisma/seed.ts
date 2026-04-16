import bcrypt from 'bcryptjs'
import { PrismaClient, Plan, ProfileType, Role } from '../src/generated/prisma/client.js'
import { slugifyProfileName } from '../src/utils/slug.js'

const prisma = new PrismaClient()

const specialties = [
  'Instalação de split',
  'Manutenção preventiva',
  'Higienização',
  'Conserto e diagnóstico',
  'Refrigeração comercial',
  'VRF e multi split',
  'Câmara fria',
  'PMOC',
]

async function main() {
  for (const item of specialties) {
    await prisma.specialty.upsert({
      where: { slug: slugifyProfileName(item) },
      update: {},
      create: {
        name: item,
        slug: slugifyProfileName(item),
      },
    })
  }

  const passwordHash = await bcrypt.hash('Admin@12345', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@achafrio.com.br' },
    update: {
      passwordHash,
      role: Role.ADMIN,
    },
    create: {
      email: 'admin@achafrio.com.br',
      passwordHash,
      role: Role.ADMIN,
      profile: {
        create: {
          type: ProfileType.EMPRESA,
          name: 'Equipe AchaFrio',
          slug: 'equipe-achafrio',
          city: 'São Paulo',
          state: 'SP',
          plan: Plan.PREMIUM,
          verified: true,
          active: true,
          bio: 'Perfil administrativo e operacional da plataforma AchaFrio.',
          emailContact: 'admin@achafrio.com.br',
        },
      },
    },
    include: { profile: true },
  })

  console.log('Admin seedado:', admin.email)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
