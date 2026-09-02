/**
 * Run: node --experimental-strip-types --test cloud/nas-sync/src/lib/__tests__/stripe-customer-resolve.test.mts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isMissingStripeCustomerError,
  resolveStripeCustomerId,
} from '../stripe-customer-resolve.ts'

describe('isMissingStripeCustomerError', () => {
  it('matches Stripe resource_missing on a customer', () => {
    assert.equal(
      isMissingStripeCustomerError({
        code: 'resource_missing',
        param: 'customer',
        message: 'No such customer: cus_stale',
      }),
      true,
    )
  })

  it('matches the "No such customer" message even without a code', () => {
    assert.equal(
      isMissingStripeCustomerError(new Error('No such customer: cus_abc')),
      true,
    )
  })

  it('does not treat a missing price or a generic outage as a missing customer', () => {
    assert.equal(
      isMissingStripeCustomerError({
        code: 'resource_missing',
        param: 'price',
        message: "No such price: 'price_123'",
      }),
      false,
    )
    assert.equal(
      isMissingStripeCustomerError(new Error('stripe is down')),
      false,
    )
    assert.equal(isMissingStripeCustomerError({ code: 'rate_limit' }), false)
    assert.equal(isMissingStripeCustomerError(null), false)
  })
})

describe('resolveStripeCustomerId', () => {
  it('mints a customer when the org has never been to Stripe (new account)', async () => {
    const created = await resolveStripeCustomerId({
      storedId: null,
      retrieve: async () => {
        throw new Error('retrieve must not run for a new org')
      },
      create: async () => 'cus_new',
    })
    assert.equal(created, 'cus_new')
  })

  it('reuses a live customer id (existing account, same Stripe key)', async () => {
    const id = await resolveStripeCustomerId({
      storedId: 'cus_live',
      retrieve: async (stored) => {
        assert.equal(stored, 'cus_live')
        return { deleted: false }
      },
      create: async () => {
        throw new Error('must not mint a second customer')
      },
    })
    assert.equal(id, 'cus_live')
  })

  it('replaces a customer Stripe no longer knows (stale existing account)', async () => {
    const id = await resolveStripeCustomerId({
      storedId: 'cus_from_old_key',
      retrieve: async () => {
        throw Object.assign(new Error('No such customer: cus_from_old_key'), {
          code: 'resource_missing',
          param: 'customer',
        })
      },
      create: async () => 'cus_healed',
    })
    assert.equal(id, 'cus_healed')
  })

  it('replaces a deleted Stripe customer', async () => {
    const id = await resolveStripeCustomerId({
      storedId: 'cus_deleted',
      retrieve: async () => ({ deleted: true }),
      create: async () => 'cus_replacement',
    })
    assert.equal(id, 'cus_replacement')
  })

  it('does not mint a duplicate when Stripe is merely unavailable', async () => {
    await assert.rejects(
      () =>
        resolveStripeCustomerId({
          storedId: 'cus_live',
          retrieve: async () => {
            throw new Error('timeout talking to Stripe')
          },
          create: async () => 'cus_should_not_exist',
        }),
      /timeout talking to Stripe/,
    )
  })
})
