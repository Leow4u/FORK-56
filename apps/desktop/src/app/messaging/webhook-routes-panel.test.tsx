// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WebhookRoute, WebhooksResponse } from '@/types/work4you'

const getWebhooks = vi.fn()
const notify = vi.fn()
const writeText = vi.fn()

vi.mock('@/work4you', () => ({
  getWebhooks: () => getWebhooks()
}))

vi.mock('@/store/notifications', () => ({
  notify: (input: unknown) => notify(input),
  notifyError: vi.fn()
}))

vi.mock('@/store/profile', async () => {
  const { atom } = await vi.importActual<typeof NanostoresModule>('nanostores')

  return { $profileScope: atom<null | string>(null) }
})

function route(name: string, enabled = true): WebhookRoute {
  return {
    created_at: null,
    deliver: 'log',
    deliver_only: false,
    description: '',
    enabled,
    events: [],
    name,
    prompt: '',
    secret_set: true,
    skills: [],
    url: `http://localhost:8644/webhooks/${name}`
  }
}

function webhooksResponse(subscriptions: WebhookRoute[]): WebhooksResponse {
  return { base_url: 'http://localhost:8644', enabled: true, subscriptions }
}

beforeEach(() => {
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderPanel(onManageRoutes = vi.fn()) {
  const { WebhookRoutesPanel } = await import('./webhook-routes-panel')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <WebhookRoutesPanel onManageRoutes={onManageRoutes} />
      </QueryClientProvider>
    )
  })

  return onManageRoutes
}

describe('WebhookRoutesPanel', () => {
  it('shows the endpoint pattern and copies the base URL', async () => {
    getWebhooks.mockResolvedValue(webhooksResponse([route('github-pr')]))

    await renderPanel()

    expect(await screen.findByText('http://localhost:8644/webhooks/<route>')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy base URL/ }))
    })

    expect(writeText).toHaveBeenCalledWith('http://localhost:8644')
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('warns when no routes exist — the listener accepts nothing without one', async () => {
    getWebhooks.mockResolvedValue(webhooksResponse([]))

    await renderPanel()

    expect(screen.getByText(/accepts nothing until you create one/)).toBeTruthy()
  })

  it('reports active vs total routes when some are switched off', async () => {
    getWebhooks.mockResolvedValue(webhooksResponse([route('a'), route('b'), route('off', false)]))

    await renderPanel()

    expect(await screen.findByText('2 of 3 routes active.')).toBeTruthy()
  })

  it('bridges to the Webhooks page — the real management surface', async () => {
    getWebhooks.mockResolvedValue(webhooksResponse([]))

    const onManageRoutes = await renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /Manage webhook routes/ }))

    expect(onManageRoutes).toHaveBeenCalledTimes(1)
  })
})
