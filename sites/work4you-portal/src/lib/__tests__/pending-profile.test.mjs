/**
 * Pending / local profile storage.
 * Run: node --experimental-strip-types --test sites/work4you-portal/src/lib/__tests__/pending-profile.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  LOCAL_PROFILE_PREFIX,
  PENDING_PROFILE_KEY,
  clearPendingProfile,
  localProfileKey,
  readLocalProfile,
  readPendingProfile,
  saveLocalProfile,
  savePendingProfile,
} from '../pending-profile.ts'

function memoryStore() {
  const map = new Map()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

describe('pending profile', () => {
  it('round-trips a signup name and clears it', () => {
    const store = memoryStore()
    savePendingProfile({ firstName: 'Ana', lastName: 'Silva' }, store)
    assert.equal(store.getItem(PENDING_PROFILE_KEY).includes('Ana'), true)
    assert.deepEqual(readPendingProfile(store), { firstName: 'Ana', lastName: 'Silva' })
    clearPendingProfile(store)
    assert.equal(readPendingProfile(store), null)
  })
})

describe('local profile', () => {
  it('scopes the cache to the Privy user id', () => {
    const store = memoryStore()
    const userId = 'did:privy:abc'
    saveLocalProfile(userId, { firstName: 'João', lastName: 'Costa' }, store)
    assert.equal(localProfileKey(userId), `${LOCAL_PROFILE_PREFIX}${userId}`)
    assert.deepEqual(readLocalProfile(userId, store), {
      firstName: 'João',
      lastName: 'Costa',
    })
    assert.equal(readLocalProfile('did:privy:other', store), null)
  })
})
