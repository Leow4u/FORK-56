import { afterEach, describe, expect, it } from 'vitest'

import {
  _resetComposerRunTargetForTests,
  composerCloudApplyPayload,
  composerRunTargetIntent,
  lastCloudApplySource,
  pickConnectionByKind,
  readRememberedComposerCloudApply,
  rememberComposerCloudApply,
  resolveComposerRunTarget
} from './run-target'

const local = { id: 'local', kind: 'local' as const }
const cloud = { id: 'cloud-1', kind: 'cloud' as const }
const remote = { id: 'homelab', kind: 'remote' as const }

afterEach(() => {
  _resetComposerRunTargetForTests()
})

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

describe('lastCloudApplySource', () => {
  it('prefers the v1 cloud block', () => {
    expect(
      lastCloudApplySource({
        connection: { baseUrl: 'https://live.example', remoteKind: 'cloud' },
        remembered: { remoteUrl: 'https://remembered.example' },
        saved: { cloudOrg: 'acme', mode: 'cloud', remoteUrl: 'https://saved.example/' }
      })
    ).toEqual({ cloudOrg: 'acme', remoteUrl: 'https://saved.example/' })
  })

  it('uses the live Cloud descriptor when v1 is no longer cloud', () => {
    expect(
      lastCloudApplySource({
        connection: { baseUrl: 'https://live.example/', remoteKind: 'cloud' },
        saved: { cloudOrg: '', mode: 'local', remoteUrl: '' }
      })
    ).toEqual({ remoteUrl: 'https://live.example/' })
  })

  it('falls back to the in-session remember after Local apply wipes v1', () => {
    expect(
      lastCloudApplySource({
        connection: { baseUrl: 'http://127.0.0.1:9', mode: 'local' },
        remembered: { cloudOrg: 'acme', remoteUrl: 'https://remembered.example' },
        saved: { cloudOrg: '', mode: 'local', remoteUrl: '' }
      })
    ).toEqual({ cloudOrg: 'acme', remoteUrl: 'https://remembered.example' })
  })

  it('returns null when Cloud has never been connected', () => {
    expect(
      lastCloudApplySource({
        connection: { baseUrl: 'http://127.0.0.1:9', mode: 'local' },
        saved: { cloudOrg: '', mode: 'local', remoteUrl: '' }
      })
    ).toBeNull()
  })
})

describe('rememberComposerCloudApply', () => {
  it('keeps the last non-empty Cloud dashboard for this session', () => {
    expect(readRememberedComposerCloudApply()).toBeNull()
    rememberComposerCloudApply({ cloudOrg: 'acme', remoteUrl: ' https://agent.example/ ' })
    expect(readRememberedComposerCloudApply()).toEqual({ cloudOrg: 'acme', remoteUrl: 'https://agent.example/' })
    rememberComposerCloudApply({ remoteUrl: '' })
    expect(readRememberedComposerCloudApply()).toEqual({ cloudOrg: 'acme', remoteUrl: 'https://agent.example/' })
  })
})

describe('composerRunTargetIntent', () => {
  const savedCloud = { remoteUrl: 'https://agent.example' }

  it('applies Cloud from the last dashboard URL without a registry row', () => {
    expect(composerRunTargetIntent('cloud', { active: 'local', cloud: savedCloud })).toEqual({
      payload: composerCloudApplyPayload(savedCloud),
      type: 'apply'
    })
  })

  it('applies Local through the Settings apply door', () => {
    expect(composerRunTargetIntent('local', { active: 'cloud', cloud: savedCloud })).toEqual({
      payload: { mode: 'local' },
      type: 'apply'
    })
  })

  it('no-ops when the live backend is already the requested target', () => {
    expect(composerRunTargetIntent('local', { active: 'local', cloud: savedCloud })).toEqual({ type: 'noop' })
    expect(composerRunTargetIntent('cloud', { active: 'cloud', cloud: savedCloud })).toEqual({ type: 'noop' })
  })

  it('opens Settings when Cloud has never been connected', () => {
    expect(composerRunTargetIntent('cloud', { active: 'local', cloud: null })).toEqual({ type: 'settings' })
  })
})
