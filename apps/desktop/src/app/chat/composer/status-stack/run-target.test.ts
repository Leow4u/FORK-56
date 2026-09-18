import { describe, expect, it } from 'vitest'

import { composerRunTargetIntent, pickConnectionByKind, resolveComposerRunTarget } from './run-target'

const local = { id: 'local', kind: 'local' as const }
const cloud = { id: 'cloud-1', kind: 'cloud' as const }
const remote = { id: 'homelab', kind: 'remote' as const }

describe('pickConnectionByKind', () => {
  it('returns the first Local or Cloud row and skips Remote', () => {
    const rows = [remote, local, cloud]

    expect(pickConnectionByKind(rows, 'local')).toEqual(local)
    expect(pickConnectionByKind(rows, 'cloud')).toEqual(cloud)
    expect(pickConnectionByKind([remote], 'cloud')).toBeUndefined()
  })
})

describe('resolveComposerRunTarget', () => {
  it('follows the active registry row when it is Local or Cloud', () => {
    expect(
      resolveComposerRunTarget({
        activeConnectionId: 'cloud-1',
        connection: { mode: 'remote', remoteKind: 'url' },
        connections: [local, cloud]
      })
    ).toBe('cloud')
    expect(
      resolveComposerRunTarget({
        activeConnectionId: 'local',
        connection: { mode: 'local' },
        connections: [local]
      })
    ).toBe('local')
  })

  it('treats a remote-shaped Cloud descriptor as Cloud', () => {
    expect(
      resolveComposerRunTarget({
        activeConnectionId: null,
        connection: { mode: 'remote', remoteKind: 'cloud' },
        connections: []
      })
    ).toBe('cloud')
  })

  it('does not mark Remote or SSH as either composer row', () => {
    expect(
      resolveComposerRunTarget({
        activeConnectionId: 'homelab',
        connection: { mode: 'remote', remoteKind: 'url' },
        connections: [local, remote]
      })
    ).toBeNull()
  })
})

describe('composerRunTargetIntent', () => {
  it('selects the registered source when it is not already active', () => {
    expect(composerRunTargetIntent('cloud', [local, cloud], 'local')).toEqual({
      connectionId: 'cloud-1',
      type: 'select'
    })
    expect(composerRunTargetIntent('local', [local, cloud], 'cloud-1')).toEqual({
      connectionId: 'local',
      type: 'select'
    })
  })

  it('no-ops when the source is already active', () => {
    expect(composerRunTargetIntent('local', [local], 'local')).toEqual({ type: 'noop' })
    expect(composerRunTargetIntent('cloud', [cloud], 'cloud-1')).toEqual({ type: 'noop' })
  })

  it('opens Settings when Cloud is not in the registry', () => {
    expect(composerRunTargetIntent('cloud', [local, remote], 'local')).toEqual({ type: 'settings' })
  })

  it('does not invent a Local source', () => {
    expect(composerRunTargetIntent('local', [remote], 'homelab')).toEqual({ type: 'noop' })
  })
})
