/**
 * Presentment helpers — import the NAS module (Node type stripping).
 * Run: node --experimental-strip-types --test cloud/nas-sync/src/lib/__tests__/stripe-presentment.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertPriceMatchesPresentment,
  customerNeedsPresentmentRotate,
  getStripePresentmentCurrency,
  isCustomerCurrencyConflict,
  PricePresentmentMismatchError,
  usdToPresentmentCents,
} from '../stripe-presentment.ts'

describe('customerNeedsPresentmentRotate', () => {
  it('keeps a customer with no locked currency', () => {
    assert.equal(customerNeedsPresentmentRotate({ currency: null }, 'brl'), false)
    assert.equal(customerNeedsPresentmentRotate({ currency: '' }, 'brl'), false)
  })

  it('rotates when Stripe locked the customer to USD', () => {
    assert.equal(
      customerNeedsPresentmentRotate({ currency: 'usd' }, 'brl'),
      true,
    )
  })

  it('rotates a deleted customer', () => {
    assert.equal(customerNeedsPresentmentRotate({ deleted: true }, 'brl'), true)
  })
})

describe('isCustomerCurrencyConflict', () => {
  it('detects the Stripe mix-currency error in pt-BR and en', () => {
    assert.equal(
      isCustomerCurrencyConflict(
        'Não é possível combinar moedas para um mesmo cliente. Este cliente possui uma sessão de finalização de compra ativa no modo de assinatura com a moeda USD.',
      ),
      true,
    )
    assert.equal(
      isCustomerCurrencyConflict(
        'You cannot combine currencies for a customer. This customer has an active checkout session in subscription mode with the currency USD.',
      ),
      true,
    )
    assert.equal(isCustomerCurrencyConflict('No such price: price_abc'), false)
  })
})

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
