import { describe, expect, it } from 'vitest'

import { accountProfilePatchBody, portalAccountSettingsUrl } from './account-name'

describe('account profile name', () => {
  it('keeps both cadastro parts and drops a single part', () => {
    expect(accountProfilePatchBody('  Ada  ', 'Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
    expect(accountProfilePatchBody('Ada', '   ')).toBeNull()
    expect(accountProfilePatchBody('', 'Lovelace')).toBeNull()
    expect(accountProfilePatchBody('A'.repeat(90), 'Lovelace')?.firstName).toBe('A'.repeat(80))
  })

  it('opens the portal account page and lets that site pick the org', () => {
    expect(portalAccountSettingsUrl('https://portal.work4you.ai')).toBe(
      'https://portal.work4you.ai/orgs/personal/settings'
    )
    expect(portalAccountSettingsUrl('https://portal.example.test/')).toBe(
      'https://portal.example.test/orgs/personal/settings'
    )
    expect(portalAccountSettingsUrl(null)).toBe('https://portal.work4you.ai/orgs/personal/settings')
  })
})
