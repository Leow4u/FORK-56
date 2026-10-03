// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { probeCache } from '@/lib/mcp-probe-cache'
import { queryClient } from '@/lib/query-client'
import { $connectionsRegistry, setConnectionsRegistry } from '@/store/connections'
import type * as Work4YouApi from '@/work4you'

import { $mcpCategory, $mcpView } from './store'

const getWork4YouConfigRecord = vi.fn()
const getConnectorsDirectory = vi.fn()
const getMcpCatalog = vi.fn()
const getUsageAnalytics = vi.fn()

vi.mock('@/work4you', async importOriginal => ({
  ...(await importOriginal<typeof Work4YouApi>()),
  getWork4YouConfigRecord: () => getWork4YouConfigRecord(),
  getConnectorsDirectory: () => getConnectorsDirectory(),
  getMcpCatalog: () => getMcpCatalog(),
  getUsageAnalytics: () => getUsageAnalytics()
}))

vi.mock('@/components/chat/json-document-editor', () => ({
  JsonDocumentEditor: () => null
}))

vi.mock('@/store/notifications', () => ({
  notify: vi.fn(),
  notifyError: vi.fn()
}))

function app(partial: {
  id: string
  name: string
  section: string
  popular?: boolean
  connected?: boolean
  description?: string
}) {
  return {
    description: partial.description ?? `${partial.name} app`,
    popular: Boolean(partial.popular),
    source: 'composio',
    connected: Boolean(partial.connected),
    auth_type: 'oauth',
    ...partial
  }
}

async function renderMcpTab() {
  const { McpTab } = await import('./mcp-tab')
  await act(async () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <QueryClientProvider client={queryClient}>
          <McpTab gateway={null} />
        </QueryClientProvider>
      </I18nProvider>
    )
  })
}

beforeEach(() => {
  getWork4YouConfigRecord.mockResolvedValue({ mcp_servers: {} })
  getMcpCatalog.mockResolvedValue({ entries: [] })
  getUsageAnalytics.mockResolvedValue({ tools: [] })
  getConnectorsDirectory.mockResolvedValue({
    apps: [
      app({
        id: 'gmail',
        name: 'Gmail',
        section: 'email',
        popular: true,
        connected: true,
        description: 'Read, search, and send email.'
      }),
      app({
        id: 'instagram',
        name: 'Instagram',
        section: 'social',
        popular: true,
        connected: false,
        description: 'Instagram Business or Creator accounts.'
      })
    ],
    sections: ['email', 'social'],
    portal: true
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  queryClient.clear()
  $mcpView.set('discover')
  $mcpCategory.set('all')
})

describe('McpTab directory chrome', () => {
  it('keeps Discover and Connected, and hides All / Available', async () => {
    await renderMcpTab()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Popular' })).toBeTruthy())

    expect(screen.getByRole('button', { name: 'Discover' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Connected' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Available' })).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeTruthy()
    expect(screen.getAllByText('Instagram').length).toBeGreaterThan(0)
  })

  it('uses catalog empty copy on Discover and server empty copy on Connected', async () => {
    getConnectorsDirectory.mockResolvedValue({ apps: [], sections: [], portal: true })

    await renderMcpTab()

    await waitFor(() => expect(screen.getByText('No catalog entries available.')).toBeTruthy())
    expect(screen.getByText('Catalog')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connected' }))
    })

    await waitFor(() => expect(screen.getByText('No MCP servers')).toBeTruthy())
    expect(screen.getByText('Add a stdio or HTTP server to expose MCP tools.')).toBeTruthy()
  })

  it('does not repeat Popular on Connected', async () => {
    await renderMcpTab()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Popular' })).toBeTruthy())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connected' }))
    })

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Popular' })).toBeNull())
    expect(screen.getByText('Gmail')).toBeTruthy()
    expect(screen.queryByText('Instagram')).toBeNull()
  })
})

describe('McpTab stays on the active backend', () => {
  // The tab reads the MCP log and probes each enabled server when it opens.
  const api = vi.fn(async (req: { connectionId?: string; method?: string; path: string }) =>
    req.path.startsWith('/api/logs') ? { lines: [] } : { ok: true, tools: [] }
  )

  const requests = () => api.mock.calls.map(([req]) => req)
  const probes = (server: string) => requests().filter(req => req.path === `/api/mcp/servers/${server}/test`).length

  beforeEach(() => {
    ;(window as { work4youDesktop?: unknown }).work4youDesktop = { api }
    setConnectionsRegistry({
      version: 2,
      primary: 'local',
      secureTokenStorage: true,
      connections: [
        { id: 'local', kind: 'local', label: 'This computer', tokenSet: false, tokenPreview: null },
        { id: 'cloud-org', kind: 'cloud', label: 'Cloud', tokenSet: true, tokenPreview: null }
      ]
    })
  })

  afterEach(() => {
    $connectionsRegistry.set(null)
    delete (window as { work4youDesktop?: unknown }).work4youDesktop
  })

  it('does not add a removed server back, here or on another connection, when the tab opens again', async () => {
    getWork4YouConfigRecord.mockResolvedValue({
      mcp_servers: {
        gmail: { command: 'npx', args: ['-y', 'gmail-mcp'] },
        notion: { url: 'https://mcp.notion.com/mcp' }
      }
    })

    await renderMcpTab()
    await waitFor(() => expect(probes('notion')).toBe(1))
    const gmailProbes = probes('gmail')

    cleanup()
    queryClient.clear()
    probeCache.clear()

    // The user removed Notion from this backend's mcp.json, then came back.
    getWork4YouConfigRecord.mockResolvedValue({
      mcp_servers: { gmail: { command: 'npx', args: ['-y', 'gmail-mcp'] } }
    })

    await renderMcpTab()
    // The new server list has loaded once Gmail is probed again.
    await waitFor(() => expect(probes('gmail')).toBeGreaterThan(gmailProbes))
    await act(async () => {
      await new Promise(resolve => window.setTimeout(resolve, 0))
    })

    expect(requests().filter(req => req.method === 'POST' && req.path === '/api/mcp/servers')).toEqual([])
    expect(requests().filter(req => 'connectionId' in req)).toEqual([])
  })
})
