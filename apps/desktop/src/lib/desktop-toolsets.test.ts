import { describe, expect, it } from 'vitest'

import { isDesktopToolsetVisible, isToolsetToggleable } from './desktop-toolsets'

describe('isDesktopToolsetVisible', () => {
  it('hides platform-coupled, internal, and non-model toolsets', () => {
    for (const name of ['discord', 'discord_admin', 'yuanbao', 'context_engine', 'moa', 'stt']) {
      expect(isDesktopToolsetVisible(name)).toBe(false)
    }
  })

  it('keeps ordinary user-facing toolsets', () => {
    for (const name of ['web', 'browser', 'terminal', 'file', 'memory', 'vision', 'image_gen']) {
      expect(isDesktopToolsetVisible(name)).toBe(true)
    }
  })
})

describe('isToolsetToggleable', () => {
  it('trusts the backend toggleable flag when present', () => {
    expect(isToolsetToggleable({ name: 'spotify', toggleable: false })).toBe(false)
    expect(isToolsetToggleable({ name: 'terminal', toggleable: true })).toBe(true)
  })

  it('treats always-on and config-only toolsets as not toggleable', () => {
    expect(isToolsetToggleable({ name: 'terminal' })).toBe(false)
    expect(isToolsetToggleable({ name: 'file', presence: 'always_on' })).toBe(false)
    expect(isToolsetToggleable({ name: 'stt' })).toBe(false)
    expect(isToolsetToggleable({ name: 'image_gen' })).toBe(true)
    expect(isToolsetToggleable({ name: 'spotify', presence: 'connected' })).toBe(true)
  })
})
