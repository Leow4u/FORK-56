/**
 * Account profile client.
 * Run: node --experimental-strip-types --test sites/work4you-portal/src/lib/__tests__/account-profile.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ACCOUNT_PROFILE_PATH,
  accountProfilePayload,
  persistAccountProfile,
} from '../account-profile.ts'

describe('persistAccountProfile', () => {
  it('PATCHes /api/account with the bearer token and name fields', async () => {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push({ url, init })
      return { ok: true }
    }
    const ok = await persistAccountProfile(
      'tok_1',
      { firstName: 'Ana', lastName: 'Silva' },
      fetchImpl,
    )
    assert.equal(ok, true)
    assert.equal(calls[0].url, ACCOUNT_PROFILE_PATH)
    assert.equal(calls[0].init.method, 'PATCH')
    assert.equal(calls[0].init.headers.Authorization, 'Bearer tok_1')
    assert.deepEqual(JSON.parse(calls[0].init.body), accountProfilePayload({
      firstName: 'Ana',
      lastName: 'Silva',
    }))
  })

  it('does not call the API without a complete name', async () => {
    let called = false
    const ok = await persistAccountProfile(
      'tok_1',
      { firstName: 'Ana', lastName: '' },
      async () => {
        called = true
        return { ok: true }
      },
    )
    assert.equal(ok, false)
    assert.equal(called, false)
  })
})
