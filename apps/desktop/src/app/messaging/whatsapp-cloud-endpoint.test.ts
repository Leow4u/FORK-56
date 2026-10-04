import { describe, expect, it } from 'vitest'

import type { MessagingEnvVarInfo } from '@/types/work4you'

import { validateMessagingEnv } from './validate-env'
import {
  generateWhatsappCloudVerifyToken,
  whatsappCloudCallbackFor,
  whatsappCloudCallbackUrl,
  whatsappCloudConfirmedNumber,
  whatsappCloudIsNetworkExposed
} from './whatsapp-cloud-endpoint'

function envVar(key: string, value: null | string = null): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: false,
    is_set: Boolean(value),
    key,
    prompt: key,
    redacted_value: null,
    required: false,
    url: null,
    value
  }
}

describe('whatsapp cloud endpoint helpers', () => {
  it('builds the callback URL from the public origin, else the local bind', () => {
    expect(whatsappCloudCallbackUrl([])).toBe('http://127.0.0.1:8090/whatsapp/webhook')
    expect(
      whatsappCloudCallbackUrl([
        envVar('WHATSAPP_CLOUD_WEBHOOK_PORT', '9090'),
        envVar('WHATSAPP_CLOUD_WEBHOOK_HOST', 'wa.local'),
        envVar('WHATSAPP_CLOUD_WEBHOOK_PATH', 'hooks/meta')
      ])
    ).toBe('http://wa.local:9090/hooks/meta')
    // An all-interfaces bind is not a reachable address to hand Meta.
    expect(whatsappCloudCallbackUrl([envVar('WHATSAPP_CLOUD_WEBHOOK_HOST', '0.0.0.0')])).toBe(
      'http://127.0.0.1:8090/whatsapp/webhook'
    )
    expect(whatsappCloudCallbackUrl([envVar('WHATSAPP_CLOUD_PUBLIC_URL', 'https://tunnel.example/')])).toBe(
      'https://tunnel.example/whatsapp/webhook'
    )
  })

  it('agrees with the saved callback for an origin typed before the save', () => {
    const saved = [envVar('WHATSAPP_CLOUD_WEBHOOK_PATH', '/hooks/meta'), envVar('WHATSAPP_CLOUD_WEBHOOK_PORT', '9090')]

    expect(whatsappCloudCallbackFor('https://tunnel.example/', saved)).toBe(
      whatsappCloudCallbackUrl([...saved, envVar('WHATSAPP_CLOUD_PUBLIC_URL', 'https://tunnel.example/')])
    )
    expect(whatsappCloudCallbackFor('', saved)).toBe(whatsappCloudCallbackUrl(saved))
  })

  it('treats an unset or loopback host as not network exposed', () => {
    expect(whatsappCloudIsNetworkExposed([])).toBe(false)
    expect(whatsappCloudIsNetworkExposed([envVar('WHATSAPP_CLOUD_WEBHOOK_HOST', '127.0.0.1')])).toBe(false)
    expect(whatsappCloudIsNetworkExposed([envVar('WHATSAPP_CLOUD_WEBHOOK_HOST', '0.0.0.0')])).toBe(true)
  })

  it('generates a verify token the gateway validator accepts', () => {
    const token = generateWhatsappCloudVerifyToken()

    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(validateMessagingEnv('WHATSAPP_CLOUD_VERIFY_TOKEN', token)).toBeNull()
    expect(generateWhatsappCloudVerifyToken()).not.toBe(token)
  })

  it('reads the confirmed number out of the live test, and nothing else', () => {
    expect(
      whatsappCloudConfirmedNumber(
        'Meta confirmed the access token for +55 11 99999-3977 (Work4You). Listener is up on port 8090.'
      )
    ).toEqual({ name: 'Work4You', number: '+55 11 99999-3977' })
    expect(whatsappCloudConfirmedNumber('Meta confirmed the access token for +1 555 0100.')).toEqual({
      name: '',
      number: '+1 555 0100'
    })
    expect(whatsappCloudConfirmedNumber('Meta confirmed the access token and Phone number ID.')).toBeNull()
  })
})
