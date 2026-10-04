import { describe, expect, it } from 'vitest'

import type { MessagingEnvVarInfo } from '@/types/work4you'

import { teamsEndpointFor, teamsIsNetworkExposed, teamsMessagingEndpoint } from './teams-endpoint'

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

describe('teams endpoint helpers', () => {
  it('builds the messaging endpoint from the public origin, else the local bind', () => {
    expect(teamsMessagingEndpoint([])).toBe('http://127.0.0.1:3978/api/messages')
    expect(teamsMessagingEndpoint([envVar('TEAMS_PORT', '3999'), envVar('TEAMS_HOST', 'bot.local')])).toBe(
      'http://bot.local:3999/api/messages'
    )
    // An all-interfaces bind is not a reachable address to hand Azure.
    expect(teamsMessagingEndpoint([envVar('TEAMS_HOST', '0.0.0.0')])).toBe('http://127.0.0.1:3978/api/messages')
    expect(teamsMessagingEndpoint([envVar('TEAMS_PUBLIC_URL', 'https://tunnel.example/')])).toBe(
      'https://tunnel.example/api/messages'
    )
  })

  it('agrees with the saved endpoint for values typed before the save', () => {
    expect(teamsEndpointFor('https://tunnel.example/', '3978')).toBe(
      teamsMessagingEndpoint([envVar('TEAMS_PUBLIC_URL', 'https://tunnel.example/')])
    )
    expect(teamsEndpointFor('', '3999')).toBe(teamsMessagingEndpoint([envVar('TEAMS_PORT', '3999')]))
  })

  it('treats an unset or loopback host as not network exposed', () => {
    expect(teamsIsNetworkExposed([])).toBe(false)
    expect(teamsIsNetworkExposed([envVar('TEAMS_HOST', '127.0.0.1')])).toBe(false)
    expect(teamsIsNetworkExposed([envVar('TEAMS_HOST', '0.0.0.0')])).toBe(true)
  })
})
