import { describe, expect, it } from 'vitest'

import type { MessagingEnvVarInfo } from '@/types/work4you'

import {
  generateMsgraphClientState,
  msgraphIsLocalhostOnly,
  msgraphIsNetworkExposed,
  msgraphListenerFacts,
  msgraphListenerUp,
  msgraphNotificationUrl
} from './msgraph-endpoint'
import { validateMessagingEnv } from './validate-env'

function envVar(key: string, value: null | string): MessagingEnvVarInfo {
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

describe('msgraph endpoint helpers', () => {
  it('builds the notification URL from the public URL, else the local bind', () => {
    expect(msgraphNotificationUrl([])).toBe('http://127.0.0.1:8646/msgraph/webhook')
    expect(
      msgraphNotificationUrl([envVar('MSGRAPH_WEBHOOK_PORT', '8651'), envVar('MSGRAPH_WEBHOOK_HOST', 'ops.local')])
    ).toBe('http://ops.local:8651/msgraph/webhook')
    expect(msgraphNotificationUrl([envVar('MSGRAPH_WEBHOOK_HOST', '0.0.0.0')])).toBe(
      'http://127.0.0.1:8646/msgraph/webhook'
    )
    expect(msgraphNotificationUrl([envVar('MSGRAPH_WEBHOOK_PUBLIC_URL', 'https://tunnel.example/')])).toBe(
      'https://tunnel.example/msgraph/webhook'
    )
  })

  it('treats an unset or loopback host as this machine only', () => {
    expect(msgraphIsLocalhostOnly([])).toBe(true)
    expect(msgraphIsNetworkExposed([envVar('MSGRAPH_WEBHOOK_HOST', '0.0.0.0')])).toBe(true)
    expect(msgraphIsLocalhostOnly([envVar('MSGRAPH_WEBHOOK_HOST', '127.0.0.1')])).toBe(true)
  })

  it('generates a 64-char hex secret that passes the strength check', () => {
    const secret = generateMsgraphClientState()

    expect(secret).toMatch(/^[0-9a-f]{64}$/)
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_CLIENT_STATE', secret)).toBeNull()
    expect(generateMsgraphClientState()).not.toBe(secret)
  })

  it('reads a listener that answered, including one behind the source allowlist', () => {
    const up =
      'Listener is up on port 8646 (localhost-only). Register https://bot.example.com/msgraph/webhook with Graph.'

    expect(msgraphListenerFacts(up)).toEqual({
      network: false,
      notifyUrl: 'https://bot.example.com/msgraph/webhook',
      port: '8646'
    })
    expect(msgraphListenerUp(up)).toBe(true)

    const gated =
      'The listener on 127.0.0.1:8646 answered /health with HTTP 403 — the source-IP allowlist is active (expected for a production bind). The process is up. Register https://bot.example.com/msgraph/webhook with Graph; probe /health from an allowed Microsoft egress IP.'

    expect(msgraphListenerFacts(gated)).toBe(null)
    expect(msgraphListenerUp(gated)).toBe(true)
    expect(msgraphListenerUp('Microsoft Graph webhook starts with the gateway. Start it, then register …')).toBe(false)
  })
})
