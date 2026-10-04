import { describe, expect, it } from 'vitest'

import type { MessagingEnvVarInfo } from '@/types/work4you'

import {
  apiServerBaseUrl,
  apiServerIsNetworkExposed,
  apiServerLiveUrl,
  apiServerModelName,
  generateApiServerKey
} from './api-server-endpoint'
import { isUsableApiServerKey } from './validate-env'

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

describe('api server endpoint helpers', () => {
  it('generates keys that pass the adapter startup guard (16+ chars, URL-safe)', () => {
    const key = generateApiServerKey()

    expect(key.length).toBeGreaterThanOrEqual(16)
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(isUsableApiServerKey(key)).toBe(true)
    expect(generateApiServerKey()).not.toBe(key)
  })

  it('builds the base URL from saved values with adapter defaults filled in', () => {
    expect(apiServerBaseUrl([])).toBe('http://127.0.0.1:8642/v1')
    expect(apiServerBaseUrl([envVar('API_SERVER_PORT', '9000'), envVar('API_SERVER_HOST', 'my-server.local')])).toBe(
      'http://my-server.local:9000/v1'
    )
    // A wildcard bind is reached on loopback from this machine.
    expect(apiServerBaseUrl([envVar('API_SERVER_HOST', '0.0.0.0')])).toBe('http://127.0.0.1:8642/v1')
  })

  it('flags network-reachable binds and leaves loopback alone', () => {
    expect(apiServerIsNetworkExposed([])).toBe(false)
    expect(apiServerIsNetworkExposed([envVar('API_SERVER_HOST', '127.0.0.1')])).toBe(false)
    expect(apiServerIsNetworkExposed([envVar('API_SERVER_HOST', '0.0.0.0')])).toBe(true)
    expect(apiServerIsNetworkExposed([envVar('API_SERVER_HOST', '192.168.1.5')])).toBe(true)
  })

  it('names the model the way the adapter does: saved name, then profile, then work4you', () => {
    expect(apiServerModelName([envVar('API_SERVER_MODEL_NAME', 'my-agent')], 'coder')).toBe('my-agent')
    expect(apiServerModelName([], 'coder')).toBe('coder')
    expect(apiServerModelName([], 'default')).toBe('work4you')
    expect(apiServerModelName([], 'custom')).toBe('work4you')
    expect(apiServerModelName([], null)).toBe('work4you')
  })

  it('reads the address the live test reached, and nothing when it did not reach one', () => {
    expect(apiServerLiveUrl('API server is live at http://127.0.0.1:8642/v1 and the key is valid.')).toBe(
      'http://127.0.0.1:8642/v1'
    )
    expect(apiServerLiveUrl('Key looks strong. Restart the gateway to start the API server on 127.0.0.1:8642.')).toBe(
      null
    )
    expect(apiServerLiveUrl(undefined)).toBe(null)
  })
})
