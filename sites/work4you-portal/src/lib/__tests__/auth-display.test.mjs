/**
 * Visible account label.
 * Run: node --experimental-strip-types --test sites/work4you-portal/src/lib/__tests__/auth-display.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { displayName } from '../auth-display.ts'

describe('displayName', () => {
  it('uses the persisted profile name before email or OAuth handles', () => {
    assert.equal(
      displayName({
        id: 'did:privy:abc',
        customMetadata: { firstName: 'Ana', lastName: 'Silva' },
        email: { address: 'ana@example.com' },
        github: { username: 'ana-dev' },
      }),
      'Ana Silva',
    )
  })

  it('falls back to email then the Privy id', () => {
    assert.equal(
      displayName({
        id: 'did:privy:abc',
        email: { address: 'ana@example.com' },
      }),
      'ana@example.com',
    )
    assert.equal(displayName({ id: 'did:privy:abc' }), 'did:privy:abc')
  })
})
