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
  it('treats always-on toolsets as not toggleable', () => {
    expect(isToolsetToggleable({ name: 'browser' })).toBe(false)
    expect(isToolsetToggleable({ name: 'image_gen' })).toBe(true)
    expect(isToolsetToggleable({ name: 'stt' })).toBe(false)
  })
})
