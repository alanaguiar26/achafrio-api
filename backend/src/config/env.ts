import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  APP_NAME: z.string().default('AchaFrio'),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),

  ASAAS_API_URL: z.string().url().default('https://api-sandbox.asaas.com/v3'),
  ASAAS_API_KEY: z.string().optional().default(''),
  ASAAS_WEBHOOK_TOKEN: z.string().optional().default(''),

  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM: z.string().default('nao-responder@achafrio.com.br'),

  N8N_WEBHOOK_WELCOME: z.string().optional().default(''),
  N8N_WEBHOOK_REVIEW_REQUEST: z.string().optional().default(''),
  N8N_WEBHOOK_NEW_QUOTE: z.string().optional().default(''),
  N8N_WEBHOOK_ADMIN_VERIFICATION: z.string().optional().default(''),
  N8N_WEBHOOK_PROFILE_VERIFIED: z.string().optional().default(''),
  N8N_WEBHOOK_BILLING_STATUS: z.string().optional().default(''),
})

export const env = envSchema.parse(process.env)
