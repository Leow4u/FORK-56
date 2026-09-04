import { describe, expect, it } from 'vitest'

import { isCapabilitiesToolsetProviderVisible, isCapabilitiesVendorCredentialHidden, isDesktopToolsetVisible } from './desktop-toolsets'

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
  'clarify',
  'a2a',
  'bfl',
  'cronjob',
  'homeassistant',
  'session_search',
  'spotify',
  'delegation',
  'todo',
  'video',
  'x_search'
]

describe('isDesktopToolsetVisible', () => {
  it('hides platform-coupled, internal, and core agent toolsets', () => {
    for (const name of ['discord', 'discord_admin', 'yuanbao', 'context_engine', 'moa', ...HIDDEN_CORE_TOOLSETS]) {
      expect(isDesktopToolsetVisible(name)).toBe(false)
    }
  })

  it('keeps other user-facing toolsets', () => {
    for (const name of ['image_gen', 'tts', 'video_gen', 'stt']) {
      expect(isDesktopToolsetVisible(name)).toBe(true)
    }
  })
})

describe('Capabilities vendor credentials', () => {
  it('hides BYOK web-search, browser-cloud, Home Assistant, and image-gen vendor credentials', () => {
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
      'TAVILY_API_KEY',
      'HASS_TOKEN',
      'HASS_URL',
      'FAL_KEY',
      'KREA_API_KEY',
      'DEEPINFRA_API_KEY'
    ]) {
      expect(isCapabilitiesVendorCredentialHidden(key)).toBe(true)
    }
  })

  it('leaves model keys and remaining tool keys alone', () => {
    expect(isCapabilitiesVendorCredentialHidden('XAI_API_KEY')).toBe(false)
    expect(isCapabilitiesVendorCredentialHidden('OPENROUTER_API_KEY')).toBe(false)
    expect(isCapabilitiesVendorCredentialHidden('OPENAI_API_KEY')).toBe(false)
    expect(isCapabilitiesVendorCredentialHidden('ELEVENLABS_API_KEY')).toBe(false)
  })
})

describe('isCapabilitiesToolsetProviderVisible', () => {
  it('keeps only Work4You Subscription on Image Generation', () => {
    expect(isCapabilitiesToolsetProviderVisible('image_gen', 'Work4You Subscription')).toBe(true)
    for (const name of [
      'FAL.ai',
      'DeepInfra',
      'Krea',
      'OpenAI',
      'OpenAI (Codex auth)',
      'OpenRouter (image)',
      'Work4You Portal (image)',
      'xAI Grok Imagine (image)'
    ]) {
      expect(isCapabilitiesToolsetProviderVisible('image_gen', name)).toBe(false)
    }
  })

  it('keeps only Work4You Subscription on Speech-to-Text', () => {
    expect(isCapabilitiesToolsetProviderVisible('stt', 'Work4You Subscription')).toBe(true)
    for (const name of [
      'Local Whisper',
      'OpenAI',
      'Groq',
      'xAI',
      'ElevenLabs Scribe',
      'DeepInfra'
    ]) {
      expect(isCapabilitiesToolsetProviderVisible('stt', name)).toBe(false)
    }
  })

  it('does not prefix-match other Subscription rows', () => {
    expect(
      isCapabilitiesToolsetProviderVisible('browser', 'Work4You Subscription (Browser Use cloud)')
    ).toBe(true)
    expect(isCapabilitiesToolsetProviderVisible('video_gen', 'FAL.ai')).toBe(true)
    expect(isCapabilitiesToolsetProviderVisible('tts', 'Microsoft Edge TTS')).toBe(true)
    expect(isCapabilitiesToolsetProviderVisible('tts', 'Work4You Subscription')).toBe(true)
  })
})
