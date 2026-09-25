import { describe, expect, it } from 'vitest'

import { capabilitiesSettingsRedirect, settingsTabReplacement } from './retired-settings-tabs'

describe('settingsTabReplacement', () => {
  it('sends retired gateway bookmarks to billing', () => {
    expect(settingsTabReplacement('gateway')).toBe('billing')
    expect(settingsTabReplacement('connections')).toBe('billing')
  })

  it('leaves living settings tabs alone', () => {
    expect(settingsTabReplacement('billing')).toBeNull()
    expect(settingsTabReplacement('config:model')).toBeNull()
    expect(settingsTabReplacement('providers')).toBeNull()
    expect(settingsTabReplacement('keys')).toBeNull()
    expect(settingsTabReplacement(null)).toBeNull()
  })
})

describe('capabilitiesSettingsRedirect', () => {
  it('sends the Tools and keys page to Capabilities', () => {
    expect(capabilitiesSettingsRedirect('keys')).toBe('/skills')
  })

  it('leaves other tabs on Settings', () => {
    expect(capabilitiesSettingsRedirect('gateway')).toBeNull()
    expect(capabilitiesSettingsRedirect('billing')).toBeNull()
    expect(capabilitiesSettingsRedirect(null)).toBeNull()
  })
})
