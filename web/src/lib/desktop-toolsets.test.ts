import { describe, expect, it } from 'vitest'

import { isCapabilitiesVendorCredentialHidden, isDesktopToolsetVisible } from './desktop-toolsets'

const HIDDEN_CORE_TOOLSETS = [
  'web',
  'browser',
  'terminal',
  'file',
  'code_execution',
  'skills',
  'memory',
  'computer_use',
  'vision',
  'clarify'
]

describe('isDesktopToolsetVisible', () => {
  it('hides platform-coupled, internal, and core agent toolsets', () => {
    for (const name of ['discord', 'discord_admin', 'yuanbao', 'context_engine', 'moa', ...HIDDEN_CORE_TOOLSETS]) {
      expect(isDesktopToolsetVisible(name)).toBe(false)
    }
  })

  it('keeps other user-facing toolsets', () => {
    for (const name of ['image_gen', 'cronjob', 'homeassistant', 'tts']) {
      expect(isDesktopToolsetVisible(name)).toBe(true)
    }
  })
})

describe('Capabilities vendor credentials', () => {
  it('hides BYOK web-search and browser-cloud credentials', () => {
    for (const key of [
      'BRAVE_SEARCH_API_KEY',
      'BROWSERBASE_API_KEY',
      'BROWSER_USE_API_KEY',
      'CAMOFOX_URL',
      'EXA_API_KEY',
      'FIRECRAWL_API_KEY',
      'FIRECRAWL_API_URL',
      'PARALLEL_API_KEY',
      'SEARXNG_URL',
      'TAVILY_API_KEY'
    ]) {
      expect(isCapabilitiesVendorCredentialHidden(key)).toBe(true)
    }
  })

  it('leaves model keys and remaining tool keys alone', () => {
    expect(isCapabilitiesVendorCredentialHidden('XAI_API_KEY')).toBe(false)
    expect(isCapabilitiesVendorCredentialHidden('OPENROUTER_API_KEY')).toBe(false)
    expect(isCapabilitiesVendorCredentialHidden('FAL_KEY')).toBe(false)
  })
})
