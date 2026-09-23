import { afterEach, describe, expect, it } from 'vitest'

import {
  _resetComposerRunTargetForTests,
  composerCloudApplyPayload,
  composerCloudPortalFromDiscover,
  composerRunTargetIntent,
  isCloudLoginError,
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
  it('follows the live descriptor over a stale Local registry id', () => {
    expect(
      resolveComposerRunTarget({
        activeConnectionId: 'local',
        connection: { mode: 'remote', remoteKind: 'cloud' },
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

  it('falls back to the active registry row when the live backend is neither', () => {
    expect(
      resolveComposerRunTarget({
        activeConnectionId: 'cloud-1',
        connection: { mode: 'remote', remoteKind: 'url' },
        connections: [local, cloud]
      })
    ).toBe('cloud')
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
        connection: { baseUrl: 'http://127.0.0.1:9' },
        remembered: { cloudOrg: 'acme', remoteUrl: 'https://remembered.example' },
        saved: { cloudOrg: '', mode: 'local', remoteUrl: '' }
      })
    ).toEqual({ cloudOrg: 'acme', remoteUrl: 'https://remembered.example' })
  })

  it('returns null when Cloud has never been connected', () => {
    expect(
      lastCloudApplySource({
        connection: { baseUrl: 'http://127.0.0.1:9' },
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

  it('keeps the Settings sign-in door when discovery has not answered', () => {
    expect(composerRunTargetIntent('cloud', { active: 'local', cloud: null })).toEqual({ type: 'settings' })
    expect(composerRunTargetIntent('cloud', { active: 'local', cloud: null, portal: { status: 'signin' } })).toEqual({
      type: 'settings'
    })
    expect(
      composerRunTargetIntent('cloud', { active: 'local', cloud: null, portal: { status: 'choose-org' } })
    ).toEqual({ type: 'settings' })
  })

  it('sends Free with no instance to the upgrade path', () => {
    expect(composerRunTargetIntent('cloud', { active: 'local', cloud: null, portal: { status: 'upgrade' } })).toEqual({
      type: 'upgrade'
    })
  })

  it('does not connect while a paid instance has no address yet', () => {
    expect(composerRunTargetIntent('cloud', { active: 'local', cloud: null, portal: { status: 'preparing' } })).toEqual(
      { type: 'preparing' }
    )
  })

  it('applies a discovered dashboard and prefers a known URL over Free', () => {
    const discovered = { cloudOrg: 'acme', remoteUrl: 'https://legacy.example' }

    expect(
      composerRunTargetIntent('cloud', {
        active: 'local',
        cloud: null,
        portal: { source: discovered, status: 'ready' }
      })
    ).toEqual({ payload: composerCloudApplyPayload(discovered), type: 'apply' })
    expect(
      composerRunTargetIntent('cloud', {
        active: 'local',
        cloud: savedCloud,
        portal: { status: 'upgrade' }
      })
    ).toEqual({ payload: composerCloudApplyPayload(savedCloud), type: 'apply' })
  })
})

describe('composerCloudPortalFromDiscover', () => {
  it('applies the oldest subscription dashboard, including a legacy Free machine', () => {
    expect(
      composerCloudPortalFromDiscover({
        agents: [
          {
            createdAt: '2026-06-01T00:00:00.000Z',
            dashboardUrl: 'https://new.example',
            id: 'new',
            status: 'running'
          },
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            dashboardUrl: 'https://old.example',
            id: 'old',
            status: 'stopped'
          }
        ],
        entitlement: { canUseCloud: false },
        org: { id: 'org_1', slug: 'acme' }
      })
    ).toEqual({
      source: { cloudOrg: 'acme', remoteUrl: 'https://old.example' },
      status: 'ready'
    })
  })

  it('does not connect a machine parked on Free', () => {
    expect(
      composerCloudPortalFromDiscover({
        agents: [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            dashboardUrl: 'https://parked.example',
            id: 'parked',
            status: 'parked'
          }
        ],
        entitlement: { canUseCloud: false },
        org: { id: 'org_1', slug: 'acme' }
      })
    ).toEqual({ status: 'upgrade' })
    expect(
      composerCloudPortalFromDiscover({
        agents: [
          {
            createdAt: '2026-02-01T00:00:00.000Z',
            dashboardUrl: 'https://parked.example',
            id: 'parked',
            status: 'parked'
          },
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            dashboardUrl: 'https://old.example',
            id: 'old',
            status: 'stopped'
          }
        ],
        entitlement: { canUseCloud: false },
        org: { slug: 'acme' }
      })
    ).toEqual({
      source: { cloudOrg: 'acme', remoteUrl: 'https://old.example' },
      status: 'ready'
    })
  })

  it('ignores self-hosted rows and refuses Free when nothing is addressable', () => {
    expect(
      composerCloudPortalFromDiscover({
        agents: [{ dashboardUrl: 'https://self.example', id: 'self', status: 'self_hosted' }],
        entitlement: { canUseCloud: false }
      })
    ).toEqual({ status: 'upgrade' })
  })

  it('waits when the paid plan has no dashboard address yet', () => {
    expect(
      composerCloudPortalFromDiscover({
        agents: [{ dashboardUrl: null, id: 'born', status: 'provisioning' }],
        entitlement: { canUseCloud: true }
      })
    ).toEqual({ status: 'preparing' })
  })

  it('does not invent a plan when entitlement is missing', () => {
    expect(composerCloudPortalFromDiscover({ agents: [] })).toEqual({ status: 'signin' })
    expect(composerCloudPortalFromDiscover({ needsOrgSelection: true })).toEqual({ status: 'choose-org' })
  })

  it('recognizes the portal sign-in error', () => {
    expect(isCloudLoginError(Object.assign(new Error('sign in'), { needsCloudLogin: true }))).toBe(true)
    expect(isCloudLoginError(new Error('offline'))).toBe(false)
  })
})
