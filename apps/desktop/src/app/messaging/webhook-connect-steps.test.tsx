// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'

const updateMessagingPlatform = vi.fn()
const restartGateway = vi.fn()
const getActionStatus = vi.fn()
const getWebhooks = vi.fn()
const createWebhook = vi.fn()
const writeText = vi.fn()

vi.mock('@/work4you', () => ({
  createWebhook: (body: unknown, profile?: null | string) => createWebhook(body, profile),
  getActionStatus: () => getActionStatus(),
  getWebhooks: (profile?: null | string) => getWebhooks(profile),
  restartGateway: () => restartGateway(),
  testMessagingPlatform: vi.fn(),
  updateMessagingPlatform: (id: string, body: unknown, profile?: null | string) =>
    updateMessagingPlatform(id, body, profile)
}))

vi.mock('@/store/notifications', () => ({
  notify: vi.fn(),
  notifyError: vi.fn()
}))

vi.mock('@/store/system-actions', async () => {
  const { atom } = await vi.importActual<typeof NanostoresModule>('nanostores')

  return { $gatewayRestarting: atom(false), runGatewayRestart: vi.fn() }
})

const s = en.messaging.webhookPage
const SECRET = 'Zk3n9Q-8vTqL2wX0p7RmHc5aYdJ1sE4u'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  Object.assign(navigator, { clipboard: { writeText } })
  writeText.mockResolvedValue(undefined)
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'webhook' })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
  getWebhooks.mockResolvedValue({ base_url: 'http://localhost:8644', enabled: false, subscriptions: [] })
  createWebhook.mockImplementation(async (body: { deliver: string; name: string }) => ({
    created_at: null,
    deliver: body.deliver,
    deliver_only: false,
    description: '',
    enabled: true,
    events: [],
    name: body.name.toLowerCase().replaceAll(' ', '-'),
    prompt: '',
    script: '',
    secret: SECRET,
    secret_set: true,
    skills: [],
    url: `http://localhost:8644/webhooks/${body.name.toLowerCase().replaceAll(' ', '-')}`
  }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

async function renderSteps({
  listenerOn = false,
  onCancel = vi.fn(),
  scopeProfile = null as null | string,
  start = 'listener' as 'listener' | 'route'
} = {}) {
  const { WebhookConnectSteps } = await import('./webhook-connect-steps')

  await act(async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <WebhookConnectSteps
          listenerOn={listenerOn}
          onApplied={vi.fn()}
          onCancel={onCancel}
          onDone={vi.fn()}
          onManageRoutes={vi.fn()}
          scopeProfile={scopeProfile}
          start={start}
        />
      </QueryClientProvider>
    )
  })

  return { onCancel }
}

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

const shown = (text: string) => screen.getAllByRole('listitem').some(item => item.textContent === text)

describe('WebhookConnectSteps', () => {
  it('turns the listener on for the profile and moves on to the first route', async () => {
    await renderSteps({ scopeProfile: 'work' })

    expect(await screen.findByText('http://localhost:8644/webhooks/<route>')).toBeTruthy()
    await click(s.copyBaseUrl)
    expect(writeText).toHaveBeenCalledWith('http://localhost:8644')
    expect(getWebhooks).toHaveBeenCalledWith('work')

    await click(s.turnOn)

    expect(updateMessagingPlatform).toHaveBeenCalledWith('webhook', { enabled: true }, 'work')
    expect(restartGateway).toHaveBeenCalled()
    expect(screen.getByText(s.routeTitle)).toBeTruthy()
  })

  it('creates the route and shows its URL and secret this once', async () => {
    await renderSteps({ scopeProfile: 'work' })

    await click(s.turnOn)
    fireEvent.change(screen.getByLabelText(s.nameLabel), { target: { value: 'GitHub Issues' } })
    expect(screen.getByText(s.nameHelp('/webhooks/github-issues'))).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.eventsLabel), { target: { value: 'issues, issue_comment' } })
    fireEvent.change(screen.getByLabelText(s.promptLabel), { target: { value: ' Summarize it. ' } })
    await click(s.createRoute)

    expect(createWebhook).toHaveBeenCalledWith(
      { deliver: 'log', events: ['issues', 'issue_comment'], name: 'GitHub Issues', prompt: 'Summarize it.' },
      'work'
    )
    expect(screen.getByText(s.readyTitle)).toBeTruthy()
    expect(shown('Route github-issues created')).toBe(true)
    expect(shown(s.checkSecret)).toBe(true)
    expect(shown(s.checkDeliver(s.deliverLog))).toBe(true)
    expect(screen.getByText('http://localhost:8644/webhooks/github-issues')).toBeTruthy()

    await click(s.copySecret)
    expect(writeText).toHaveBeenCalledWith(SECRET)
  })

  it('asks for a name, and shows why the backend refused one', async () => {
    createWebhook.mockRejectedValue(new Error('Invalid name. Use lowercase alphanumeric with hyphens/underscores.'))
    await renderSteps({ listenerOn: true })

    await click(s.turnOn)
    expect(updateMessagingPlatform).not.toHaveBeenCalled()

    await click(s.createRoute)
    expect(screen.getByText(s.nameRequired)).toBeTruthy()
    expect(createWebhook).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(s.nameLabel), { target: { value: '-bad' } })
    await click(s.createRoute)
    expect(screen.getByText('Invalid name. Use lowercase alphanumeric with hyphens/underscores.')).toBeTruthy()
    expect(screen.getByText(s.routeTitle)).toBeTruthy()
  })

  it('starts at a new route when asked, and Back leaves the steps', async () => {
    getWebhooks.mockResolvedValue({
      base_url: 'http://localhost:8644',
      enabled: true,
      subscriptions: [{ deliver: 'log', enabled: true, events: [], name: 'existing', url: '' }]
    })
    const { onCancel } = await renderSteps({ listenerOn: true, start: 'route' })

    expect(await screen.findByText(s.routeTitleMore)).toBeTruthy()
    await click(en.common.back)
    expect(onCancel).toHaveBeenCalled()
  })

  it('says so on the ready screen when the restart did not start', async () => {
    restartGateway.mockRejectedValue(new Error('no gateway service'))
    await renderSteps()

    await click(s.turnOn)
    fireEvent.change(screen.getByLabelText(s.nameLabel), { target: { value: 'deploys' } })
    await click(s.createRoute)

    expect(
      shown(en.messaging.channelSteps.checkRestartNotStarted(': no gateway service') + en.messaging.restartGateway)
    ).toBe(true)
  })
})
