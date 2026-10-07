import { describe, expect, it } from 'vitest'

import { en } from '@/i18n/en'
import { pt } from '@/i18n/pt'
import type { MessagingPlatformInfo } from '@/types/work4you'

import { channelCardDescription } from './channel-kinds'

const platform = (id: string): MessagingPlatformInfo => ({
  id,
  name: id,
  description: 'backend fallback',
  docs_url: '',
  env_vars: [],
  enabled: false,
  configured: false,
  state: 'not_configured',
  gateway_running: false
})

describe('channelCardDescription', () => {
  it('uses locale channelDescriptions before English fallback copy', () => {
    expect(channelCardDescription(platform('telegram'), pt.messaging)).toMatch(/^Converse com o bot/)
    expect(channelCardDescription(platform('telegram'), en.messaging)).toMatch(/^Chat with the bot/)
  })

  it('covers every built-in discover card id in en and pt', () => {
    const ids = [
      'a2a',
      'api_server',
      'discord',
      'email',
      'google_chat',
      'msgraph_webhook',
      'slack',
      'sms',
      'teams',
      'telegram',
      'webhook',
      'whatsapp',
      'whatsapp_cloud'
    ] as const

    for (const id of ids) {
      expect(channelCardDescription(platform(id), en.messaging).length).toBeGreaterThan(10)
      expect(channelCardDescription(platform(id), pt.messaging).length).toBeGreaterThan(10)
      expect(channelCardDescription(platform(id), pt.messaging)).not.toBe(
        channelCardDescription(platform(id), en.messaging)
      )
    }
  })
})
