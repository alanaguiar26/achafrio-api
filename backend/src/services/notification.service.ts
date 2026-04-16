import axios from 'axios'
import { env } from '../config/env.js'

async function safePost(url: string | undefined, payload: Record<string, unknown>) {
  if (!url) return
  try {
    await axios.post(url, payload, { timeout: 8000 })
  } catch (error) {
    console.error('Falha ao chamar webhook do n8n:', error)
  }
}

export async function triggerWelcomeWebhook(payload: { name: string; email: string; profileSlug: string }) {
  return safePost(env.N8N_WEBHOOK_WELCOME, payload)
}

export async function triggerReviewRequestWebhook(payload: { profileName: string; profileSlug: string; clientName: string; clientContact: string; reviewToken: string; reviewUrl: string }) {
  return safePost(env.N8N_WEBHOOK_REVIEW_REQUEST, payload)
}

export async function triggerNewQuoteWebhook(payload: { profileId: string; profileName: string; clientName: string; clientPhone: string; clientCity: string; description: string; quoteId: string }) {
  return safePost(env.N8N_WEBHOOK_NEW_QUOTE, payload)
}

export async function triggerAdminVerificationWebhook(payload: { profileId: string; profileName: string; profileSlug: string }) {
  return safePost(env.N8N_WEBHOOK_ADMIN_VERIFICATION, payload)
}

export async function triggerVerificationDecisionWebhook(payload: { profileId: string; profileName: string; status: 'APPROVED' | 'REJECTED' | string; reason?: string }) {
  return safePost(env.N8N_WEBHOOK_PROFILE_VERIFIED, payload)
}

export async function triggerBillingStatusWebhook(payload: { profileId: string; plan: string; subscriptionStatus: string; paymentStatus?: string; invoiceUrl?: string }) {
  return safePost(env.N8N_WEBHOOK_BILLING_STATUS, payload)
}
