import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { atom } from 'nanostores'
import { MemoryRouter } from 'react-router'
import type * as ReactRouterDom from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DesktopCloudDiscoverResult,
  DesktopConnectionConfig,
  DesktopConnectionsRegistry,
  Work4YouConnection
} from '@/global'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { $sidebarCanUseCloud } from '@/store/session-homes'

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
const notifyError = vi.mocked(notifications.notifyError)

const discover = vi.fn(async (): Promise<DesktopCloudDiscoverResult> => ({
  agents: [],
  entitlement: { canUseCloud: false }
}))

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
  discover.mockReset()
  discover.mockResolvedValue({ agents: [], entitlement: { canUseCloud: false } })
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
  $sidebarCanUseCloud.set(null)
})

async function openMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Connection mode' }), { button: 0 })

  return waitFor(() => screen.getByRole('menu'))
}

function cloudMenuItem() {
  return screen.getByRole('menuitemradio', { name: /^Cloud/ })
}

describe('ComposerRunTargetMenu', () => {
  it('shows Local with the computer icon on the connection button', () => {
    $connection.set({ mode: 'local' } as Work4YouConnection)
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    const button = screen.getByRole('button', { name: 'Connection mode' })

    expect(button.textContent).toContain('Local')
    expect(button.querySelector('.tabler-icon-device-desktop')).toBeTruthy()
    expect(button.querySelector('.tabler-icon-cloud')).toBeNull()
  })

  it('shows Cloud with the cloud icon when that connection is live', () => {
    $connection.set({
      baseUrl: 'https://agent.example',
      mode: 'remote',
      remoteKind: 'cloud'
    } as Work4YouConnection)
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    const button = screen.getByRole('button', { name: 'Connection mode' })

    expect(button.textContent).toContain('Cloud')
    expect(button.querySelector('.tabler-icon-cloud')).toBeTruthy()
    expect(button.querySelector('.tabler-icon-device-desktop')).toBeNull()
  })

  it('lists only Local and Cloud', async () => {
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

    expect(screen.getByRole('menuitemradio', { name: 'Local' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: 'Cloud' })).toBeTruthy()
    expect(screen.queryByText('The Work4You runtime managed by this app.')).toBeNull()
    expect(screen.queryByText(/A hosted instance discovered/)).toBeNull()
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
    fireEvent.click(cloudMenuItem())

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

  it('opens Settings → Billing when Cloud sign-in is not available', async () => {
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(cloudMenuItem())

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings?tab=billing'))
    expect(applyConnectionConfig).not.toHaveBeenCalled()
  })

  function withDiscover() {
    Object.defineProperty(window, 'work4youDesktop', {
      configurable: true,
      value: { applyConnectionConfig, cloud: { discover }, getConnectionConfig }
    })
  }

  it('locks Cloud on the Free plan so the row cannot be chosen', async () => {
    discover.mockResolvedValue({ agents: [], entitlement: { canUseCloud: false } })
    withDiscover()
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    const cloud = await screen.findByRole('menuitemradio', { name: 'Cloud' })

    expect(cloud.getAttribute('aria-disabled')).toBe('true')
    expect(cloud.querySelector('[data-slot="composer-cloud-lock"]')).toBeTruthy()
    expect(screen.queryByText('Cloud comes with Plus, Super, or Ultra.')).toBeNull()
    expect(screen.getByRole('menuitemradio', { name: 'Local' }).hasAttribute('data-disabled')).toBe(false)
    fireEvent.click(cloud)

    expect(navigate).not.toHaveBeenCalled()
    expect(applyConnectionConfig).not.toHaveBeenCalled()
  })

  it('says the instance is being prepared when the paid plan has no address yet', async () => {
    discover.mockResolvedValue({
      agents: [
        {
          dashboardGatewayState: 'unknown',
          dashboardUrl: null,
          id: 'born',
          name: 'Work4You Cloud',
          status: 'provisioning'
        }
      ],
      entitlement: { canUseCloud: true }
    })
    withDiscover()
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    expect(await screen.findByText('Your instance is being prepared.')).toBeTruthy()
    fireEvent.click(cloudMenuItem())

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Your instance is being prepared.',
          title: 'Work4You Cloud'
        })
      )
    )
    expect(navigate).not.toHaveBeenCalled()
    expect(applyConnectionConfig).not.toHaveBeenCalled()
  })

  it('keeps a legacy Free machine locked in the composer', async () => {
    discover.mockResolvedValue({
      agents: [
        {
          createdAt: '2026-01-01T00:00:00.000Z',
          dashboardGatewayState: 'active',
          dashboardUrl: 'https://legacy.example',
          id: 'legacy',
          name: 'Legacy',
          status: 'running'
        }
      ],
      entitlement: { canUseCloud: false },
      org: { id: 'org_1', slug: 'acme', name: 'Acme', isPersonal: true, role: 'OWNER' }
    })
    withDiscover()
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    const cloud = await screen.findByRole('menuitemradio', { name: 'Cloud' })

    expect(cloud.querySelector('[data-slot="composer-cloud-lock"]')).toBeTruthy()
    fireEvent.click(cloud)

    expect(applyConnectionConfig).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('opens Settings → Billing when the portal session needs sign-in', async () => {
    discover.mockRejectedValue(Object.assign(new Error('sign in'), { needsCloudLogin: true }))
    withDiscover()
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(cloudMenuItem())

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings?tab=billing'))
    expect(applyConnectionConfig).not.toHaveBeenCalled()
  })

  it('opens Settings → Billing when several organizations need a choice', async () => {
    discover.mockResolvedValue({ needsOrgSelection: true, orgs: [] })
    withDiscover()
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(cloudMenuItem())

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings?tab=billing'))
    expect(applyConnectionConfig).not.toHaveBeenCalled()
  })

  it('reports a discovery failure without opening Settings or connecting', async () => {
    discover.mockRejectedValue(new Error('portal offline'))
    withDiscover()
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(cloudMenuItem())

    await waitFor(() =>
      expect(notifyError).toHaveBeenCalledWith(expect.any(Error), 'Could not load your Work4You Cloud agents')
    )
    expect(navigate).not.toHaveBeenCalled()
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
    fireEvent.click(cloudMenuItem())

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
    fireEvent.click(cloudMenuItem())

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
