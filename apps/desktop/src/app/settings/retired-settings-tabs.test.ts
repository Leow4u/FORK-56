import { describe, expect, it } from 'vitest'

import { settingsTabReplacement } from './retired-settings-tabs'

describe('settingsTabReplacement', () => {
  it('sends retired gateway bookmarks to billing', () => {
    expect(settingsTabReplacement('gateway')).toBe('billing')
    expect(settingsTabReplacement('connections')).toBe('billing')
  })

  it('leaves living settings tabs alone', () => {
    expect(settingsTabReplacement('billing')).toBeNull()
    expect(settingsTabReplacement('config:model')).toBeNull()
    expect(settingsTabReplacement('providers')).toBeNull()
    expect(settingsTabReplacement(null)).toBeNull()
  })
})
