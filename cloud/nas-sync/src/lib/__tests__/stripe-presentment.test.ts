/**
 * Presentment helpers — import the NAS module (Node type stripping).
 * Run: node --experimental-strip-types --test cloud/nas-sync/src/lib/__tests__/stripe-presentment.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertPriceMatchesPresentment,
  getStripePresentmentCurrency,
  PricePresentmentMismatchError,
  usdToPresentmentCents,
} from '../stripe-presentment.ts'

describe('getStripePresentmentCurrency', () => {
  it('defaults to brl', () => {
    assert.equal(getStripePresentmentCurrency({}), 'brl')
    assert.equal(getStripePresentmentCurrency({ STRIPE_PRESENTMENT_CURRENCY: '' }), 'brl')
    assert.equal(getStripePresentmentCurrency({ STRIPE_PRESENTMENT_CURRENCY: 'BRL' }), 'brl')
  })

  it('allows usd for a live US Stripe account', () => {
    assert.equal(
      getStripePresentmentCurrency({ STRIPE_PRESENTMENT_CURRENCY: 'usd' }),
      'usd',
    )
  })

  it('rejects unknown currencies', () => {
    assert.throws(
      () => getStripePresentmentCurrency({ STRIPE_PRESENTMENT_CURRENCY: 'eur' }),
      /unsupported_presentment_currency:eur/,
    )
  })
})

describe('usdToPresentmentCents', () => {
  it('keeps USD ledger amounts as USD cents', () => {
    assert.equal(usdToPresentmentCents(20, 'usd', {}), 2000)
    assert.equal(usdToPresentmentCents(22.5, 'usd', {}), 2250)
  })

  it('converts USD top-ups to BRL cents with the configured rate', () => {
    const env = { STRIPE_USD_TO_BRL: '5.50' }
    assert.equal(usdToPresentmentCents(20, 'brl', env), 11000)
    assert.equal(usdToPresentmentCents(10, 'brl', env), 5500)
  })

  it('fails closed when BRL FX is missing — never guesses a rate', () => {
    assert.throws(
      () => usdToPresentmentCents(20, 'brl', {}),
      /STRIPE_USD_TO_BRL is not set/,
    )
    assert.throws(
      () => usdToPresentmentCents(20, 'brl', { STRIPE_USD_TO_BRL: '0' }),
      /STRIPE_USD_TO_BRL is not set/,
    )
  })

  it('rejects non-positive USD amounts', () => {
    assert.throws(() => usdToPresentmentCents(0, 'usd', {}), /invalid_usd_amount/)
    assert.throws(() => usdToPresentmentCents(-5, 'usd', {}), /invalid_usd_amount/)
  })
})

describe('assertPriceMatchesPresentment', () => {
  it('accepts a BRL Price when presentment is brl', () => {
    assert.doesNotThrow(() =>
      assertPriceMatchesPresentment({ id: 'price_brl', currency: 'brl' }, 'brl'),
    )
  })

  it('blocks a leftover USD Price while presentment is brl', () => {
    assert.throws(
      () =>
        assertPriceMatchesPresentment({ id: 'price_usd', currency: 'usd' }, 'brl'),
      (err: unknown) => {
        assert.ok(err instanceof PricePresentmentMismatchError)
        assert.match(
          (err as Error).message,
          /stripe_price_currency_mismatch:price_usd:price=usd:presentment=brl/,
        )
        return true
      },
    )
  })
})
