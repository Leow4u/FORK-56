import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetPaidCloudEntryForTests } from './paid-cloud-entry'

const getConnectionConfig = vi.fn()
const saveConnectionConfig = vi.fn()

const localConnection = {
  cloudOrg: '',
  envOverride: false,
  mode: 'local',
  remoteAuthMode: 'token',
  remoteOauthConnected: false,
  remoteTokenPreview: null,
  remoteTokenSet: false,
  remoteUrl: ''
}

beforeEach(() => {
  getConnectionConfig.mockResolvedValue(localConnection)
  saveConnectionConfig.mockResolvedValue(localConnection)
  Object.defineProperty(window, 'work4youDesktop', {
    configurable: true,
    value: { getConnectionConfig, saveConnectionConfig }
  })
})

afterEach(() => {
  cleanup()
  resetPaidCloudEntryForTests()
  vi.clearAllMocks()
})

describe('GatewaySettings', () => {
  it('loads the machine-level connection config (no profile scoping)', async () => {
    const { GatewaySettings } = await import('./gateway-settings')

    render(<GatewaySettings />)
    expect(await screen.findByText('Local gateway')).toBeTruthy()
    expect(
      screen.getByText('Start a private Work4You backend on localhost. This is the default and works offline.')
    ).toBeTruthy()

    // The page manages the machine's gateway connections; it must load the
    // global config, never a per-profile override.
    await waitFor(() => expect(getConnectionConfig).toHaveBeenCalledWith(null))
    expect(getConnectionConfig).not.toHaveBeenCalledWith(expect.any(String))

    // The legacy per-profile scope switcher must not render.
    expect(screen.queryByText('Editing profile')).toBeNull()
    expect(screen.queryByText('All profiles')).toBeNull()
    expect(screen.queryByText('Use default gateway')).toBeNull()
  })

  it('connects the signed-in paid agent on the cloud panel and hides sign out', async () => {
    const cloudConnection = {
      ...localConnection,
      mode: 'cloud',
      remoteAuthMode: 'oauth',
      remoteUrl: ''
    }

    getConnectionConfig.mockResolvedValue(cloudConnection)

    const applyConnectionConfig = vi.fn(async () => ({
      ...cloudConnection,
      cloudOrg: 'acme',
      remoteUrl: 'https://vm.example'
    }))

    Object.defineProperty(window, 'work4youDesktop', {
      configurable: true,
      value: {
        applyConnectionConfig,
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
          status: async () => ({ signedIn: true })
        },
        getConnectionConfig,
        saveConnectionConfig
      }
    })

    const { GatewaySettings } = await import('./gateway-settings')

    render(<GatewaySettings />)

    await waitFor(() =>
      expect(applyConnectionConfig).toHaveBeenCalledWith({
        cloudOrg: 'acme',
        mode: 'cloud',
        remoteAuthMode: 'oauth',
        remoteUrl: 'https://vm.example'
      })
    )
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(await screen.findByText('O meu agent')).toBeTruthy()
    expect(screen.getByText('Connected')).toBeTruthy()
  })
})
