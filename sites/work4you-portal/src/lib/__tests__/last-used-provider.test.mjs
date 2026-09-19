/**
 * Last-used auth provider badge.
 * Run: node --experimental-strip-types --test sites/work4you-portal/src/lib/__tests__/last-used-provider.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  LAST_USED_PROVIDER_KEY,
  isAuthProviderId,
  readLastUsedProvider,
  saveLastUsedProvider,
} from '../last-used-provider.ts'

describe('last used provider', () => {
  it('persists only known providers', () => {
    const map = new Map()
    const store = {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        map.set(key, value)
      },
    }
    assert.equal(isAuthProviderId('github'), true)
    assert.equal(isAuthProviderId('apple'), false)
    saveLastUsedProvider('discord', store)
    assert.equal(store.getItem(LAST_USED_PROVIDER_KEY), 'discord')
    assert.equal(readLastUsedProvider(store), 'discord')
    map.set(LAST_USED_PROVIDER_KEY, 'apple')
    assert.equal(readLastUsedProvider(store), null)
  })
})
