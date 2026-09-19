/**
 * Account-service profile payload.
 * Run: node --experimental-strip-types --test cloud/nas-sync/src/lib/__tests__/account-profile.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseAccountProfileBody } from '../account-profile-parse.ts'

describe('parseAccountProfileBody', () => {
  it('accepts camelCase and snake_case and rejects incomplete names', () => {
    assert.deepEqual(parseAccountProfileBody({ firstName: 'Ana', lastName: 'Silva' }), {
      firstName: 'Ana',
      lastName: 'Silva',
    })
    assert.deepEqual(parseAccountProfileBody({ first_name: 'João', last_name: 'Costa' }), {
      firstName: 'João',
      lastName: 'Costa',
    })
    assert.equal(parseAccountProfileBody({ firstName: 'Ana' }), null)
    assert.equal(parseAccountProfileBody({}), null)
    assert.equal(parseAccountProfileBody(null), null)
  })
})
