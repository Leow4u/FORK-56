import { prisma } from './db'
import { getStripe } from './stripe'
import {
  customerNeedsPresentmentRotate,
  getStripePresentmentCurrency,
  type PresentmentCurrency,
} from './stripe-presentment'

type OrgCustomer = {
  id: string
  name: string
  slug: string
  stripeCustomerId: string | null
}

/** Ensure Stripe Customer exists for org; return customer id. */
export async function ensureStripeCustomer(
  org: OrgCustomer,
  email?: string | null,
): Promise<string> {
  let customerId = org.stripeCustomerId
  if (!customerId) {
    const stripe = getStripe()
    const customer = await stripe.customers.create({
      name: org.name,
      email: email || undefined,
      metadata: { orgId: org.id, orgSlug: org.slug },
    })
    await prisma.org.update({
      where: { id: org.id },
      data: { stripeCustomerId: customer.id },
    })
    customerId = customer.id
  }
  return reconcileCustomerPresentment(org, customerId, email)
}

/**
 * USD Checkout attempts lock a Customer to USD. Expire leftover open sessions
 * and mint a new Customer when Stripe already set `currency` to something
 * other than presentment (BRL on the BR account).
 */
export async function reconcileCustomerPresentment(
  org: OrgCustomer,
  customerId: string,
  email?: string | null,
  presentment: PresentmentCurrency = getStripePresentmentCurrency(),
): Promise<string> {
  await expireOpenCheckoutSessions(customerId)
  await cancelIncompleteSubscriptions(customerId)

  const stripe = getStripe()
  const customer = await stripe.customers.retrieve(customerId)
  if (!customerNeedsPresentmentRotate(customer, presentment)) {
    return customerId
  }
  return rotateStripeCustomer(org, customerId, email)
}

async function expireOpenCheckoutSessions(customerId: string) {
  const stripe = getStripe()
  let startingAfter: string | undefined
  for (;;) {
    const page = await stripe.checkout.sessions.list({
      customer: customerId,
      status: 'open',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    for (const session of page.data) {
      try {
        await stripe.checkout.sessions.expire(session.id)
      } catch {
        // already expired or completed
      }
    }
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1]?.id
    if (!startingAfter) break
  }
}

async function cancelIncompleteSubscriptions(customerId: string) {
  const stripe = getStripe()
  for (const status of ['incomplete', 'incomplete_expired'] as const) {
    const list = await stripe.subscriptions.list({
      customer: customerId,
      status,
      limit: 100,
    })
    for (const sub of list.data) {
      try {
        await stripe.subscriptions.cancel(sub.id)
      } catch {
        // already canceled
      }
    }
  }
}

export async function rotateStripeCustomer(
  org: OrgCustomer,
  oldCustomerId: string,
  email?: string | null,
): Promise<string> {
  const stripe = getStripe()
  const created = await stripe.customers.create({
    name: org.name,
    email: email || undefined,
    metadata: {
      orgId: org.id,
      orgSlug: org.slug,
      replacedCustomerId: oldCustomerId,
    },
  })

  let pmId: string | null = null
  let brand: string | null = null
  let last4: string | null = null
  try {
    const moved = await moveDefaultCard(oldCustomerId, created.id)
    pmId = moved?.pmId ?? null
    brand = moved?.brand ?? null
    last4 = moved?.last4 ?? null
  } catch {
    // Checkout can collect the card again.
  }

  await prisma.org.update({
    where: { id: org.id },
    data: {
      stripeCustomerId: created.id,
      stripeDefaultPmId: pmId,
      cardBrand: brand,
      cardLast4: last4,
    },
  })
  return created.id
}

async function moveDefaultCard(oldCustomerId: string, newCustomerId: string) {
  const stripe = getStripe()
  const old = await stripe.customers.retrieve(oldCustomerId)
  if (old.deleted) return null
  let pmId =
    typeof old.invoice_settings?.default_payment_method === 'string'
      ? old.invoice_settings.default_payment_method
      : null
  if (!pmId) {
    const list = await stripe.paymentMethods.list({
      customer: oldCustomerId,
      type: 'card',
      limit: 1,
    })
    pmId = list.data[0]?.id ?? null
  }
  if (!pmId) return null

  try {
    await stripe.paymentMethods.detach(pmId)
  } catch {
    // already detached
  }
  const pm = await stripe.paymentMethods.attach(pmId, { customer: newCustomerId })
  await stripe.customers.update(newCustomerId, {
    invoice_settings: { default_payment_method: pmId },
  })
  const cardBrand = pm.card?.brand || 'card'
  return {
    pmId,
    brand: cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1),
    last4: pm.card?.last4 || '0000',
  }
}

export async function syncCardFromCustomer(orgId: string, customerId: string) {
  const stripe = getStripe()
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
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
