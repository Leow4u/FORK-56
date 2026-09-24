import { describe, expect, it } from 'vitest'

import { accountMenuLabel } from './account-label'

describe('accountMenuLabel', () => {
  it('prefers the cadastro name over the email', () => {
    expect(accountMenuLabel({ email: 'ada@example.com', name: 'Ada Lovelace' })).toBe('Ada Lovelace')
  })

  it('uses the email when the cadastro name is missing', () => {
    expect(accountMenuLabel({ email: 'ada@example.com', name: null })).toBe('ada@example.com')
    expect(accountMenuLabel({ email: 'ada@example.com', name: '   ' })).toBe('ada@example.com')
    expect(accountMenuLabel({ email: 'ada@example.com' })).toBe('ada@example.com')
  })

  it('returns null when neither identity is present', () => {
    expect(accountMenuLabel({ email: null, name: null })).toBeNull()
    expect(accountMenuLabel({})).toBeNull()
  })
})
