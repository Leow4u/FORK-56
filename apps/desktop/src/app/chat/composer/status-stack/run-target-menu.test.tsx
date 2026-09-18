import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { atom } from 'nanostores'
import { MemoryRouter } from 'react-router'
import type * as ReactRouterDom from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesktopConnectionConfig, DesktopConnectionsRegistry, Work4YouConnection } from '@/global'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { _resetComposerRunTargetForTests } from './run-target'
import { ComposerRunTargetMenu } from './run-target-menu'

const navigate = vi.fn()
const applyConnectionConfig = vi.fn(async () => undefined)
const getConnectionConfig = vi.fn(async (): Promise<DesktopConnectionConfig> => localConfig)

vi.mock('react-router', async importOriginal => ({
  ...(await importOriginal<typeof ReactRouterDom>()),
  useNavigate: () => navigate
}))

vi.mock('@/store/connections', () => ({
  $activeConnectionId: atom<null | string>('local'),
  $connectionsRegistry: atom<DesktopConnectionsRegistry | null>(null),
  $pendingConnectionId: atom<null | string>(null)
}))

vi.mock('@/store/session', () => ({
  $connection: atom<Work4YouConnection | null>(null)
}))

vi.mock('@/store/notifications', () => ({
  notify: vi.fn(),
  notifyError: vi.fn()
}))

const connectionStore = await import('@/store/connections')
const sessionStore = await import('@/store/session')
const notifications = await import('@/store/notifications')
const $activeConnectionId = connectionStore.$activeConnectionId as ReturnType<typeof atom<null | string>>
const $connectionsRegistry = connectionStore.$connectionsRegistry
const $pendingConnectionId = connectionStore.$pendingConnectionId
const $connection = sessionStore.$connection
const notify = vi.mocked(notifications.notify)

const connection = (id: string, kind: 'cloud' | 'local' | 'remote', label = id) => ({
  id,
  kind,
  label,
  tokenPreview: null,
  tokenSet: false
})

const registry = (connections: ReturnType<typeof connection>[]): DesktopConnectionsRegistry => ({
  connections,
  primary: connections[0]?.id ?? 'local',
  secureTokenStorage: true,
  version: 2
})

const localConfig = {
  cloudOrg: '',
  envOverride: false,
  mode: 'local',
  profile: null,
  remoteAuthMode: 'oauth',
  remoteOauthConnected: false,
  remoteTokenPlainText: false,
  remoteTokenPreview: null,
  remoteTokenSet: false,
  remoteUrl: '',
  secureTokenStorage: true,
  sshHost: '',
  sshKeyPath: '',
  sshPort: null,
  sshRemoteProfile: '',
  sshRemoteWork4YouPath: '',
  sshUser: ''
} satisfies DesktopConnectionConfig

const cloudConfig = {
  ...localConfig,
  cloudOrg: 'acme',
  mode: 'cloud',
  remoteAuthMode: 'oauth',
  remoteOauthConnected: true,
  remoteUrl: 'https://agent.example'
} satisfies DesktopConnectionConfig

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

beforeEach(() => {
  getConnectionConfig.mockResolvedValue(localConfig)
  Object.defineProperty(window, 'work4youDesktop', {
    configurable: true,
    value: { applyConnectionConfig, getConnectionConfig }
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  _resetComposerRunTargetForTests()
  $connectionsRegistry.set(null)
  $activeConnectionId.set('local')
  $pendingConnectionId.set(null)
  $connection.set(null)
})

async function openMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Connection mode' }), { button: 0 })

  return waitFor(() => screen.getByRole('menu'))
}

describe('ComposerRunTargetMenu', () => {
  it('lists only Local and Work4You Cloud', async () => {
    $connectionsRegistry.set(
      registry([
        connection('local', 'local', 'This device'),
        connection('cloud-1', 'cloud', 'Fly'),
        connection('homelab', 'remote', 'Homelab')
      ])
    )
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()

    expect(screen.getByRole('menuitemradio', { name: /Local/ })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: /Work4You Cloud/ })).toBeTruthy()
    expect(screen.queryByRole('menuitemradio', { name: /Homelab/ })).toBeNull()
    expect(screen.queryByRole('menuitemradio', { name: /Remote/ })).toBeNull()
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
  })

  it('applies the last Cloud dashboard instead of opening Settings', async () => {
    getConnectionConfig.mockResolvedValue(cloudConfig)
    $connection.set({ mode: 'local' } as Work4YouConnection)
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Work4You Cloud/ }))

    await waitFor(() =>
      expect(applyConnectionConfig).toHaveBeenCalledWith({
        cloudOrg: 'acme',
        mode: 'cloud',
        remoteAuthMode: 'oauth',
        remoteUrl: 'https://agent.example'
      })
    )
    expect(navigate).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Gateway connection restarting' }))
  })

  it('opens Settings → Gateways when Cloud has never been connected', async () => {
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Work4You Cloud/ }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings?tab=gateway'))
    expect(applyConnectionConfig).not.toHaveBeenCalled()
  })

  it('applies Local through the Settings door instead of restoring a profile', async () => {
    getConnectionConfig.mockResolvedValue(cloudConfig)
    $connection.set({ baseUrl: 'https://agent.example', mode: 'remote', remoteKind: 'cloud' } as Work4YouConnection)
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Local/ }))

    await waitFor(() => expect(applyConnectionConfig).toHaveBeenCalledWith({ mode: 'local' }))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not re-apply the already-active Local backend', async () => {
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    $connection.set({ mode: 'local' } as Work4YouConnection)
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Local/ }))

    await waitFor(() => expect(getConnectionConfig).toHaveBeenCalled())
    expect(applyConnectionConfig).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('remembers a live Cloud dashboard so Settings Local does not force Settings again', async () => {
    $connection.set({ baseUrl: 'https://agent.example', mode: 'remote', remoteKind: 'cloud' } as Work4YouConnection)
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'Connection mode' })).toBeTruthy())

    getConnectionConfig.mockResolvedValue(localConfig)
    $connection.set({ mode: 'local' } as Work4YouConnection)
    $activeConnectionId.set('local')

    await openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Work4You Cloud/ }))

    await waitFor(() =>
      expect(applyConnectionConfig).toHaveBeenCalledWith({
        mode: 'cloud',
        remoteAuthMode: 'oauth',
        remoteUrl: 'https://agent.example'
      })
    )
    expect(navigate).not.toHaveBeenCalled()
  })

  it('re-applies Cloud from the in-session remember after Local wipes v1', async () => {
    getConnectionConfig.mockResolvedValue(cloudConfig)
    $connection.set({ baseUrl: 'https://agent.example', mode: 'remote', remoteKind: 'cloud' } as Work4YouConnection)
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Local/ }))
    await waitFor(() => expect(applyConnectionConfig).toHaveBeenCalledWith({ mode: 'local' }))

    applyConnectionConfig.mockClear()
    getConnectionConfig.mockResolvedValue(localConfig)
    $connection.set({ mode: 'local' } as Work4YouConnection)
    $activeConnectionId.set('local')

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Connection mode' }), { button: 0 })
    await waitFor(() => screen.getByRole('menu'))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Work4You Cloud/ }))

    await waitFor(() =>
      expect(applyConnectionConfig).toHaveBeenCalledWith({
        cloudOrg: 'acme',
        mode: 'cloud',
        remoteAuthMode: 'oauth',
        remoteUrl: 'https://agent.example'
      })
    )
    expect(navigate).not.toHaveBeenCalled()
  })
})
