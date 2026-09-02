import { prisma } from './db'
import { getStripe } from './stripe'

/** Fields that belonged to a Stripe customer on another account (test/old live). */
export const STALE_STRIPE_CUSTOMER_CLEAR = {
  stripeCustomerId: null,
  stripeDefaultPmId: null,
  stripeSubscriptionId: null,
  cardBrand: null,
  cardLast4: null,
} as const

/** True when this Stripe account does not have the stored customer id. */
export function isStaleStripeCustomerError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const rec = err as { code?: string; message?: string }
  const message = String(rec.message || '')
  if (rec.code === 'resource_missing' && /customer/i.test(message)) return true
  return /no such customer/i.test(message)
}

/** Ensure Stripe Customer exists for org; return customer id. */
export async function ensureStripeCustomer(
  org: {
    id: string
    name: string
    slug: string
    stripeCustomerId: string | null
  },
  email?: string | null,
): Promise<string> {
  const stripe = getStripe()
  if (org.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(org.stripeCustomerId)
      if (!('deleted' in existing && existing.deleted)) {
        return org.stripeCustomerId
      }
    } catch (err) {
      if (!isStaleStripeCustomerError(err)) throw err
    }
    // Test-mode / previous-account id — drop it and create on the current keys.
    await prisma.org.update({
      where: { id: org.id },
      data: { ...STALE_STRIPE_CUSTOMER_CLEAR },
    })
  }
  const customer = await stripe.customers.create({
    name: org.name,
    email: email || undefined,
    metadata: { orgId: org.id, orgSlug: org.slug },
  })
  await prisma.org.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  })
  return customer.id
}

export async function syncCardFromCustomer(orgId: string, customerId: string) {
  const stripe = getStripe()
  let customer
  try {
    customer = await stripe.customers.retrieve(customerId)
  } catch (err) {
    if (!isStaleStripeCustomerError(err)) throw err
    await prisma.org.update({
      where: { id: orgId },
      data: { ...STALE_STRIPE_CUSTOMER_CLEAR },
    })
    return null
  }
  if ('deleted' in customer && customer.deleted) {
    await prisma.org.update({
      where: { id: orgId },
      data: { ...STALE_STRIPE_CUSTOMER_CLEAR },
    })
    return null
  }
  const defaultPm =
    typeof customer.invoice_settings?.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : null

  let pmId = defaultPm
  if (!pmId) {
    const list = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 1,
    })
    pmId = list.data[0]?.id ?? null
  }
  if (!pmId) {
    await prisma.org.update({
      where: { id: orgId },
      data: {
        stripeDefaultPmId: null,
        cardBrand: null,
        cardLast4: null,
      },
    })
    return null
  }

  const pm = await stripe.paymentMethods.retrieve(pmId)
  const brand = pm.card?.brand || 'card'
  const last4 = pm.card?.last4 || '0000'
  await prisma.org.update({
    where: { id: orgId },
    data: {
      stripeDefaultPmId: pmId,
      cardBrand: brand.charAt(0).toUpperCase() + brand.slice(1),
      cardLast4: last4,
    },
  })
  if (!defaultPm) {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pmId },
    })
  }
  return { brand, last4, pmId }
}
