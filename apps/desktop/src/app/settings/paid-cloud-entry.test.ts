import { afterEach, describe, expect, it, vi } from 'vitest'

import { notify } from '@/store/notifications'

import { ensurePaidCloudConnection, type PaidCloudEntryDesktop, resetPaidCloudEntryForTests } from './paid-cloud-entry'

vi.mock('@/store/notifications', () => ({
  notify: vi.fn()
}))

const applied = {
  cloudOrg: 'acme',
  envOverride: false,
  mode: 'cloud' as const,
  profile: null,
  remoteAuthMode: 'oauth' as const,
  remoteOauthConnected: true,
  remoteTokenPlainText: false,
  remoteTokenPreview: null,
  remoteTokenSet: false,
  remoteUrl: 'https://vm.example',
  secureTokenStorage: true,
  sshHost: '',
  sshUser: '',
  sshPort: null,
  sshKeyPath: '',
  sshRemoteWork4YouPath: '',
  sshRemoteProfile: ''
}

function desktop(overrides: Partial<PaidCloudEntryDesktop['cloud']> = {}): PaidCloudEntryDesktop {
  return {
    applyConnectionConfig: vi.fn(async () => applied),
    cloud: {
      agentSignIn: vi.fn(async () => ({ connected: true })),
      discover: vi.fn(async () => ({
        agents: [
          {
            dashboardGatewayState: 'active',
            dashboardUrl: 'https://vm.example',
            id: 'vm',
            name: 'O meu agent',
            status: 'online'
          }
        ],
        entitlement: { canUseCloud: true },
        org: { id: 'org', isPersonal: true, name: 'Acme', role: 'OWNER', slug: 'acme' }
      })),
      status: vi.fn(async () => ({ signedIn: true })),
      ...overrides
    },
    getConnectionConfig: vi.fn(async () => ({ ...applied, mode: 'local' as const, remoteUrl: '' }))
  }
}

afterEach(() => {
  resetPaidCloudEntryForTests()
  vi.clearAllMocks()
})

describe('ensurePaidCloudConnection', () => {
  it('connects the paid agent when the desktop session is already signed in', async () => {
    const bridge = desktop()

    const next = await ensurePaidCloudConnection(bridge)

    expect(next?.remoteUrl).toBe('https://vm.example')
    expect(bridge.cloud.agentSignIn).toHaveBeenCalledWith('https://vm.example')
    expect(bridge.applyConnectionConfig).toHaveBeenCalledWith({
      cloudOrg: 'acme',
      mode: 'cloud',
      remoteAuthMode: 'oauth',
      remoteUrl: 'https://vm.example'
    })
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success', message: 'Connected to O meu agent.' }))
  })

  it('leaves a free account on its current connection', async () => {
    const bridge = desktop({
      discover: vi.fn(async () => ({
        agents: [
          {
            dashboardGatewayState: 'active',
            dashboardUrl: 'https://vm.example',
            id: 'vm',
            name: 'O meu agent',
            status: 'online'
          }
        ],
        entitlement: { canUseCloud: false }
      }))
    })

    expect(await ensurePaidCloudConnection(bridge)).toBeNull()
    expect(bridge.applyConnectionConfig).not.toHaveBeenCalled()
  })

  it('does not apply again when that dashboard is already the saved cloud connection', async () => {
    const bridge = desktop()
    bridge.getConnectionConfig = vi.fn(async () => applied)

    expect(await ensurePaidCloudConnection(bridge)).toBeNull()
    expect(bridge.cloud.agentSignIn).not.toHaveBeenCalled()
  })

  it('shares one in-flight connect across overlapping entry calls', async () => {
    let release: (value: { connected: boolean }) => void = () => undefined

    const pending = new Promise<{ connected: boolean }>(resolve => {
      release = resolve
    })

    const bridge = desktop({
      agentSignIn: vi.fn(() => pending)
    })

    const first = ensurePaidCloudConnection(bridge)
    const second = ensurePaidCloudConnection(bridge)

    release({ connected: true })

    await Promise.all([first, second])
    expect(bridge.applyConnectionConfig).toHaveBeenCalledTimes(1)
  })
})
