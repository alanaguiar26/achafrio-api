import { Resend } from 'resend'
import { env } from '../config/env.js'

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

async function safeEmail(subject: string, to: string, html: string) {
  if (!resend) {
    console.info(`[Email mock] ${subject} → ${to}`)
    return
  }

  await resend.emails.send({
    from: env.RESEND_FROM,
    to,
    subject,
    html,
  })
}

export async function sendReviewRequestEmail(params: { to: string; clientName?: string; profileName: string; reviewUrl: string }) {
  const greeting = params.clientName ? `Olá, ${params.clientName}!` : 'Olá!'
  return safeEmail(
    `Avalie o atendimento de ${params.profileName}`,
    params.to,
    `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:18px">
        <h1 style="margin-top:0;color:#0f172a">❄️ AchaFrio</h1>
        <p style="color:#334155">${greeting}</p>
        <p style="color:#334155">O profissional <strong>${params.profileName}</strong> pediu sua opinião sobre o atendimento prestado.</p>
        <p style="color:#334155">Sua avaliação ajuda outros clientes a escolher melhor e aumenta a confiança no marketplace.</p>
        <p><a href="${params.reviewUrl}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">Avaliar agora</a></p>
        <p style="color:#64748b;font-size:14px">Este link expira em 7 dias.</p>
      </div>
    `
  )
}
