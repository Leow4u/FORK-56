/**
 * Account-service profile payload.
 * Run: node --experimental-strip-types --test cloud/nas-sync/src/lib/__tests__/account-profile.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { accountIdentityFromPrivyUser, parseAccountProfileBody } from '../account-profile-parse.ts'

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

describe('accountIdentityFromPrivyUser', () => {
  it('prefers the cadastro name parts and keeps a native email', () => {
    assert.deepEqual(
      accountIdentityFromPrivyUser({
        customMetadata: { firstName: 'Leo', lastName: 'Silva' },
        email: { address: 'leo@example.com' },
        github: { username: 'leow4u' },
      }),
      { firstName: 'Leo', lastName: 'Silva', email: 'leo@example.com' },
    )
  })

  it('uses a linked Google or GitHub email when the cadastro name is incomplete', () => {
    assert.deepEqual(
      accountIdentityFromPrivyUser({
        customMetadata: { firstName: 'Leo' },
        google: { email: 'leo@gmail.com', name: 'Leo Silva' },
      }),
      { firstName: null, lastName: null, email: 'leo@gmail.com' },
    )
    assert.equal(
      accountIdentityFromPrivyUser({ github: { username: 'leow4u', email: 'leo@users.noreply.github.com' } }).email,
      'leo@users.noreply.github.com',
    )
  })

  it('returns empty identity when the user has no name and no email address', () => {
    assert.deepEqual(accountIdentityFromPrivyUser({ github: { username: 'leow4u' } }), {
      firstName: null,
      lastName: null,
      email: null,
    })
    assert.deepEqual(accountIdentityFromPrivyUser(null), {
      firstName: null,
      lastName: null,
      email: null,
    })
  })
})
