/**
 * Post-login profile sync.
 * Run: node --experimental-strip-types --test sites/work4you-portal/src/lib/__tests__/sync-profile.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PENDING_PROFILE_KEY, savePendingProfile } from '../pending-profile.ts'
import { syncProfileAfterAuth } from '../sync-profile.ts'

function memoryStore() {
  const map = new Map()
  const store = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
  return { map, store }
}

describe('syncProfileAfterAuth', () => {
  it('binds a pending signup name to the user and PATCHes the account-service', async () => {
    const { store } = memoryStore()
    savePendingProfile({ firstName: 'Ana', lastName: 'Silva' }, store)

    const originalSession = globalThis.sessionStorage
    const originalLocal = globalThis.localStorage
    globalThis.sessionStorage = store
    globalThis.localStorage = store

    const calls = []
    try {
      const result = await syncProfileAfterAuth(
        { id: 'did:privy:abc', email: { address: 'ana@example.com' } },
        async () => 'tok_1',
        async (url, init) => {
          calls.push({ url, init })
          return { ok: true }
        },
      )
      assert.deepEqual(result, { firstName: 'Ana', lastName: 'Silva' })
      assert.equal(calls.length, 1)
      assert.equal(store.getItem(PENDING_PROFILE_KEY), null)
      assert.equal(store.getItem('work4you.profile:did:privy:abc').includes('Ana'), true)
    } finally {
      globalThis.sessionStorage = originalSession
      globalThis.localStorage = originalLocal
    }
  })

  it('skips the API when Privy already has the name and nothing is pending', async () => {
    let called = false
    const result = await syncProfileAfterAuth(
      {
        id: 'did:privy:abc',
        customMetadata: { firstName: 'Rita', lastName: 'Lopes' },
      },
      async () => 'tok_1',
      async () => {
        called = true
        return { ok: true }
      },
    )
    assert.deepEqual(result, { firstName: 'Rita', lastName: 'Lopes' })
    assert.equal(called, false)
  })
})
