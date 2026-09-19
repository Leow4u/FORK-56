/**
 * Profile name helpers.
 * Run: node --experimental-strip-types --test sites/work4you-portal/src/lib/__tests__/profile-name.test.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  composeDisplayName,
  isValidEmail,
  parseProfileName,
  profileFromCustomMetadata,
  profileFromFullName,
  resolveProfileName,
} from '../profile-name.ts'

describe('parseProfileName', () => {
  it('requires both first and last name', () => {
    assert.equal(parseProfileName({ firstName: 'Ana' }), null)
    assert.equal(parseProfileName({ lastName: 'Silva' }), null)
    assert.deepEqual(parseProfileName({ firstName: ' Ana  Rita ', lastName: ' Silva ' }), {
      firstName: 'Ana Rita',
      lastName: 'Silva',
    })
  })

  it('accepts snake_case keys from the account-service', () => {
    assert.deepEqual(parseProfileName({ first_name: 'João', last_name: 'Costa' }), {
      firstName: 'João',
      lastName: 'Costa',
    })
  })
})

describe('composeDisplayName / email', () => {
  it('joins names and rejects empty email-like junk', () => {
    assert.equal(composeDisplayName('Ana', 'Silva'), 'Ana Silva')
    assert.equal(composeDisplayName('  ', ''), null)
    assert.equal(isValidEmail('voce@empresa.com'), true)
    assert.equal(isValidEmail('sem-arroba'), false)
    assert.equal(isValidEmail('a@b'), false)
  })
})

describe('resolveProfileName', () => {
  it('prefers Privy custom metadata over OAuth display names', () => {
    const user = {
      id: 'did:privy:abc',
      customMetadata: { firstName: 'Ana', lastName: 'Silva' },
      google: { name: 'Google Person', email: 'g@example.com' },
      email: { address: 'mail@example.com' },
    }
    assert.deepEqual(profileFromCustomMetadata(user), {
      firstName: 'Ana',
      lastName: 'Silva',
    })
    assert.deepEqual(profileFromFullName('Maria João Costa'), {
      firstName: 'Maria',
      lastName: 'João Costa',
    })
    assert.deepEqual(resolveProfileName(user), {
      firstName: 'Ana',
      lastName: 'Silva',
    })
  })

  it('falls back to extras then OAuth when metadata is empty', () => {
    const user = {
      id: 'did:privy:abc',
      google: { name: 'Rita Lopes' },
    }
    assert.deepEqual(resolveProfileName(user, [{ firstName: 'Pendente', lastName: 'Nome' }]), {
      firstName: 'Pendente',
      lastName: 'Nome',
    })
    assert.deepEqual(resolveProfileName(user), {
      firstName: 'Rita',
      lastName: 'Lopes',
    })
  })
})
