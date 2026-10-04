import { describe, expect, it } from 'vitest'

import { en } from '@/i18n/en'
import type { MessagingPlatformInfo } from '@/work4you'

import { detailStatus } from './channel-status'

const row = (patch: Partial<MessagingPlatformInfo>): MessagingPlatformInfo =>
  ({
    configured: true,
    description: '',
    docs_url: '',
    enabled: true,
    env_vars: [],
    gateway_running: true,
    id: 'telegram',
    name: 'Telegram',
    state: 'connected',
    ...patch
  }) as MessagingPlatformInfo

describe('detailStatus', () => {
  it('calls an endpoint that is up listening, and a chat channel connected', () => {
    const m = en.messaging

    for (const id of ['api_server', 'webhook', 'a2a', 'msgraph_webhook']) {
      expect(detailStatus(row({ id }), m)).toEqual({ label: m.stateListening, tone: 'good' })
    }

    expect(detailStatus(row({ id: 'telegram' }), m)).toEqual({ label: m.states.connected, tone: 'good' })
  })

  it('keeps off and a stopped gateway above listening', () => {
    const m = en.messaging

    expect(detailStatus(row({ enabled: false, id: 'api_server' }), m).label).toBe(m.notConnected)
    expect(detailStatus(row({ gateway_running: false, id: 'api_server' }), m).label).toBe(m.gatewayStopped)
  })
})
