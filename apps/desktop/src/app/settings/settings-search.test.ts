import { describe, expect, it } from 'vitest'

import { Settings2, Wrench } from '@/lib/icons'
import type { ConfigFieldSchema, Work4YouConfigRecord } from '@/types/work4you'

import {
  buildConfigSearchEntries,
  buildCredentialSearchEntries,
  credentialSettingsView,
  filterSettingsSearchEntries
} from './settings-search'
import { envVar } from './test-utils'

const searchCopy = {
  fieldDescriptions: {
    'display.personality': 'Choose how Work4You sounds in conversation.',
    'tts.edge.voice': 'Voice used by Edge TTS.'
  },
  fieldLabels: {
    'display.personality': 'Personality',
    'tts.edge.voice': 'Edge voice',
    'tts.openai.voice': 'OpenAI voice'
  },
  sections: {
    chat: 'Chat',
    voice: 'Voice'
  }
}

describe('settings search index', () => {
  it('builds config results from renderable schema fields with exact deep links', () => {
    const schema: Record<string, ConfigFieldSchema> = {
      'display.personality': { type: 'select' },
      'tts.edge.voice': { type: 'string' },
      'tts.openai.voice': { type: 'string' }
    }

    const config = {
      display: { personality: 'default' },
      tts: { provider: 'edge', edge: { voice: '' }, openai: { voice: '' } }
    } as unknown as Work4YouConfigRecord

    const entries = buildConfigSearchEntries(schema, config, searchCopy)

    expect(entries.map(entry => entry.id)).toEqual([
      'config-field:display.personality',
      'config-field:tts.provider',
      'config-field:tts.edge.voice'
    ])
    expect(entries[0]).toMatchObject({
      context: 'Chat',
      description: 'Choose how Work4You sounds in conversation.',
      label: 'Personality',
      target: { field: 'display.personality', view: 'config:chat' }
    })
    expect(entries.some(entry => entry.id === 'config-field:tts.openai.voice')).toBe(false)
  })

  it('discovers future tool and setting entries entirely from backend metadata', () => {
    const vars = {
      FUTURE_CRAWLER_API_KEY: envVar('tool', {
        description: 'Fetch structured pages from a new crawler.',
        tools: ['future_crawl'],
        url: 'https://future.example/keys'
      }),
      FUTURE_GATEWAY_URL: envVar('setting', { description: 'Route gateway traffic.' }),
      TELEGRAM_BOT_TOKEN: envVar('messaging', { channel_managed: true }),
      MODEL_PROVIDER_API_KEY: envVar('provider')
    }

    const entries = buildCredentialSearchEntries(
      vars,
      { settings: 'Settings', tools: 'Tools' },
      { settings: Settings2, tools: Wrench }
    )

    expect(entries.map(entry => entry.id)).toEqual([
      'credential:FUTURE_CRAWLER_API_KEY',
      'credential:FUTURE_GATEWAY_URL'
    ])
    expect(entries[0]).toMatchObject({
      context: 'Tools',
      label: 'FUTURE CRAWLER',
      target: { key: 'FUTURE_CRAWLER_API_KEY', keysView: 'tools', view: 'keys' }
    })
    expect(filterSettingsSearchEntries(entries, 'structured crawler')).toHaveLength(1)
    expect(filterSettingsSearchEntries(entries, 'future_crawl')[0]?.id).toBe('credential:FUTURE_CRAWLER_API_KEY')
    expect(filterSettingsSearchEntries(entries, 'gateway traffic')[0]?.id).toBe('credential:FUTURE_GATEWAY_URL')
  })

  it('shares the Tools and Settings category boundary with the rendered page', () => {
    expect(credentialSettingsView(envVar('tool'))).toBe('tools')
    expect(credentialSettingsView(envVar('setting'))).toBe('settings')
    expect(credentialSettingsView(envVar('messaging'))).toBe('settings')
    expect(credentialSettingsView(envVar('messaging', { channel_managed: true }))).toBeNull()
    expect(credentialSettingsView(envVar('provider'))).toBeNull()
  })

  it('uses AND matching across labels, context, descriptions, and raw keys', () => {
    const entries = buildCredentialSearchEntries(
      {
        HOMEASSISTANT_TOKEN: envVar('tool', { description: 'Connect home tools.' }),
        FAL_KEY: envVar('tool', { description: 'Generate images.' })
      },
      { settings: 'Settings', tools: 'Tools' },
      { settings: Settings2, tools: Wrench }
    )

    expect(filterSettingsSearchEntries(entries, 'home tools')[0]?.id).toBe('credential:HOMEASSISTANT_TOKEN')
    expect(filterSettingsSearchEntries(entries, 'fal generate')[0]?.id).toBe('credential:FAL_KEY')
    expect(filterSettingsSearchEntries(entries, 'home generate')).toEqual([])
  })

  it('omits BYOK web-search, browser-cloud, and Home Assistant credentials from Settings search', () => {
    const entries = buildCredentialSearchEntries(
      {
        BRAVE_SEARCH_API_KEY: envVar('tool', { description: 'Search public web pages.' }),
        FIRECRAWL_API_KEY: envVar('tool', { description: 'Extract public web pages.' }),
        BROWSERBASE_API_KEY: envVar('tool', { description: 'Drive a cloud browser.' }),
        HASS_TOKEN: envVar('tool', { description: 'Home Assistant Long-Lived Access Token.' }),
        HASS_URL: envVar('tool', { description: 'Home Assistant URL.' }),
        FAL_KEY: envVar('tool', { description: 'Generate images.' })
      },
      { settings: 'Settings', tools: 'Tools' },
      { settings: Settings2, tools: Wrench }
    )

    expect(entries.map(entry => entry.id)).toEqual(['credential:FAL_KEY'])
  })
})
