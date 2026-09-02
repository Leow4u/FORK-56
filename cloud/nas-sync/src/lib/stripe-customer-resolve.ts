/**
 * Pure Stripe-customer resolution — no Prisma / Stripe SDK.
 *
 * Existing orgs may store a `stripeCustomerId` from a previous Stripe
 * account, test/live mismatch, or a deleted customer. Blindly reusing that
 * id makes Checkout return `stripe_unavailable`. New orgs have no id and
 * mint a customer against the current key, so they succeed.
 */

export type StripeCustomerRecord = {
  deleted?: boolean
}

export function isMissingStripeCustomerError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as {
    code?: string
    param?: string
    message?: string
    raw?: { code?: string; param?: string; message?: string }
  }
  const code = e.code || e.raw?.code
  const param = e.param || e.raw?.param
  const message = e.message || e.raw?.message || ''
  if (code === 'resource_missing') {
    if (param === 'customer' || param === 'id') return true
    return /no such customer/i.test(message)
  }
  return /no such customer/i.test(message)
}

/**
 * Return a live Stripe customer id: reuse `storedId` when Stripe still
 * knows it, otherwise mint a new one.
 */
export async function resolveStripeCustomerId(args: {
  storedId: string | null | undefined
  retrieve: (id: string) => Promise<StripeCustomerRecord>
  create: () => Promise<string>
}): Promise<string> {
  const stored = args.storedId?.trim()
  if (!stored) return args.create()
  try {
    const customer = await args.retrieve(stored)
    if (!customer?.deleted) return stored
  } catch (err) {
    if (!isMissingStripeCustomerError(err)) throw err
  }
  return args.create()
}
