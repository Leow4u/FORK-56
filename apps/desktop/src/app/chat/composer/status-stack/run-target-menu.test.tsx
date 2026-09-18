import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { atom } from 'nanostores'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { DesktopConnectionsRegistry, Work4YouConnection } from '@/global'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { ComposerRunTargetMenu } from './run-target-menu'

const navigate = vi.fn()

vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router')>()

  return {
    ...actual,
    useNavigate: () => navigate
  }
})

vi.mock('@/store/connections', () => ({
  $activeConnectionId: atom<null | string>('local'),
  $connectionsRegistry: atom<DesktopConnectionsRegistry | null>(null),
  $pendingConnectionId: atom<null | string>(null),
  selectConnection: vi.fn(async () => undefined)
}))

vi.mock('@/store/session', () => ({
  $connection: atom<Work4YouConnection | null>(null)
}))

vi.mock('@/store/notifications', () => ({
  notifyError: vi.fn()
}))

const connectionStore = await import('@/store/connections')
const sessionStore = await import('@/store/session')
const $activeConnectionId = connectionStore.$activeConnectionId as ReturnType<typeof atom<null | string>>
const $connectionsRegistry = connectionStore.$connectionsRegistry
const $connection = sessionStore.$connection
const selectConnection = vi.mocked(connectionStore.selectConnection)

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

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  $connectionsRegistry.set(null)
  $activeConnectionId.set('local')
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

  it('switches to a registered Cloud source', async () => {
    $connectionsRegistry.set(registry([connection('local', 'local'), connection('cloud-1', 'cloud', 'Fly')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Work4You Cloud/ }))

    expect(selectConnection).toHaveBeenCalledWith('cloud-1')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('opens Settings → Gateways when Cloud is not registered', async () => {
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Work4You Cloud/ }))

    expect(selectConnection).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/settings?tab=gateway')
  })

  it('does not re-select the already-active Local source', async () => {
    $connectionsRegistry.set(registry([connection('local', 'local')]))
    render(
      <MemoryRouter>
        <ComposerRunTargetMenu />
      </MemoryRouter>
    )

    await openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Local/ }))

    expect(selectConnection).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
