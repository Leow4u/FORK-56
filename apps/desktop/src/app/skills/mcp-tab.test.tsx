// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { queryClient } from '@/lib/query-client'
import type * as Work4YouApi from '@/work4you'

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
