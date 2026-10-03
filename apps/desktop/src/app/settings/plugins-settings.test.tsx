import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requestGateway, getProfiles, discoverRuntimePlugins } = vi.hoisted(() => ({
  requestGateway: vi.fn(),
  getProfiles: vi.fn<() => Promise<{ profiles: { name: string; is_default: boolean }[] }>>(async () => ({
    profiles: []
  })),
  discoverRuntimePlugins: vi.fn(async () => undefined)
}))

vi.mock('@/contrib/runtime-loader', () => ({ discoverRuntimePlugins }))

vi.mock('@/app/gateway/hooks/use-gateway-request', () => ({
  useGatewayRequest: () => ({ requestGateway })
}))

vi.mock('@/work4you', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getProfiles
}))

import { $pluginsCategory, $pluginsView } from '@/app/skills/store'
import { $pluginRecords } from '@/contrib/plugins-store'
import { queryClient } from '@/lib/query-client'
import {
  $agentPluginBusy,
  $agentPlugins,
  $agentPluginsError,
  $agentPluginsStatus,
  type AgentPluginRow
} from '@/store/agent-plugins'
import { $pluginInstallRequest } from '@/store/plugin-install-request'
import { $activeGatewayProfile } from '@/store/profile'
import { $connection, $gatewayState } from '@/store/session'

import { PluginsSettings } from './plugins-settings'

const legacyRow = {
  name: 'Legacy plugin',
  version: '0.20.0',
  description: 'Returned by a pre-key backend',
  source: 'user',
  status: 'disabled'
} satisfies AgentPluginRow

const renderSettings = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <PluginsSettings />
    </QueryClientProvider>
  )

// A category "chip" on a bundled row never enabled: the Discover inventory.
const bundledRow = (name: string, key: string, status: AgentPluginRow['status'] = 'not enabled') =>
  ({ ...legacyRow, name, key, source: 'bundled', status, kind: 'standalone' }) satisfies AgentPluginRow

const cardOf = (name: string) => screen.getByText(name).closest<HTMLElement>('[id^="plugin-"]')!

beforeEach(() => {
  // jsdom's scrollIntoView is missing; Radix Select calls it on open.
  Element.prototype.scrollIntoView = vi.fn()
  $pluginsView.set('mine')
  $pluginsCategory.set('all')
  $pluginInstallRequest.set(null)
  requestGateway.mockReset()
  getProfiles.mockReset()
  getProfiles.mockResolvedValue({ profiles: [] })
  queryClient.clear()
  $pluginRecords.set({})
  $agentPlugins.set([legacyRow])
  $agentPluginsStatus.set('ready')
  $agentPluginsError.set(null)
  $agentPluginBusy.set(null)
  $gatewayState.set('idle')
  $connection.set(null)
  $activeGatewayProfile.set('default')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PluginsSettings', () => {
  it('does not offer the plugins folder or a rescan', () => {
    renderSettings()

    expect(screen.queryByRole('button', { name: 'Open plugins folder' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rescan' })).toBeNull()
  })

  it('hides its profile selector when Capabilities owns the scope', () => {
    getProfiles.mockResolvedValue({
      profiles: [
        { name: 'default', is_default: true },
        { name: 'work', is_default: false }
      ]
    })

    render(
      <QueryClientProvider client={queryClient}>
        <PluginsSettings embedded profile="work" />
      </QueryClientProvider>
    )

    expect(screen.queryByText('Configuring:')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open plugins folder' })).toBeNull()
  })

  it('renders and searches plugin rows returned without a canonical key', () => {
    renderSettings()

    expect(screen.getByText('Legacy plugin')).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'pre-key' } })

    expect(screen.getByText('Legacy plugin')).toBeTruthy()
  })

  it('renders keyless rows read-only instead of falling back to name-addressed toggles', () => {
    // Name-addressed toggles flip every same-named plugin across category
    // dirs (image_gen/fal vs video_gen/fal) — the reason toggles moved to
    // canonical keys. A pre-contract-v6 row must never reach the RPC.
    renderSettings()

    const toggle = screen.getByRole('switch', { name: 'Enable Legacy plugin' })

    expect(toggle.hasAttribute('disabled') || toggle.getAttribute('aria-disabled') === 'true').toBe(true)

    fireEvent.click(toggle)

    expect(requestGateway).not.toHaveBeenCalledWith('plugins.manage', expect.objectContaining({ action: 'toggle' }))
  })

  it('keeps duplicate-named keyless rows distinct (no React key collision)', () => {
    const sibling = {
      ...legacyRow,
      description: 'A second plugin category with the same legacy name'
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    $agentPlugins.set([legacyRow, sibling])

    renderSettings()

    expect(screen.getAllByRole('switch', { name: 'Enable Legacy plugin' })).toHaveLength(2)
    expect(screen.getByText(sibling.description)).toBeTruthy()
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('same key')
  })

  it('keeps using the canonical key when the backend provides one', async () => {
    const keyedRow = { ...legacyRow, key: 'image_gen/legacy' }

    $agentPlugins.set([keyedRow])
    requestGateway.mockResolvedValue({ ok: true, plugin: { ...keyedRow, status: 'enabled' } })

    renderSettings()
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Legacy plugin' }))

    await waitFor(() =>
      expect(requestGateway).toHaveBeenCalledWith('plugins.manage', {
        action: 'toggle',
        key: 'image_gen/legacy',
        enable: true
      })
    )
  })

  it('keeps surface-owned kinds out and lists bundled plugins the user decided on under Agent plugins', () => {
    // Browser/image/web backends, chat platforms and model providers are
    // active without an enable and configured from their own surfaces. A
    // bundled plugin the user turned on (or off) is installed; one nobody
    // touched is a Discover entry.
    $agentPlugins.set([
      legacyRow,
      {
        ...legacyRow,
        name: 'browserbase',
        key: 'browser/browserbase',
        source: 'bundled',
        status: 'enabled',
        kind: 'backend'
      },
      { ...legacyRow, name: 'telegram', key: 'platforms/telegram', source: 'bundled', status: 'enabled' },
      { ...legacyRow, name: 'deepinfra', key: 'model-providers/deepinfra', source: 'bundled', kind: 'model-provider' },
      bundledRow('langfuse', 'observability/langfuse', 'enabled'),
      bundledRow('nemo_relay', 'observability/nemo_relay', 'disabled'),
      bundledRow('disk-cleanup', 'disk-cleanup')
    ])

    renderSettings()

    expect(screen.getByText('Legacy plugin')).toBeTruthy()
    expect(screen.getByText('langfuse')).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Disable langfuse' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Enable nemo_relay' })).toBeTruthy()
    expect(screen.queryByText('browserbase')).toBeNull()
    expect(screen.queryByText('telegram')).toBeNull()
    expect(screen.queryByText('deepinfra')).toBeNull()
    expect(screen.queryByText('disk-cleanup')).toBeNull()
    // The section count reflects the listed rows, not the raw RPC row count.
    expect(within(screen.getByRole('heading', { name: /Agent plugins/ })).getByText('3')).toBeTruthy()
  })

  it('Discover lists the bundled plugins nobody enabled, by category, and Enable turns one on', async () => {
    const langfuse = bundledRow('langfuse', 'observability/langfuse')

    $agentPlugins.set([
      legacyRow,
      bundledRow('disk-cleanup', 'disk-cleanup'),
      langfuse,
      { ...legacyRow, name: 'firecrawl', key: 'web/firecrawl', source: 'bundled', status: 'enabled', kind: 'backend' }
    ])
    requestGateway.mockResolvedValue({ ok: true, plugin: { ...langfuse, status: 'enabled' } })

    renderSettings()

    fireEvent.click(screen.getByRole('button', { name: 'Discover' }))

    expect(screen.getByRole('heading', { name: 'General' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Observability' })).toBeTruthy()
    expect(screen.getByText('disk-cleanup')).toBeTruthy()
    // Installed rows and surface-owned backends stay out of Discover.
    expect(screen.queryByText('Legacy plugin')).toBeNull()
    expect(screen.queryByText('firecrawl')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()

    fireEvent.click(within(cardOf('langfuse')).getByRole('button', { name: 'Enable' }))

    await waitFor(() =>
      expect(requestGateway).toHaveBeenCalledWith('plugins.manage', {
        action: 'toggle',
        key: 'observability/langfuse',
        enable: true
      })
    )

    // Enabled → installed: it leaves Discover and shows up under Installed with its switch on.
    await waitFor(() => expect(screen.queryByText('langfuse')).toBeNull())
    expect(screen.queryByRole('heading', { name: 'Observability' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Installed' }))

    expect(screen.getByRole('switch', { name: 'Disable langfuse' })).toBeTruthy()
  })

  it('filters the current view by category', async () => {
    $agentPlugins.set([legacyRow, bundledRow('langfuse', 'observability/langfuse', 'enabled')])
    $pluginRecords.set({
      kanban: { id: 'kanban', name: 'Kanban', kind: 'bundled', status: 'loaded', description: 'Task board' }
    })

    renderSettings()

    expect(screen.getByText('Kanban')).toBeTruthy()
    expect(screen.getByText('Legacy plugin')).toBeTruthy()

    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }))
    fireEvent.click(await screen.findByRole('option', { name: /Observability/ }))

    expect(screen.getByText('langfuse')).toBeTruthy()
    expect(screen.queryByText('Legacy plugin')).toBeNull()
    expect(screen.queryByText('Kanban')).toBeNull()
    expect(screen.queryByRole('heading', { name: /Desktop plugins/ })).toBeNull()

    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }))
    fireEvent.click(await screen.findByRole('option', { name: /Desktop/ }))

    expect(screen.getByText('Kanban')).toBeTruthy()
    expect(screen.queryByText('langfuse')).toBeNull()
    expect(screen.queryByRole('heading', { name: /Agent plugins/ })).toBeNull()
  })

  it('Add → Install plugin asks for the repository and hands it to the install flow', async () => {
    renderSettings()

    fireEvent.keyDown(screen.getByRole('button', { name: /Add/ }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Install plugin' }))

    const input = await screen.findByLabelText('Repository')
    fireEvent.change(input, { target: { value: '  owner/hello-plugin ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    expect($pluginInstallRequest.get()).toEqual({ repo: 'owner/hello-plugin' })
  })

  it('reloads desktop plugins from the overflow menu', async () => {
    renderSettings()

    fireEvent.keyDown(screen.getByRole('button', { name: 'Plugins' }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reload desktop plugins' }))

    expect(discoverRuntimePlugins).toHaveBeenCalled()
  })

  it('hides legacy other-surface categories even when the backend omits source', () => {
    // Older backends may not report source reliably — the key-prefix
    // fallback still hides categories other surfaces own.
    $agentPlugins.set([{ ...legacyRow, name: 'deepinfra', key: 'model-providers/deepinfra', source: 'user' }])

    renderSettings()

    expect(screen.queryByText('deepinfra')).toBeNull()
  })

  it('shows no profile selector with a single profile', async () => {
    getProfiles.mockResolvedValue({ profiles: [{ name: 'default', is_default: true }] })

    renderSettings()

    await waitFor(() => expect(getProfiles).toHaveBeenCalled())
    expect(screen.queryByText('Configuring:')).toBeNull()
  })

  it('lists the active profile scope without a profile param and reloads scoped on change', async () => {
    getProfiles.mockResolvedValue({
      profiles: [
        { name: 'default', is_default: true },
        { name: 'work', is_default: false }
      ]
    })
    requestGateway.mockResolvedValue({ plugins: [legacyRow] })
    $gatewayState.set('open')

    renderSettings()

    // Active profile scope: no profile param — older backends unchanged.
    await waitFor(() => expect(requestGateway).toHaveBeenCalledWith('plugins.manage', { action: 'list' }))
    await waitFor(() => expect(screen.getByText('Configuring:')).toBeTruthy())
  })

  it('sends toggles through the selected profile scope', async () => {
    // jsdom's scrollIntoView is missing/non-functional; Radix Select calls it
    // when the dropdown opens.
    Element.prototype.scrollIntoView = vi.fn()

    const keyedRow = { ...legacyRow, key: 'image_gen/legacy' }

    getProfiles.mockResolvedValue({
      profiles: [
        { name: 'default', is_default: true },
        { name: 'work', is_default: false }
      ]
    })
    requestGateway.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      if (params?.action === 'list') {
        return { plugins: [keyedRow] }
      }

      return { ok: true, plugin: { ...keyedRow, status: 'enabled' } }
    })
    $gatewayState.set('open')

    renderSettings()

    await waitFor(() => expect(screen.getByText('Configuring:')).toBeTruthy())

    // Select the non-active profile scope.
    fireEvent.click(screen.getByRole('combobox', { name: 'Configuring:' }))
    fireEvent.click(await screen.findByText('work'))

    await waitFor(() =>
      expect(requestGateway).toHaveBeenCalledWith('plugins.manage', { action: 'list', profile: 'work' })
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Enable Legacy plugin' }))

    await waitFor(() =>
      expect(requestGateway).toHaveBeenCalledWith('plugins.manage', {
        action: 'toggle',
        key: 'image_gen/legacy',
        enable: true,
        profile: 'work'
      })
    )
  })
})
