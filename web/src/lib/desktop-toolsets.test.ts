import { describe, expect, it } from 'vitest'

import {
  isCapabilitiesToolsetConfigHidden,
  isCapabilitiesToolsetToggleHidden,
  isDesktopToolsetVisible,
  isWebSearchVendorCredentialHidden
} from './desktop-toolsets'

describe('isDesktopToolsetVisible', () => {
  it('hides platform-coupled and internal toolsets', () => {
    for (const name of ['discord', 'discord_admin', 'yuanbao', 'context_engine', 'moa']) {
      expect(isDesktopToolsetVisible(name)).toBe(false)
    }
  })

  it('keeps ordinary user-facing toolsets', () => {
    for (const name of ['web', 'browser', 'terminal', 'file', 'memory', 'vision', 'image_gen']) {
      expect(isDesktopToolsetVisible(name)).toBe(true)
    }
  })
})

describe('Capabilities operator hides', () => {
  it('hides the Web Search and Memory toggles without removing the rows', () => {
    expect(isCapabilitiesToolsetToggleHidden('web')).toBe(true)
    expect(isCapabilitiesToolsetToggleHidden('memory')).toBe(true)
    expect(isCapabilitiesToolsetToggleHidden('browser')).toBe(false)
    expect(isDesktopToolsetVisible('web')).toBe(true)
    expect(isDesktopToolsetVisible('memory')).toBe(true)
  })

  it('hides the Web Search vendor picker, not Memory settings', () => {
    expect(isCapabilitiesToolsetConfigHidden('web')).toBe(true)
    expect(isCapabilitiesToolsetConfigHidden('memory')).toBe(false)
    expect(isCapabilitiesToolsetConfigHidden('browser')).toBe(false)
  })

  it('hides BYOK web-search credentials and leaves model keys alone', () => {
    for (const key of [
      'BRAVE_SEARCH_API_KEY',
      'EXA_API_KEY',
      'FIRECRAWL_API_KEY',
      'FIRECRAWL_API_URL',
      'PARALLEL_API_KEY',
      'SEARXNG_URL',
      'TAVILY_API_KEY'
    ]) {
      expect(isWebSearchVendorCredentialHidden(key)).toBe(true)
    }

    expect(isWebSearchVendorCredentialHidden('XAI_API_KEY')).toBe(false)
    expect(isWebSearchVendorCredentialHidden('BROWSERBASE_API_KEY')).toBe(false)
    expect(isWebSearchVendorCredentialHidden('OPENROUTER_API_KEY')).toBe(false)
  })
})
