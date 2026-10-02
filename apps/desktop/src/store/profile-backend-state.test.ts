import type { atom } from 'nanostores'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The rail's state dots come from this computed: a profile is "running" when
// the renderer holds a socket to its local backend (or it IS the active
// gateway), "waking" while a switch to it is mid-flight, else "asleep". The
// socket registry itself is stubbed; the liveness roster it publishes is real.
const { $gateway, ensureGatewayForAgent, ensureGatewayForProfile, openGatewayForProfile } = vi.hoisted(() => {
  const { atom: makeAtom } = require('nanostores') as { atom: typeof atom }

  return {
    $gateway: makeAtom<unknown>(null),
    ensureGatewayForAgent: vi.fn(async () => true),
    ensureGatewayForProfile: vi.fn(async () => undefined),
    openGatewayForProfile: vi.fn(async () => undefined)
  }
})

vi.mock('@/store/gateway', () => ({ $gateway, ensureGatewayForAgent, ensureGatewayForProfile, openGatewayForProfile }))
vi.mock('@/work4you', () => ({
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  setApiRequestProfile: vi.fn()
}))

const { $liveGatewayProfiles } = await import('@/store/gateway-liveness')
const { $activeGatewayProfile, $gatewaySwapTarget, $profileBackendStates, $profiles } = await import('@/store/profile')

function profile(name: string, isDefault = false) {
  return {
    has_env: false,
    is_default: isDefault,
    model: null,
    name,
    path: `/p/${name}`,
    provider: null,
    skill_count: 0
  }
}

beforeEach(() => {
  $profiles.set([profile('default', true), profile('research'), profile('linkedin')])
  $liveGatewayProfiles.set(new Set())
  $gatewaySwapTarget.set(null)
  $activeGatewayProfile.set('default')
})

describe('$profileBackendStates', () => {
  it('marks the active gateway profile running even before the roster catches up', () => {
    expect($profileBackendStates.get()).toEqual({ default: 'running', research: 'asleep', linkedin: 'asleep' })
  })

  it('follows the live socket roster for background profiles', () => {
    $liveGatewayProfiles.set(new Set(['default', 'research']))

    expect($profileBackendStates.get().research).toBe('running')
    expect($profileBackendStates.get().linkedin).toBe('asleep')
  })

  it('reports the switch target as waking until the swap settles', () => {
    $gatewaySwapTarget.set('linkedin')

    expect($profileBackendStates.get().linkedin).toBe('waking')

    $gatewaySwapTarget.set(null)
    $activeGatewayProfile.set('linkedin')

    expect($profileBackendStates.get().linkedin).toBe('running')
  })

  it('keys by the normalized profile name', () => {
    $profiles.set([profile('default', true), profile(' Research ')])
    $liveGatewayProfiles.set(new Set(['Research']))

    expect($profileBackendStates.get()).toHaveProperty('Research', 'running')
  })
})
