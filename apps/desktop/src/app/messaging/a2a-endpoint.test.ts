import { describe, expect, it } from 'vitest'

import type { MessagingEnvVarInfo } from '@/types/work4you'

import {
  a2aCardUrl,
  a2aCardUrlFor,
  a2aIsLocalhostOnly,
  a2aIsNetworkExposed,
  a2aListenerFacts,
  generateA2AToken
} from './a2a-endpoint'
import { isUsableApiServerKey } from './validate-env'

function envVar(key: string, value: null | string, isSet = Boolean(value)): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: false,
    is_set: isSet,
    key,
    prompt: key,
    redacted_value: null,
    required: false,
    url: null,
    value
  }
}

describe('a2a endpoint helpers', () => {
  it('builds the Agent Card URL from the public URL, else the local bind', () => {
    expect(a2aCardUrl([])).toBe('http://127.0.0.1:9900/.well-known/agent-card.json')
    expect(a2aCardUrl([envVar('A2A_PORT', '9911'), envVar('A2A_HOST', 'my-box.local')])).toBe(
      'http://my-box.local:9911/.well-known/agent-card.json'
    )
    expect(a2aCardUrl([envVar('A2A_HOST', '0.0.0.0')])).toBe('http://127.0.0.1:9900/.well-known/agent-card.json')
    expect(a2aCardUrl([envVar('A2A_PUBLIC_URL', 'https://tunnel.example/')])).toBe(
      'https://tunnel.example/.well-known/agent-card.json'
    )
    expect(a2aCardUrlFor({ host: '0.0.0.0', port: '', publicUrl: '' })).toBe(
      'http://127.0.0.1:9900/.well-known/agent-card.json'
    )
  })

  it('treats a missing token or a loopback host as this machine only', () => {
    expect(a2aIsLocalhostOnly([])).toBe(true)
    expect(a2aIsNetworkExposed([envVar('A2A_HOST', '0.0.0.0')])).toBe(true)
    expect(a2aIsLocalhostOnly([envVar('A2A_HOST', '0.0.0.0'), envVar('A2A_BEARER_TOKEN', null, true)])).toBe(false)
    expect(a2aIsLocalhostOnly([envVar('A2A_HOST', '0.0.0.0')])).toBe(true)
  })

  it('generates tokens that pass the inbound strength check', () => {
    const token = generateA2AToken()

    expect(isUsableApiServerKey(token)).toBe(true)
    expect(generateA2AToken()).not.toBe(token)
  })

  it('reads the listener the live test reached, and nothing before it answers', () => {
    expect(
      a2aListenerFacts(
        'Listener is up on port 9900 (remote (bearer auth)). Agent Card: https://agents.example.com/.well-known/agent-card.json. 1 outbound peer configured.'
      )
    ).toEqual({ cardUrl: 'https://agents.example.com/.well-known/agent-card.json', port: '9900', remote: true })
    expect(
      a2aListenerFacts(
        'Listener is up on port 9911 (localhost-only). Agent Card: http://127.0.0.1:9911/.well-known/agent-card.json. No outbound peers configured yet — this card only makes you callable until you add a peer.'
      )
    ).toEqual({ cardUrl: 'http://127.0.0.1:9911/.well-known/agent-card.json', port: '9911', remote: false })
    expect(a2aListenerFacts('A2A starts with the gateway. Start it, then peers can fetch …')).toBe(null)
  })
})
