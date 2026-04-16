import axios from 'axios'
import type { FastifyInstance } from 'fastify'
import { Plan, PaymentStatus, SubscriptionStatus } from '../generated/prisma/client.js'
import { env } from '../config/env.js'
import { PLAN_LIMITS } from '../utils/plans.js'
import { triggerBillingStatusWebhook } from './notification.service.js'

const asaas = axios.create({
  baseURL: env.ASAAS_API_URL,
  headers: {
    access_token: env.ASAAS_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

export async function ensureAsaasCustomer(app: FastifyInstance, profileId: string) {
  const profile = await app.prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile) throw new Error('Perfil não encontrado.')
  if (profile.asaasCustomerId) return profile.asaasCustomerId

  const response = await asaas.post('/customers', {
    name: profile.name,
    email: profile.emailContact,
    mobilePhone: profile.whatsapp ?? profile.phone,
    phone: profile.phone,
    cpfCnpj: profile.cpfCnpj,
    postalCode: profile.zipCode,
    address: profile.address,
    province: profile.city,
    externalReference: profile.id,
  })

  const asaasCustomerId = response.data.id as string
  await app.prisma.profile.update({ where: { id: profile.id }, data: { asaasCustomerId } })
  return asaasCustomerId
}

export async function createCheckout(app: FastifyInstance, profileId: string, plan: Plan, billingType: 'PIX' | 'BOLETO' = 'PIX') {
  if (plan === Plan.FREE) throw new Error('O plano FREE não precisa de checkout.')

  const profile = await app.prisma.profile.findUnique({ where: { id: profileId }, include: { subscription: true } })
  if (!profile) throw new Error('Perfil não encontrado.')

  const customerId = await ensureAsaasCustomer(app, profileId)
  const price = PLAN_LIMITS[plan].price
  const nextDueDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().slice(0, 10)

  const response = await asaas.post('/subscriptions', {
    customer: customerId,
    billingType,
    value: price,
    cycle: 'MONTHLY',
    nextDueDate,
    description: `Assinatura ${plan} - AchaFrio`,
    externalReference: profileId,
  })

  const subscriptionId = response.data.id as string
  const paymentsResponse = await asaas.get(`/subscriptions/${subscriptionId}/payments`)
  const firstPayment = paymentsResponse.data?.data?.[0] ?? null

  const subscription = await app.prisma.subscription.upsert({
    where: { profileId },
    update: {
      plan,
      status: SubscriptionStatus.PENDING,
      asaasSubscriptionId: subscriptionId,
      asaasCustomerId: customerId,
      nextDueDate: firstPayment?.dueDate ? new Date(firstPayment.dueDate) : undefined,
    },
    create: {
      profileId,
      plan,
      status: SubscriptionStatus.PENDING,
      asaasSubscriptionId: subscriptionId,
      asaasCustomerId: customerId,
      nextDueDate: firstPayment?.dueDate ? new Date(firstPayment.dueDate) : undefined,
    },
  })

  if (firstPayment?.id) {
    await app.prisma.payment.upsert({
      where: { asaasPaymentId: firstPayment.id },
      update: {
        invoiceUrl: firstPayment.invoiceUrl ?? null,
        billingType: firstPayment.billingType ?? billingType,
        amount: Number(firstPayment.value ?? price),
        dueDate: firstPayment.dueDate ? new Date(firstPayment.dueDate) : null,
        status: PaymentStatus.PENDING,
      },
      create: {
        subscriptionId: subscription.id,
        asaasPaymentId: firstPayment.id,
        invoiceUrl: firstPayment.invoiceUrl ?? null,
        billingType: firstPayment.billingType ?? billingType,
        amount: Number(firstPayment.value ?? price),
        dueDate: firstPayment.dueDate ? new Date(firstPayment.dueDate) : null,
        status: PaymentStatus.PENDING,
        externalReference: profileId,
      },
    })
  }

  return { subscriptionId, invoiceUrl: firstPayment?.invoiceUrl ?? null, pixQrCode: firstPayment?.pixTransaction?.payload ?? null, paymentId: firstPayment?.id ?? null }
}

export async function getMyBilling(app: FastifyInstance, profileId: string) {
  return app.prisma.subscription.findUnique({ where: { profileId }, include: { payments: { orderBy: { createdAt: 'desc' }, take: 12 } } })
}

export async function handleAsaasWebhook(app: FastifyInstance, payload: any, webhookToken?: string) {
  if (env.ASAAS_WEBHOOK_TOKEN && webhookToken !== env.ASAAS_WEBHOOK_TOKEN) {
    throw new Error('Webhook Asaas inválido.')
  }

  const eventId = `${payload.event}:${payload.payment?.id ?? payload.id ?? payload.subscription?.id ?? 'unknown'}`
  const exists = await app.prisma.webhookEvent.findUnique({ where: { eventKey: eventId } })
  if (exists) return { ok: true, duplicated: true }

  await app.prisma.webhookEvent.create({ data: { provider: 'asaas', eventKey: eventId, payload: JSON.stringify(payload) } })

  const payment = payload.payment ?? payload
  const externalReference = payment.externalReference || payload.externalReference || payment.subscription
  if (!externalReference) return { ok: true, ignored: true }

  let subscription = await app.prisma.subscription.findFirst({
    where: { OR: [{ profileId: externalReference }, { asaasSubscriptionId: payment.subscription ?? undefined }] },
    include: { profile: true },
  })

  if (!subscription && payload.subscription?.externalReference) {
    subscription = await app.prisma.subscription.findFirst({ where: { profileId: payload.subscription.externalReference }, include: { profile: true } })
  }

  if (!subscription) return { ok: true, ignored: true }

  const nextPaymentStatus = mapPaymentStatus(payload.event)
  const nextSubscriptionStatus = mapSubscriptionStatus(payload.event)

  if (payment.id) {
    await app.prisma.payment.upsert({
      where: { asaasPaymentId: payment.id },
      update: {
        status: nextPaymentStatus ?? PaymentStatus.PENDING,
        invoiceUrl: payment.invoiceUrl ?? null,
        billingType: payment.billingType ?? null,
        amount: Number(payment.value ?? 0),
        paidAt: payment.clientPaymentDate ? new Date(payment.clientPaymentDate) : null,
        dueDate: payment.dueDate ? new Date(payment.dueDate) : null,
      },
      create: {
        subscriptionId: subscription.id,
        asaasPaymentId: payment.id,
        invoiceUrl: payment.invoiceUrl ?? null,
        billingType: payment.billingType ?? null,
        amount: Number(payment.value ?? 0),
        status: nextPaymentStatus ?? PaymentStatus.PENDING,
        paidAt: payment.clientPaymentDate ? new Date(payment.clientPaymentDate) : null,
        dueDate: payment.dueDate ? new Date(payment.dueDate) : null,
        externalReference: subscription.profileId,
      },
    })
  }

  if (nextSubscriptionStatus) {
    await app.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: nextSubscriptionStatus, nextDueDate: payment.dueDate ? new Date(payment.dueDate) : undefined },
    })

    await app.prisma.profile.update({ where: { id: subscription.profileId }, data: { plan: nextSubscriptionStatus === SubscriptionStatus.ACTIVE ? subscription.plan : Plan.FREE } })
  }

  await triggerBillingStatusWebhook({
    profileId: subscription.profileId,
    plan: subscription.plan,
    subscriptionStatus: nextSubscriptionStatus ?? subscription.status,
    paymentStatus: nextPaymentStatus ?? undefined,
    invoiceUrl: payment.invoiceUrl ?? undefined,
  })

  return { ok: true }
}

function mapPaymentStatus(event: string): PaymentStatus | null {
  switch (event) {
    case 'PAYMENT_CREATED': return PaymentStatus.PENDING
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED': return PaymentStatus.RECEIVED
    case 'PAYMENT_OVERDUE': return PaymentStatus.OVERDUE
    case 'PAYMENT_REFUNDED': return PaymentStatus.REFUNDED
    case 'PAYMENT_DELETED': return PaymentStatus.DELETED
    default: return null
  }
}

function mapSubscriptionStatus(event: string): SubscriptionStatus | null {
  switch (event) {
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED': return SubscriptionStatus.ACTIVE
    case 'PAYMENT_OVERDUE': return SubscriptionStatus.PAST_DUE
    case 'PAYMENT_DELETED': return SubscriptionStatus.CANCELLED
    default: return null
  }
}
