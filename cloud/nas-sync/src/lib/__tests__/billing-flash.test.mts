/**
 * Run: node --experimental-strip-types --test cloud/nas-sync/src/lib/__tests__/billing-flash.test.mts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { portalBillingFlash } from '../billing-client.ts'

describe('portalBillingFlash', () => {
  it('does not flash the raw stripe_unavailable code', () => {
    const copy = portalBillingFlash({ error: 'stripe_unavailable' }, 'fallback')
    assert.equal(copy.includes('stripe_unavailable'), false)
    assert.match(copy, /Stripe/)
  })

  it('hides STRIPE_SECRET_KEY leaks from the banner', () => {
    assert.equal(
      portalBillingFlash(
        {
          error: 'stripe_unavailable',
          message: 'STRIPE_SECRET_KEY is not set',
        },
        'fallback',
      ).includes('STRIPE_SECRET_KEY'),
      false,
    )
  })

  it('keeps a user-facing server message for other errors', () => {
    assert.equal(
      portalBillingFlash(
        { error: 'no_payment_method', message: 'Adiciona um cartão primeiro' },
        'fallback',
      ),
      'Adiciona um cartão primeiro',
    )
  })

  it('falls back when the payload is empty', () => {
    assert.equal(portalBillingFlash({}, 'Falha ao abrir Stripe'), 'Falha ao abrir Stripe')
  })
})
