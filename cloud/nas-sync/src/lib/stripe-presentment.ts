/**
 * Stripe card presentment vs NAS USD ledger.
 *
 * Brazilian Stripe accounts (BRL settlement) decline USD Prices on many
 * local cards (`currency_not_supported`). Presentment — Checkout Price,
 * setup-session currency, PaymentIntent currency — must match the Stripe
 * account's settlement currency. The org ledger, Desktop catalog, and
 * OpenRouter costs stay in USD.
 *
 * Ops:
 *   STRIPE_PRESENTMENT_CURRENCY  default `brl` (set `usd` only on a live US account)
 *   STRIPE_USD_TO_BRL            required when presentment is `brl` (top-up FX; no silent default)
 *   STRIPE_PRICE_PLUS/SUPER/ULTRA must be Prices in the presentment currency
 */

export type PresentmentCurrency = 'brl' | 'usd'

export type EnvMap = Record<string, string | undefined>

export class PricePresentmentMismatchError extends Error {
  readonly priceId: string
  readonly priceCurrency: string
  readonly presentment: PresentmentCurrency

  constructor(
    priceId: string,
    priceCurrency: string,
    presentment: PresentmentCurrency,
  ) {
    super(
      `stripe_price_currency_mismatch:${priceId}:price=${priceCurrency}:presentment=${presentment}`,
    )
    this.name = 'PricePresentmentMismatchError'
    this.priceId = priceId
    this.priceCurrency = priceCurrency
    this.presentment = presentment
  }
}

export function getStripePresentmentCurrency(
  env: EnvMap = process.env,
): PresentmentCurrency {
  const raw = (env.STRIPE_PRESENTMENT_CURRENCY || 'brl').trim().toLowerCase()
  if (raw === 'usd') return 'usd'
  if (raw === 'brl') return 'brl'
  throw new Error(`unsupported_presentment_currency:${raw}`)
}

export function usdToBrlRate(env: EnvMap = process.env): number {
  const rate = Number(env.STRIPE_USD_TO_BRL)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('STRIPE_USD_TO_BRL is not set')
  }
  return rate
}

/** Convert a USD ledger amount into Stripe minor units in the presentment currency. */
export function usdToPresentmentCents(
  amountUsd: number,
  presentment: PresentmentCurrency = getStripePresentmentCurrency(),
  env: EnvMap = process.env,
): number {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error('invalid_usd_amount')
  }
  if (presentment === 'usd') {
    return Math.round(amountUsd * 100)
  }
  return Math.round(amountUsd * usdToBrlRate(env) * 100)
}

export function assertPriceMatchesPresentment(
  price: { id?: string | null; currency?: string | null },
  presentment: PresentmentCurrency,
): void {
  const currency = (price.currency || '').trim().toLowerCase()
  if (currency !== presentment) {
    throw new PricePresentmentMismatchError(
      price.id || 'unknown',
      currency || 'missing',
      presentment,
    )
  }
}

/** True when Stripe already locked this Customer to another currency. */
export function customerNeedsPresentmentRotate(
  customer: { deleted?: boolean | null; currency?: string | null },
  presentment: PresentmentCurrency,
): boolean {
  if (customer.deleted) return true
  const currency = (customer.currency || '').trim().toLowerCase()
  if (!currency) return false
  return currency !== presentment
}

/** Stripe refuses a BRL Price on a Customer that still has USD Checkout/subscriptions. */
export function isCustomerCurrencyConflict(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('combinar moedas') ||
    m.includes('combine currencies') ||
    m.includes('cannot mix currencies') ||
    m.includes('mixing currencies') ||
    m.includes('currencies on a single customer')
  )
}
