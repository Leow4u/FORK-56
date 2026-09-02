/**
 * Stale Stripe customer detection (live-account cutover).
 * Run: node --test cloud/nas-sync/src/lib/__tests__/stale-stripe-customer.test.mjs
 *
 * Mirrors isStaleStripeCustomerError in stripe-customer.ts.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

function isStaleStripeCustomerError(err) {
  if (!err || typeof err !== 'object') return false
  const rec = err
  const message = String(rec.message || '')
  if (rec.code === 'resource_missing' && /customer/i.test(message)) return true
  return /no such customer/i.test(message)
}

describe('isStaleStripeCustomerError', () => {
  it('matches Stripe resource_missing for a customer id', () => {
    assert.equal(
      isStaleStripeCustomerError({
        code: 'resource_missing',
        message: "No such customer: 'cus_V77w8bsql11beX'",
      }),
      true,
    )
  })

  it('matches the message even without a code', () => {
    assert.equal(
      isStaleStripeCustomerError({
        message: "No such customer: 'cus_abc'",
      }),
      true,
    )
  })

  it('does not treat other Stripe failures as a stale customer', () => {
    assert.equal(
      isStaleStripeCustomerError({
        code: 'resource_missing',
        message: "No such price: 'price_123'",
      }),
      false,
    )
    assert.equal(
      isStaleStripeCustomerError({
        code: 'api_error',
        message: 'Stripe is down',
      }),
      false,
    )
    assert.equal(isStaleStripeCustomerError(null), false)
    assert.equal(isStaleStripeCustomerError(new Error('network')), false)
  })
})
