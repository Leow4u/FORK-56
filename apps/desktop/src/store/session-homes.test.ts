import { describe, expect, it } from 'vitest'

import type { SessionInfo } from '@/work4you'

import {
  CLOUD_LIST_HOME,
  retainForeignSessionHomes,
  sessionListHomeId,
  sessionOnCloudHome,
  sidebarShowsSession,
  tagSessionHome
} from './session-homes'

function row(id: string, connectionId?: string, lastActive = 1): SessionInfo {
  return { connection_id: connectionId, id, last_active: lastActive, profile: 'default', title: id } as SessionInfo
}

describe('session homes', () => {
  it('stamps an untagged row with the connection that served it', () => {
    expect(tagSessionHome(row('a'), 'local').connection_id).toBe('local')
    expect(tagSessionHome(row('a', 'cloud'), 'local').connection_id).toBe('cloud')
  })

  it('keeps the other connection when the incoming page is only one home', () => {
    const kept = retainForeignSessionHomes(
      [row('local-chat', 'local', 5), row('old-cloud', 'cloud', 4)],
      [row('new-cloud', 'cloud', 9)]
    )

    expect(kept.map(session => session.id)).toEqual(['new-cloud', 'local-chat'])
  })

  it('stamps Cloud separately from the device gateway', () => {
    expect(sessionListHomeId({ connectionId: 'app', mode: 'local' })).toBe('app')
    expect(sessionListHomeId({ connectionId: 'app', mode: 'remote', remoteKind: 'cloud' })).toBe(CLOUD_LIST_HOME)
    expect(sessionOnCloudHome(CLOUD_LIST_HOME, [])).toBe(true)
    expect(sessionOnCloudHome('app', [])).toBe(false)
  })

  it('hides cloud rows when the plan cannot use cloud', () => {
    const cloud = new Set(['cloud'])

    expect(sidebarShowsSession(row('a', 'cloud'), cloud, false)).toBe(false)
    expect(sidebarShowsSession(row('b', 'local'), cloud, false)).toBe(true)
    expect(sidebarShowsSession(row('a', 'cloud'), cloud, null)).toBe(true)
  })
})
