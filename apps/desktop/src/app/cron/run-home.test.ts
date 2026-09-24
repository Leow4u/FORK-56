import { describe, expect, it } from 'vitest'

import {
  cronCreateConnectionId,
  cronRunHomeOptions,
  cronWorkdir,
  lockedCronRunHome,
  projectFolderForScope
} from './run-home'

describe('cron run home', () => {
  it('offers cloud only when the plan can use it', () => {
    expect(cronRunHomeOptions(true)).toEqual(['device', 'cloud'])
    expect(cronRunHomeOptions(false)).toEqual(['device'])
    expect(cronRunHomeOptions(null)).toEqual(['device'])
  })

  it('keeps an existing job on the connection that stores it', () => {
    expect(lockedCronRunHome('remote', 'cloud')).toBe('cloud')
    expect(lockedCronRunHome('local', undefined)).toBe('device')
    expect(lockedCronRunHome('remote', 'ssh')).toBe('device')
  })

  it('routes a new job to that home', () => {
    const connections = [
      { id: 'local', kind: 'local' },
      { id: 'cloud-1', kind: 'cloud' }
    ]

    expect(cronCreateConnectionId('device', connections)).toBe('local')
    expect(cronCreateConnectionId('cloud', connections)).toBe('cloud-1')
  })

  it('uses the project folder on the device and only a delivered copy in the cloud', () => {
    expect(projectFolderForScope('demo', [{ id: 'demo', path: '/Users/ada/Demo' }])).toBe('/Users/ada/Demo')
    expect(projectFolderForScope('all', [{ id: 'demo', path: '/Users/ada/Demo' }])).toBeNull()
    expect(cronWorkdir('device', '/Users/ada/Demo', null)).toBe('/Users/ada/Demo')
    expect(cronWorkdir('cloud', '/Users/ada/Demo', '/opt/work4you/attached/Demo')).toBe('/opt/work4you/attached/Demo')
    expect(cronWorkdir('cloud', '/Users/ada/Demo', null)).toBeUndefined()
  })
})
