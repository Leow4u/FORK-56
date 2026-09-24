import { afterEach, describe, expect, it } from 'vitest'

import type { SessionInfo } from '@/work4you'

import {
  claimMessagingListener,
  messagingListenerPlan,
  resetMessagingListenerForTests,
  retainForeignMessaging,
  sessionOnCloud,
  tagMessagingHomes
} from './listener-home'

function row(id: string, connectionId?: string, lastActive = 1): SessionInfo {
  return { connection_id: connectionId, id, last_active: lastActive, profile: 'default', title: id } as SessionInfo
}

describe('messagingListenerPlan', () => {
  it('does nothing until the plan is known', () => {
    expect(messagingListenerPlan(null, [{ id: 'local', kind: 'local' }])).toBeNull()
  })

  it('puts a paid listener on the cloud connection and releases the device', () => {
    expect(
      messagingListenerPlan(true, [
        { id: 'local', kind: 'local' },
        { id: 'vm', kind: 'cloud' },
        { id: 'ssh', kind: 'ssh' }
      ])
    ).toEqual({ device: false, listenId: 'vm', releaseIds: ['local'] })
  })

  it('waits when a paid account has no cloud connection yet', () => {
    expect(messagingListenerPlan(true, [{ id: 'local', kind: 'local' }])).toBeNull()
  })

  it('puts a free listener on this computer and releases cloud', () => {
    expect(
      messagingListenerPlan(false, [
        { id: 'local', kind: 'local' },
        { id: 'vm', kind: 'cloud' }
      ])
    ).toEqual({ device: true, listenId: 'local', releaseIds: ['vm'] })
  })
})

describe('messaging thread homes', () => {
  afterEach(() => {
    resetMessagingListenerForTests()
  })

  it('stamps untagged rows and keeps the other home', () => {
    const incoming = tagMessagingHomes([row('cloud-thread')], 'vm')
    const previous = tagMessagingHomes([row('device-thread', undefined, 2)], 'local')
    const next = retainForeignMessaging(previous, incoming)

    expect(next.map(item => item.id)).toEqual(['device-thread', 'cloud-thread'])
    expect(sessionOnCloud('vm', [{ id: 'vm', kind: 'cloud' }])).toBe(true)
    expect(sessionOnCloud('local', [{ id: 'vm', kind: 'cloud' }])).toBe(false)
  })

  it('claims a listener placement once', () => {
    const plan = { device: true, listenId: 'local', releaseIds: ['vm'] }

    expect(claimMessagingListener(plan)).toBe(true)
    expect(claimMessagingListener(plan)).toBe(false)
  })
})
