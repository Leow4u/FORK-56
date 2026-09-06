import { describe, expect, it } from 'vitest'

import { detectEmailPreset, EMAIL_PROVIDER_PRESETS } from './email-presets'

describe('EMAIL_PROVIDER_PRESETS', () => {
  it('every preset carries both hosts, a domain list, and a unique id', () => {
    const ids = EMAIL_PROVIDER_PRESETS.map(preset => preset.id)

    expect(new Set(ids).size).toBe(ids.length)

    for (const preset of EMAIL_PROVIDER_PRESETS) {
      expect(preset.imapHost).toBeTruthy()
      expect(preset.smtpHost).toBeTruthy()
      expect(preset.domains.length).toBeGreaterThan(0)
      // Detection lowercases the typed domain, so preset data must be
      // lowercase to ever match.
      expect(preset.domains).toEqual(preset.domains.map(domain => domain.toLowerCase()))
    }
  })

  it('no domain is claimed by two presets', () => {
    const all = EMAIL_PROVIDER_PRESETS.flatMap(preset => preset.domains)

    expect(new Set(all).size).toBe(all.length)
  })
})

describe('detectEmailPreset', () => {
  it('maps an address domain to its provider, case-insensitively', () => {
    expect(detectEmailPreset('agent@gmail.com')?.id).toBe('gmail')
    expect(detectEmailPreset('Agent@GoogleMail.COM')?.id).toBe('gmail')
    expect(detectEmailPreset('me@hotmail.com')?.id).toBe('outlook')
    expect(detectEmailPreset('me@me.com')?.id).toBe('icloud')
  })

  it('returns null for unknown domains and incomplete input', () => {
    expect(detectEmailPreset('agent@mycompany.com')).toBeNull()
    expect(detectEmailPreset('agent')).toBeNull()
    expect(detectEmailPreset('')).toBeNull()
  })
})
