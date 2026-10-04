// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'
import type { MessagingPlatformInfo } from '@/types/work4you'

const { $activeGatewayProfile } = await import('@/store/profile')
const { $settingsScopeOverride, setSettingsScope } = await import('@/store/settings-scope')
const { $channelsCategory, $channelsSnapshots, $channelsView } = await import('./store')

const getMessagingPlatforms = vi.fn()
const updateMessagingPlatform = vi.fn()
const testMessagingPlatform = vi.fn()
const getPairing = vi.fn()
const approvePairing = vi.fn()
const revokePairing = vi.fn()
const openExternalLink = vi.fn()
const getCronJobs = vi.fn()
const runGatewayRestart = vi.fn()
const getWebhooks = vi.fn()
const getA2AAgents = vi.fn()
const getToolsets = vi.fn()
const setWebhookEnabled = vi.fn()

vi.mock('@/work4you', () => ({
  approvePairing: (platformId: string, requestId: string) => approvePairing(platformId, requestId),
  applyTelegramOnboarding: vi.fn(),
  applyWhatsAppOnboarding: vi.fn(),
  cancelTelegramOnboarding: vi.fn(),
  cancelWhatsAppOnboarding: vi.fn(),
  getA2AAgents: (profile?: null | string) => getA2AAgents(profile),
  getActionStatus: vi.fn(),
  getCronJobs: (profile?: string) => getCronJobs(profile),
  getMessagingPlatforms: (profile?: null | string) => getMessagingPlatforms(profile),
  getPairing: (profile?: null | string) => getPairing(profile),
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  getTelegramOnboardingStatus: vi.fn(),
  getToolsets: (profile?: null | string) => getToolsets(profile),
  getWebhooks: (profile?: null | string) => getWebhooks(profile),
  getWhatsAppOnboardingStatus: vi.fn(),
  revokePairing: (platformId: string, userId: string) => revokePairing(platformId, userId),
  setApiRequestProfile: vi.fn(),
  setWebhookEnabled: (name: string, enabled: boolean, profile?: null | string) =>
    setWebhookEnabled(name, enabled, profile),
  startTelegramOnboarding: vi.fn(),
  startWhatsAppOnboarding: vi.fn(),
  testMessagingPlatform: (id: string) => testMessagingPlatform(id),
  updateMessagingPlatform: (id: string, body: unknown) => updateMessagingPlatform(id, body)
}))

// Keep store/profile's side-effecting imports inert (pulled in via the shared
// settings scope store) — same seam as store/profile.test.ts.
vi.mock('@/store/gateway', () => ({
  $gateway: { get: () => null, subscribe: () => () => {} },
  ensureGatewayForAgent: vi.fn(async () => undefined),
  ensureGatewayForProfile: vi.fn(async () => undefined),
  openGatewayForProfile: vi.fn(async () => undefined)
}))
vi.mock('@/lib/query-client', () => ({ invalidateProfileScopedQueries: vi.fn() }))
vi.mock('@/store/starmap', () => ({ resetStarmapGraph: vi.fn() }))

vi.mock('@/lib/external-link', () => ({
  openExternalLink: (href: string) => openExternalLink(href)
}))

vi.mock('@/store/notifications', () => ({
  notify: vi.fn(),
  notifyError: vi.fn()
}))

vi.mock('@/store/system-actions', async () => {
  const { atom } = await vi.importActual<typeof NanostoresModule>('nanostores')

  return { $gatewayRestarting: atom(false), runGatewayRestart: () => runGatewayRestart() }
})

function envField(key: string, value: string, patch: Partial<MessagingPlatformInfo['env_vars'][number]> = {}) {
  return {
    advanced: false,
    description: key,
    is_password: false,
    is_set: Boolean(value),
    key,
    prompt: key,
    redacted_value: value ? '***' : null,
    required: false,
    url: null,
    value: value || null,
    ...patch
  }
}

/** WhatsApp on and connected in bot mode with two allowed numbers. */
function whatsappReady(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return platform({
    configured: true,
    enabled: true,
    env_vars: [
      envField('WHATSAPP_MODE', 'bot', { advanced: true }),
      envField('WHATSAPP_DM_POLICY', 'pairing', { advanced: true }),
      envField('WHATSAPP_ALLOWED_USERS', '15551234567,15557654321'),
      envField('WHATSAPP_CLOUD_ACCESS_TOKEN', '', { is_password: true, prompt: 'Access token' })
    ],
    id: 'whatsapp',
    name: 'WhatsApp',
    state: 'connected',
    whatsapp_setup: { allowed_users_set: true, home_channel_set: false, mode: 'bot' },
    ...patch
  })
}

/** Telegram on and connected with two allowed user ids. */
function telegramReady(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return platform({
    configured: true,
    enabled: true,
    env_vars: [
      envField('TELEGRAM_BOT_TOKEN', '123456789:secret', {
        is_password: true,
        prompt: 'Telegram bot token',
        required: true,
        value: null
      }),
      envField('TELEGRAM_ALLOWED_USERS', '123456789,987654321'),
      envField('TELEGRAM_PROXY', '', { advanced: true })
    ],
    id: 'telegram',
    name: 'Telegram',
    state: 'connected',
    ...patch
  })
}

/** Discord on and connected with two allowed user ids. */
function discordReady(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return platform({
    configured: true,
    enabled: true,
    env_vars: [
      envField('DISCORD_BOT_TOKEN', 'secret', { is_password: true, required: true, value: null }),
      envField('DISCORD_ALLOWED_USERS', '284102345678901234,284109876543210987')
    ],
    id: 'discord',
    name: 'Discord',
    state: 'connected',
    ...patch
  })
}

/** Slack on and connected with two allowed member ids. */
function slackReady(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return platform({
    configured: true,
    enabled: true,
    env_vars: [
      envField('SLACK_BOT_TOKEN', 'secret', { is_password: true, required: true, value: null }),
      envField('SLACK_APP_TOKEN', 'secret', { is_password: true, required: true, value: null }),
      envField('SLACK_ALLOWED_USERS', 'U01ABC2DEF3,U04XYZ9GHI7')
    ],
    id: 'slack',
    name: 'Slack',
    state: 'connected',
    ...patch
  })
}

/** Microsoft Teams on and connected behind a tunnel, with one allowed id. */
function teamsReady(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return platform({
    configured: true,
    enabled: true,
    env_vars: [
      envField('TEAMS_CLIENT_ID', '1b2c3d4e-0000-4000-8000-00000000abcd', { required: true }),
      envField('TEAMS_CLIENT_SECRET', 'secret', { is_password: true, required: true, value: null }),
      envField('TEAMS_TENANT_ID', '9a8b7c6d-0000-4000-8000-00000000dcba', { required: true }),
      envField('TEAMS_ALLOWED_USERS', '6f1c2a9e-0b7d-4c55-9a51-2f3e4d5c6b7a'),
      envField('TEAMS_PUBLIC_URL', 'https://bot.example.com')
    ],
    id: 'teams',
    name: 'Microsoft Teams',
    state: 'connected',
    ...patch
  })
}

/** WhatsApp Cloud API on and connected behind a tunnel, with two numbers. */
function whatsappCloudReady(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return platform({
    configured: true,
    enabled: true,
    env_vars: [
      envField('WHATSAPP_CLOUD_PHONE_NUMBER_ID', '109876543210987', { required: true }),
      envField('WHATSAPP_CLOUD_ACCESS_TOKEN', 'secret', { is_password: true, required: true, value: null }),
      envField('WHATSAPP_CLOUD_ALLOWED_USERS', '5511999993977,5511988880000'),
      envField('WHATSAPP_CLOUD_PUBLIC_URL', 'https://bot.example.com')
    ],
    id: 'whatsapp_cloud',
    name: 'WhatsApp Cloud API',
    state: 'connected',
    ...patch
  })
}

/** Email on and connected with two allowed senders. */
function emailReady(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return platform({
    configured: true,
    enabled: true,
    env_vars: [
      envField('EMAIL_ADDRESS', 'bot@example.com', { required: true }),
      envField('EMAIL_PASSWORD', 'secret', { is_password: true, required: true, value: null }),
      envField('EMAIL_IMAP_HOST', 'imap.gmail.com', { required: true }),
      envField('EMAIL_SMTP_HOST', 'smtp.gmail.com', { required: true }),
      envField('EMAIL_ALLOWED_USERS', 'ana@example.com,bruno@example.com')
    ],
    id: 'email',
    name: 'Email',
    state: 'connected',
    ...patch
  })
}

/** SMS on and connected through Twilio with two allowed numbers. */
function smsReady(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return platform({
    configured: true,
    enabled: true,
    env_vars: [
      envField('TWILIO_ACCOUNT_SID', 'AC' + '0123456789abcdef'.repeat(2), { required: true }),
      envField('TWILIO_AUTH_TOKEN', 'secret', { is_password: true, required: true, value: null }),
      envField('TWILIO_PHONE_NUMBER', '+15551234567', { required: true }),
      envField('SMS_WEBHOOK_URL', 'https://bot.example.com/webhooks/twilio', { required: true }),
      envField('SMS_ALLOWED_USERS', '+5511999993977,+5511988880000')
    ],
    id: 'sms',
    name: 'SMS (Twilio)',
    state: 'connected',
    ...patch
  })
}

/** Google Chat on and connected through Pub/Sub with two allowed people. */
function googleChatReady(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return platform({
    configured: true,
    enabled: true,
    env_vars: [
      envField('GOOGLE_CHAT_SERVICE_ACCOUNT_JSON', 'key', { is_password: true, value: null }),
      envField('GOOGLE_CHAT_PROJECT_ID', 'work4you-chat'),
      envField('GOOGLE_CHAT_SUBSCRIPTION_NAME', 'projects/work4you-chat/subscriptions/chat-events'),
      envField('GOOGLE_CHAT_HTTP_EVENTS_URL', ''),
      envField('GOOGLE_CHAT_ALLOWED_USERS', 'ana@acme.com,bruno@acme.com')
    ],
    id: 'google_chat',
    name: 'Google Chat',
    state: 'connected',
    ...patch
  })
}

/** The API server on and listening on port 9000 with a saved key. */
function apiServerReady(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return platform({
    configured: true,
    enabled: true,
    env_vars: [
      envField('API_SERVER_KEY', 'secret', {
        is_password: true,
        redacted_value: 'AbCd...4f2a',
        required: true,
        value: null
      }),
      envField('API_SERVER_PORT', '9000'),
      envField('API_SERVER_HOST', ''),
      envField('API_SERVER_MODEL_NAME', ''),
      envField('API_SERVER_CORS_ORIGINS', '')
    ],
    id: 'api_server',
    name: 'API server',
    state: 'connected',
    ...patch
  })
}

/** A webhook route as the routes list returns it. */
function webhookRoute(name: string, events: string[], deliver: string, enabled = true) {
  return {
    created_at: null,
    deliver,
    deliver_only: false,
    description: '',
    enabled,
    events,
    name,
    prompt: '',
    script: '',
    secret_set: true,
    skills: [],
    url: `http://localhost:8644/webhooks/${name}`
  }
}

function platform(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return {
    configured: false,
    description: 'A platform.',
    docs_url: '',
    enabled: false,
    env_vars: [],
    gateway_running: true,
    id: 'mattermost',
    name: 'Mattermost',
    state: 'disabled',
    ...patch
  }
}

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'mattermost' })
  getPairing.mockResolvedValue({ approved: [], pending: [] })
  getCronJobs.mockResolvedValue([])
  getWebhooks.mockResolvedValue({ base_url: 'http://localhost:8644', enabled: false, subscriptions: [] })
  setWebhookEnabled.mockResolvedValue({ enabled: true, name: 'route', ok: true })
  getA2AAgents.mockResolvedValue({ agents: [] })
  getToolsets.mockResolvedValue([{ enabled: false, name: 'a2a' }])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  $settingsScopeOverride.set(null)
  $activeGatewayProfile.set('default')
  $channelsView.set(null)
  $channelsCategory.set('all')
  $channelsSnapshots.set({})
})

async function renderMessaging() {
  const { MessagingView } = await import('./index')
  let result: ReturnType<typeof render>
  await act(async () => {
    result = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/messaging']}>
          <Routes>
            <Route element={<MessagingView />} path="/messaging/:platformId?" />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  })

  return result!
}

async function openChannel(name: string) {
  const card = await screen.findByRole('button', { name: new RegExp(name) })
  await act(async () => {
    fireEvent.click(card)
  })
}

describe('MessagingView list header', () => {
  it('opens under the page title with a readable pill search field', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform(), platform({ id: 'discord', name: 'Discord' })]
    })

    await renderMessaging()

    expect(await screen.findByRole('button', { name: /Mattermost/ })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: en.sidebar.nav.messaging })).toBeTruthy()
    const search = screen.getByRole('textbox', { name: /Search messaging/i })
    expect(search.parentElement?.className).toContain('rounded-full')
    expect(search.parentElement?.className).not.toContain('opacity-30')
  })

  it('filters the channel list from the pill search field', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform(), platform({ id: 'discord', name: 'Discord' })]
    })

    await renderMessaging()
    expect(await screen.findByRole('button', { name: /Mattermost/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Discord/ })).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox', { name: /Search messaging/i }), {
      target: { value: 'disc' }
    })

    expect(screen.getByRole('button', { name: /Discord/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Mattermost/ })).toBeNull()
  })
})

describe('MessagingView revisit', () => {
  it('paints the last channel list at once on a revisit and refreshes it behind', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ configured: true, enabled: true, state: 'connected' })]
    })

    const first = await renderMessaging()
    expect(await screen.findByRole('button', { name: /Mattermost/ })).toBeTruthy()
    first.unmount()

    // The next load is slow: the rows must come from the last visit, not from it.
    let release: (value: { platforms: MessagingPlatformInfo[] }) => void = () => undefined
    getMessagingPlatforms.mockReset()
    getMessagingPlatforms.mockReturnValue(new Promise(resolve => (release = resolve)))

    await renderMessaging()

    expect(screen.getByRole('button', { name: /Mattermost/ })).toBeTruthy()
    expect(screen.queryByText(en.messaging.loading)).toBeNull()
    expect(getMessagingPlatforms).toHaveBeenCalledTimes(1)

    await act(async () => {
      release({ platforms: [platform({ configured: true, enabled: true, state: 'connected' })] })
    })
  })

  it("never files one scope's rows under another scope on a profile switch", async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ configured: true, enabled: true, state: 'connected' })]
    })

    await renderMessaging()
    expect(await screen.findByRole('button', { name: /Mattermost/ })).toBeTruthy()

    // The other profile's list never answers: its page must open blank, not
    // on the primary's rows, and must not remember them as its own either.
    getMessagingPlatforms.mockReset()
    getMessagingPlatforms.mockReturnValue(new Promise(() => undefined))

    await act(async () => {
      setSettingsScope('research')
    })

    expect(screen.queryByRole('button', { name: /Mattermost/ })).toBeNull()
    const snapshots = $channelsSnapshots.get()
    expect(snapshots.research).toBeUndefined()
    // Only the scope the rows were fetched for remembers them.
    expect(Object.values(snapshots).map(snapshot => snapshot.platforms.map(row => row.id))).toEqual([['mattermost']])
  })
})

describe('MessagingView Connected | Discover', () => {
  it('opens on Discover, as cards with a Connect button, while no channel is on', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform(), platform({ id: 'discord', name: 'Discord' })]
    })

    await renderMessaging()

    expect(await screen.findByRole('button', { name: /Mattermost/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Discover' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByRole('button', { name: en.common.connect })).toHaveLength(2)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('opens on Connected, as a table of the channels that are on, and keeps the rest under Discover', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [
        platform({ configured: true, enabled: true, state: 'connected' }),
        platform({ id: 'discord', name: 'Discord' })
      ]
    })
    getPairing.mockResolvedValue({
      approved: [{ platform: 'mattermost', request_id: 'a1', user_id: 'u1' }],
      pending: [{ platform: 'mattermost', request_id: 'p1', user_id: 'u2' }]
    })

    await renderMessaging()

    const table = await screen.findByRole('table')
    expect(screen.getByRole('button', { name: en.skills.viewConnected }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('columnheader', { name: en.messaging.columnChannel })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Mattermost/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Discord/ })).toBeNull()
    // Paired users and the pairing requests still waiting, from the pairing feed.
    expect(table.textContent).toContain(en.messaging.pendingBadge(1))
    expect(screen.getByRole('switch', { name: en.messaging.disableAria('Mattermost') })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Discover' }))

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('button', { name: /Discord/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Mattermost/ })).toBeNull()
  })

  it('groups Discover by what is on the other end: people, then systems', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [
        platform(),
        platform({ id: 'api_server', name: 'API server' }),
        platform({ id: 'webhook', name: 'Webhooks' }),
        platform({ id: 'discord', name: 'Discord' })
      ]
    })

    await renderMessaging()

    const conversation = await screen.findByRole('heading', { level: 2, name: /Conversation/ })
    const integrations = screen.getByRole('heading', { level: 2, name: /Integrations/ })
    expect(conversation.textContent).toContain(en.messaging.discoverConversationHint)
    expect(integrations.textContent).toContain(en.messaging.discoverIntegrationsHint)

    const conversationSection = conversation.closest('section')!
    const integrationsSection = integrations.closest('section')!
    expect(within(conversationSection).getByRole('button', { name: /Mattermost/ })).toBeTruthy()
    expect(within(conversationSection).getByRole('button', { name: /Discord/ })).toBeTruthy()
    expect(within(conversationSection).queryByRole('button', { name: /Webhooks/ })).toBeNull()
    expect(within(integrationsSection).getByRole('button', { name: /Webhooks/ })).toBeTruthy()
    // The card says what the channel is for, not how it is wired.
    expect(within(integrationsSection).getByText(/Let GitHub, GitLab and other services trigger the bot/)).toBeTruthy()
    // Common triggers first, whatever order the backend lists them in.
    const cardName = /^(API server|Webhooks)/
    const integrationCards = within(integrationsSection).getAllByRole('button', { name: cardName })
    expect(integrationCards.map(card => cardName.exec(card.textContent ?? '')?.[1])).toEqual(['Webhooks', 'API server'])
  })

  it('narrows both views to one kind of channel from the category filter', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform(), platform({ id: 'webhook', name: 'Webhooks' })]
    })
    $channelsCategory.set('integration')

    await renderMessaging()

    expect(await screen.findByRole('button', { name: /Webhooks/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Mattermost/ })).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: /Conversation/ })).toBeNull()
  })

  it('shows only the group that still has something to connect', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ id: 'webhook', name: 'Webhooks' })]
    })

    await renderMessaging()

    expect(await screen.findByRole('heading', { level: 2, name: /Integrations/ })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: /Conversation/ })).toBeNull()
  })

  it('names the type of each connected channel in the table', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [
        platform({ configured: true, enabled: true, state: 'connected' }),
        platform({ configured: true, enabled: true, id: 'api_server', name: 'API server', state: 'connected' })
      ]
    })

    await renderMessaging()

    await screen.findByRole('table')
    expect(screen.getByRole('columnheader', { name: en.messaging.columnType })).toBeTruthy()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining(en.messaging.kindConversation),
      expect.stringContaining(en.messaging.kindIntegration)
    ])
  })

  it('turns a channel off from its row in the Connected table', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ configured: true, enabled: true, state: 'connected' })]
    })

    await renderMessaging()

    await act(async () => {
      fireEvent.click(await screen.findByRole('switch', { name: en.messaging.disableAria('Mattermost') }))
    })

    await waitFor(() => expect(updateMessagingPlatform).toHaveBeenCalledWith('mattermost', { enabled: false }))
    // Off now, it is a Discover card again — and with nothing left on, the
    // unpicked view follows it there.
    expect(await screen.findByRole('button', { name: en.common.connect })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('MessagingView setup-guide link', () => {
  it('hides the setup-guide button for a plugin platform with no docs URL', async () => {
    // Some plugin platforms ship an empty docs_url. Rendering an
    // anchor with href="" let Electron resolve it to the app's own packaged
    // index.html and fail with an OS "file not found" dialog. The button must
    // simply not appear when there is no guide to open.
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ docs_url: '' })] })

    await renderMessaging()
    await openChannel('Mattermost')

    expect((await screen.findAllByText('Mattermost')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Open setup guide')).toBeNull()
  })

  it('opens a real docs URL through the validated external opener', async () => {
    const docsUrl = 'https://work4you.ai/docs/user-guide/messaging/mattermost'
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ docs_url: docsUrl })] })

    await renderMessaging()
    await openChannel('Mattermost')

    const link = await screen.findByText('Open setup guide')
    await act(async () => {
      fireEvent.click(link)
    })

    await waitFor(() => expect(openExternalLink).toHaveBeenCalledWith(docsUrl))
  })
})

describe('MessagingView pairing', () => {
  const pendingUser = {
    age_minutes: 3,
    platform: 'mattermost',
    request_id: 'a1b2c3d4e5f60718',
    user_id: '7712345',
    user_name: 'Bee'
  }

  it('approves the listed request by its request id, never by a code', async () => {
    // The whole point of the request-id grant path: the UI can only ever send
    // the server-side row id, because the one-time code is never returned by
    // the API. Posting anything derived from the code could not be approved.
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform()] })
    getPairing.mockResolvedValue({ approved: [], pending: [pendingUser] })
    approvePairing.mockResolvedValue({ ok: true, user: { user_id: '7712345', user_name: 'Bee' } })

    await renderMessaging()
    await openChannel('Mattermost')

    const approve = await screen.findByRole('button', { name: 'Approve' })
    await act(async () => {
      fireEvent.click(approve)
    })

    await waitFor(() => expect(approvePairing).toHaveBeenCalledWith('mattermost', 'a1b2c3d4e5f60718'))
  })

  it('restores the pending row when approval fails', async () => {
    // Optimistic removal must not silently swallow the request: a failed
    // approve has to leave the operator something to retry.
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform()] })
    getPairing.mockResolvedValue({ approved: [], pending: [pendingUser] })
    approvePairing.mockRejectedValue(new Error('500 boom'))

    await renderMessaging()
    await openChannel('Mattermost')

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    })

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeTruthy()
    expect(screen.getByText('Bee')).toBeTruthy()
  })

  it('shows no pairing affordance when nobody is waiting', async () => {
    // Approvals are rare; an always-present empty state would be permanent
    // chrome on a page that is otherwise about credentials.
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform()] })
    getPairing.mockResolvedValue({ approved: [], pending: [] })

    await renderMessaging()

    expect((await screen.findAllByText('Mattermost')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByText(/Pending requests/)).toBeNull()
  })

  it('still renders platforms when the pairing endpoint fails', async () => {
    // An older backend without the endpoint must not blank the page.
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform()] })
    getPairing.mockRejectedValue(new Error('404 not found'))

    await renderMessaging()

    expect((await screen.findAllByText('Mattermost')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
  })

  it('saves credentials and enables a disabled channel in one gesture', async () => {
    // "Save & enable": entering credentials on an off channel should not
    // require hunting for the toggle afterwards — the save body carries
    // enabled: true. The switch remains the way to turn a channel off.
    getMessagingPlatforms.mockResolvedValue({
      platforms: [
        platform({
          enabled: false,
          env_vars: [
            {
              advanced: false,
              description: 'Bot token.',
              is_password: true,
              is_set: false,
              key: 'MATTERMOST_TOKEN',
              prompt: 'Mattermost bot token',
              redacted_value: null,
              required: true,
              url: null
            }
          ]
        })
      ]
    })

    await renderMessaging()
    await openChannel('Mattermost')

    const input = await screen.findByLabelText('Bot token')
    fireEvent.change(input, { target: { value: 'abc-123' } })

    const save = await screen.findByRole('button', { name: /Save & enable/ })
    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('mattermost', {
        enabled: true,
        env: { MATTERMOST_TOKEN: 'abc-123' }
      })
    )
  })

  it('keeps plain saves on an enabled channel from touching the toggle', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [
        platform({
          enabled: true,
          env_vars: [
            {
              advanced: false,
              description: 'Bot token.',
              is_password: true,
              is_set: true,
              key: 'MATTERMOST_TOKEN',
              prompt: 'Mattermost bot token',
              redacted_value: 'abc…123',
              required: true,
              url: null
            }
          ]
        })
      ]
    })

    await renderMessaging()
    await openChannel('Mattermost')

    fireEvent.change(await screen.findByLabelText(/Bot token/), { target: { value: 'new-token' } })

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Save changes/ }))
    })

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('mattermost', { env: { MATTERMOST_TOKEN: 'new-token' } })
    )
  })

  it('blocks the save and shows the field error for a malformed Telegram token', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [telegramReady()] })

    await renderMessaging()
    await openChannel('Telegram')
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: new RegExp(en.messaging.advancedTitle) }))
    })

    // Only the numeric bot-id half of the token — the classic paste mistake.
    fireEvent.change(await screen.findByLabelText(/^Bot token/), { target: { value: '123456789' } })

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: en.messaging.saveChanges }))
    })

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(await screen.findByText(/complete token from @BotFather/)).toBeTruthy()

    // Editing the rejected value clears the stale error immediately.
    fireEvent.change(screen.getByLabelText(/^Bot token/), { target: { value: '123456789:' } })
    expect(screen.queryByText(/complete token from @BotFather/)).toBeNull()
  })

  it('runs the connection test from the action bar and reports the result', async () => {
    const { notify } = await import('@/store/notifications')

    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ configured: true, enabled: true })] })
    testMessagingPlatform.mockResolvedValue({ message: 'Connected as @bot', ok: true })

    await renderMessaging()
    await openChannel('Mattermost')

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Test' }))
    })

    await waitFor(() => expect(testMessagingPlatform).toHaveBeenCalledWith('mattermost'))
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success', message: 'Connected as @bot' }))
    )
  })

  it('keeps the enable switch and test with the setup form', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ configured: true, enabled: true, id: 'whatsapp', name: 'WhatsApp', state: 'ready' })]
    })

    await renderMessaging()
    await openChannel('WhatsApp')

    const toggle = await screen.findByRole('switch', { name: /WhatsApp/ })
    const test = screen.getByRole('button', { name: en.messaging.testConnection })
    expect(toggle.closest('footer')).toBeNull()
    expect(test.closest('footer')).toBeNull()
    expect(toggle.closest('main')).toBe(test.closest('main'))
  })

  it('hides the connection test until the channel has credentials to probe', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ configured: false })] })

    await renderMessaging()

    expect((await screen.findAllByText('Mattermost')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Test' })).toBeNull()
  })

  it('renders closed-set env keys as a picker and saves the chosen value', async () => {
    // WHATSAPP_DM_POLICY has four magic words nobody should have to guess —
    // the picker turns the free-text env field into labeled choices.
    getMessagingPlatforms.mockResolvedValue({
      platforms: [
        platform({
          id: 'whatsapp',
          name: 'WhatsApp',
          enabled: true,
          env_vars: [
            {
              advanced: false,
              description: 'DM policy.',
              is_password: false,
              is_set: false,
              key: 'WHATSAPP_DM_POLICY',
              prompt: 'DM policy',
              redacted_value: null,
              required: false,
              url: null
            }
          ]
        })
      ]
    })

    await renderMessaging()
    await openChannel('WhatsApp')

    // Set up already (on): the page is the channel's settings, and the DM
    // policy is one of its raw settings, under Advanced.
    expect(await screen.findByText(en.messaging.whoCanTalkTitle)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.messaging.advancedTitle) }))
    })
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Allowlist' }))
    })

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Save changes/ }))
    })

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('whatsapp', { env: { WHATSAPP_DM_POLICY: 'allowlist' } })
    )
  })

  it('refetches pending rows on pairing.changed, not on platforms.changed', async () => {
    // The two signals are not interchangeable: platforms.changed tracks
    // connect/disconnect health via gateway_state.json, which a new pairing
    // request never moves. Riding it would leave someone invisible in the
    // pending list until an unrelated reconnect happened to fire.
    const { $changeEventsAvailable, $pairingChangeTick, $platformsChangeTick } = await import('@/store/live-sync')

    getMessagingPlatforms.mockResolvedValue({ platforms: [platform()] })
    getPairing.mockResolvedValue({ approved: [], pending: [] })

    await renderMessaging()
    await openChannel('Mattermost')
    await act(async () => {
      $changeEventsAvailable.set(true)
    })
    getPairing.mockClear()

    // Someone DMs the bot: the store moves, the watcher ticks pairing.changed.
    getPairing.mockResolvedValue({ approved: [], pending: [pendingUser] })
    await act(async () => {
      $pairingChangeTick.set($pairingChangeTick.get() + 1)
    })

    await waitFor(() => expect(getPairing).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeTruthy()

    // A platform health tick alone must not be what fetches pairing.
    getPairing.mockClear()
    await act(async () => {
      $platformsChangeTick.set($platformsChangeTick.get() + 1)
    })
    expect(getPairing).not.toHaveBeenCalled()
  })
})

describe('MessagingView channel page', () => {
  it('opens under the Channels crumb with the name as the title and one status', async () => {
    // Off, with a stale "connected" left in the runtime state: the one pill
    // says the channel is not connected, never two that contradict.
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ configured: true, enabled: false, gateway_running: false, state: 'connected' })]
    })

    await renderMessaging()
    await openChannel('Mattermost')

    expect(await screen.findByRole('heading', { level: 1, name: /Mattermost/ })).toBeTruthy()
    expect(screen.getByText(en.messaging.notConnected)).toBeTruthy()
    expect(screen.queryByText(en.messaging.states.connected)).toBeNull()
    expect(screen.queryByText(en.messaging.gatewayStopped)).toBeNull()
    // The switch says what it is.
    expect(screen.getByText(en.messaging.channelActive)).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.sidebar.nav.messaging) }))
    })

    expect(screen.getByRole('heading', { level: 1, name: en.sidebar.nav.messaging })).toBeTruthy()
  })

  it('shows the gateway stop over a stale connected state while the channel is on', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ configured: true, enabled: true, gateway_running: false, state: 'connected' })]
    })

    await renderMessaging()
    await openChannel('Mattermost')

    await screen.findByRole('heading', { level: 1, name: /Mattermost/ })
    expect(screen.getByText(en.messaging.gatewayStopped)).toBeTruthy()
    expect(screen.queryByText(en.messaging.states.connected)).toBeNull()
  })

  it('walks WhatsApp through its first connection step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ enabled: false, id: 'whatsapp', name: 'WhatsApp', whatsapp_setup: { mode: '' } })]
    })

    await renderMessaging()
    await openChannel('WhatsApp')

    expect(await screen.findByText(en.messaging.whatsappSteps.whoTitle)).toBeTruthy()
    expect(screen.queryByText(en.messaging.whoCanTalkTitle)).toBeNull()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows WhatsApp as settings once it is set up, with the steps a click away', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [whatsappReady()] })

    await renderMessaging()
    await openChannel('WhatsApp')

    expect(await screen.findByText(en.messaging.connectedListening)).toBeTruthy()
    // Who gets a reply, with the numbers, in one line.
    expect(screen.getByText(en.messaging.whoTeam(2))).toBeTruthy()
    expect(screen.getByText('15551234567, 15557654321')).toBeTruthy()
    expect(screen.queryByText(en.messaging.whatsappSteps.whoTitle)).toBeNull()

    // The bridge mode is advanced; the Cloud API's own fields are not this
    // channel's and stay off its page.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.messaging.advancedTitle) }))
    })
    expect(screen.getByText('Bot')).toBeTruthy()
    expect(screen.queryByText('Access token')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.messaging.runStepsAgain }))
    })
    expect(screen.getByText(en.messaging.whatsappSteps.whoTitle)).toBeTruthy()
  })

  it('tests and reconnects WhatsApp from its Connection block', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [whatsappReady()] })
    testMessagingPlatform.mockResolvedValue({ message: 'WhatsApp is connected.', ok: true })

    await renderMessaging()
    await openChannel('WhatsApp')

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: en.messaging.testConnection }))
    })
    await waitFor(() => expect(testMessagingPlatform).toHaveBeenCalledWith('whatsapp'))

    fireEvent.click(screen.getByRole('button', { name: en.messaging.reconnect }))
    expect(runGatewayRestart).toHaveBeenCalled()
  })

  it('offers the gateway restart, not a test, while the gateway is stopped', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [whatsappReady({ gateway_running: false, state: 'gateway_stopped' })]
    })

    await renderMessaging()
    await openChannel('WhatsApp')

    expect((await screen.findAllByText(en.messaging.gatewayStopped)).length).toBeGreaterThan(0)
    expect(screen.getByText(en.messaging.hintGatewayStopped)).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.messaging.testConnection })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.messaging.restartGateway }))
    expect(runGatewayRestart).toHaveBeenCalled()
  })

  it('edits who can talk through the channel update the raw settings use', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [whatsappReady()] })

    await renderMessaging()
    await openChannel('WhatsApp')

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: en.messaging.edit }))
    })
    fireEvent.change(screen.getByLabelText(en.messaging.whatsappSteps.listTitle), {
      target: { value: '15551234567, 15550001111' }
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('whatsapp', {
        env: { WHATSAPP_ALLOWED_USERS: '15551234567,15550001111' }
      })
    )

    // Approving people as they message clears the list.
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: en.messaging.edit }))
    })
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(en.messaging.whatsappSteps.approveTitle) }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('whatsapp', { clear_env: ['WHATSAPP_ALLOWED_USERS'] })
    )
  })

  it('walks Telegram through its first connection step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ id: 'telegram', name: 'Telegram' })] })

    await renderMessaging()
    await openChannel('Telegram')

    expect(await screen.findByText(en.messaging.telegramPage.whoTitle)).toBeTruthy()
    expect(screen.queryByText(en.messaging.whoCanTalkTitle)).toBeNull()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows Telegram as settings once it is set up, with the steps a click away', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [telegramReady()] })

    await renderMessaging()
    await openChannel('Telegram')

    expect(await screen.findByText(en.messaging.connectedListening)).toBeTruthy()
    expect(screen.getByText(en.messaging.channelSettings.whoOnlyPeople(2))).toBeTruthy()
    expect(screen.getByText('123456789, 987654321')).toBeTruthy()
    expect(screen.getByText(en.messaging.botReplies)).toBeTruthy()
    expect(screen.getByText(en.messaging.channelActive)).toBeTruthy()
    expect(screen.queryByText(en.messaging.telegramPage.whoTitle)).toBeNull()

    // The token is advanced; the allowlist lives in Who can talk, not twice.
    expect(screen.getByText(en.messaging.telegramPage.advancedHint)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.messaging.advancedTitle) }))
    })
    expect(screen.getByLabelText(/^Bot token/)).toBeTruthy()
    expect(screen.queryByLabelText(/Allowed users/i)).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.messaging.runStepsAgain }))
    })
    expect(screen.getByText(en.messaging.telegramPage.whoTitle)).toBeTruthy()
  })

  it('says who gets a code while Telegram has no allowlist', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [telegramReady({ env_vars: [envField('TELEGRAM_ALLOWED_USERS', '')] })]
    })

    await renderMessaging()
    await openChannel('Telegram')

    expect(await screen.findByText(en.messaging.channelSettings.whoApprove)).toBeTruthy()
  })

  it('edits who can talk on Telegram through the channel update', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [telegramReady()] })

    await renderMessaging()
    await openChannel('Telegram')

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: en.messaging.edit }))
    })
    const list = screen.getByLabelText(en.messaging.channelSettings.listTitle)

    // A @username where a numeric id belongs never reaches the backend.
    fireEvent.change(list, { target: { value: '123456789, @carla' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    expect(screen.getByText(en.messaging.envErrors.telegramUserId('@carla'))).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()

    fireEvent.change(list, { target: { value: '123456789, 555' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('telegram', {
        env: { TELEGRAM_ALLOWED_USERS: '123456789,555' }
      })
    )

    // Approving people as they message clears the list.
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: en.messaging.edit }))
    })
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(en.messaging.channelSettings.approveTitle) }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('telegram', { clear_env: ['TELEGRAM_ALLOWED_USERS'] })
    )
  })

  it('walks Discord through its first connection step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ id: 'discord', name: 'Discord' })] })

    await renderMessaging()
    await openChannel('Discord')

    expect(await screen.findByText(en.messaging.discordPage.whoTitle)).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows Discord as settings once it is set up, with who can talk as Discord means it', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [discordReady()] })

    await renderMessaging()
    await openChannel('Discord')

    expect(await screen.findByText(en.messaging.connectedListening)).toBeTruthy()
    expect(screen.getByText(en.messaging.channelSettings.whoOnlyPeople(2))).toBeTruthy()
    expect(screen.getByText('284102345678901234, 284109876543210987')).toBeTruthy()

    // The saved token comes back redacted: the invite link is built again
    // only from a token typed into the field.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.messaging.advancedTitle) }))
    })
    expect(screen.getByText(en.messaging.discordPage.inviteHint)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/^Bot token/), {
      target: { value: `${btoa('1287441000712345678').replace(/=+$/, '')}.GhIjKl.${'a'.repeat(27)}` }
    })
    expect(screen.getByText(/client_id=1287441000712345678/)).toBeTruthy()
  })

  it('says nobody gets a reply while Discord has no list, and everyone with the wildcard', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [discordReady({ env_vars: [envField('DISCORD_ALLOWED_USERS', '')] })]
    })

    const { unmount } = await renderMessaging()
    await openChannel('Discord')
    expect(await screen.findByText(en.messaging.discordPage.whoNone)).toBeTruthy()

    // An empty list lets nobody in, so Edit opens on the list, not on "everyone".
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.messaging.edit }))
    })
    expect(
      (
        screen.getByRole('radio', { name: new RegExp(en.messaging.channelSettings.listTitle) }) as HTMLElement
      ).getAttribute('aria-checked')
    ).toBe('true')
    unmount()

    getMessagingPlatforms.mockResolvedValue({
      platforms: [discordReady({ env_vars: [envField('DISCORD_ALLOWED_USERS', '*')] })]
    })
    await renderMessaging()
    await openChannel('Discord')
    expect(await screen.findByText(en.messaging.discordPage.everyoneTitle)).toBeTruthy()
  })

  it('edits who can talk on Discord, everyone included', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [discordReady()] })

    await renderMessaging()
    await openChannel('Discord')

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: en.messaging.edit }))
    })
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(en.messaging.discordPage.everyoneTitle) }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('discord', { env: { DISCORD_ALLOWED_USERS: '*' } })
    )
  })

  it('walks Slack through its first connection step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ id: 'slack', name: 'Slack' })] })

    await renderMessaging()
    await openChannel('Slack')

    expect(await screen.findByText(en.messaging.slackPage.whoTitle)).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows Slack as settings once it is set up, with nobody let in until there is a list', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [slackReady()] })

    const { unmount } = await renderMessaging()
    await openChannel('Slack')

    expect(await screen.findByText(en.messaging.connectedListening)).toBeTruthy()
    expect(screen.getByText(en.messaging.channelSettings.whoOnlyPeople(2))).toBeTruthy()
    expect(screen.getByText('U01ABC2DEF3, U04XYZ9GHI7')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.messaging.advancedTitle) }))
    })
    expect(screen.getByRole('button', { name: en.messaging.slackPage.copyManifest })).toBeTruthy()
    unmount()

    getMessagingPlatforms.mockResolvedValue({
      platforms: [slackReady({ env_vars: [envField('SLACK_ALLOWED_USERS', '')] })]
    })
    await renderMessaging()
    await openChannel('Slack')
    expect(await screen.findByText(en.messaging.slackPage.whoNone)).toBeTruthy()
  })

  it('edits who can talk on Slack, member ids checked', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [slackReady()] })

    await renderMessaging()
    await openChannel('Slack')

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: en.messaging.edit }))
    })
    const list = screen.getByLabelText(en.messaging.channelSettings.listTitle)
    fireEvent.change(list, { target: { value: 'U01ABC2DEF3, ana' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    expect(screen.getByText(en.messaging.envErrors.slackMemberId('ana'))).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()

    fireEvent.change(list, { target: { value: 'U01ABC2DEF3' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('slack', { env: { SLACK_ALLOWED_USERS: 'U01ABC2DEF3' } })
    )
  })

  it('walks Teams through its first connection step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ id: 'teams', name: 'Microsoft Teams' })] })

    await renderMessaging()
    await openChannel('Microsoft Teams')

    expect(await screen.findByText(en.messaging.teamsPage.whoTitle)).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows Teams as settings with the endpoint Azure calls', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [teamsReady()] })

    await renderMessaging()
    await openChannel('Microsoft Teams')

    expect(await screen.findByText(en.messaging.connectedListening)).toBeTruthy()
    expect(screen.getByText(en.messaging.teamsPage.endpointLine('https://bot.example.com/api/messages'))).toBeTruthy()
    expect(screen.getByRole('button', { name: en.messaging.teamsPage.copyEndpoint })).toBeTruthy()
    expect(screen.getByText(en.messaging.channelSettings.whoOnlyPeople(1))).toBeTruthy()
    expect(screen.getByText(en.messaging.teamsPage.graphNote)).toBeTruthy()
  })

  it('edits who can talk on Teams, where an empty list approves people by code', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [teamsReady()] })

    await renderMessaging()
    await openChannel('Microsoft Teams')

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: en.messaging.edit }))
    })
    fireEvent.change(screen.getByLabelText(en.messaging.channelSettings.listTitle), { target: { value: '' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('teams', { clear_env: ['TEAMS_ALLOWED_USERS'] })
    )
  })

  it('walks the WhatsApp Cloud API through its first connection step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ id: 'whatsapp_cloud', name: 'WhatsApp Cloud API' })]
    })

    await renderMessaging()
    await openChannel('WhatsApp Cloud API')

    expect(await screen.findByText(en.messaging.whatsappCloudPage.whoTitle)).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows the WhatsApp Cloud API as settings with the callback and the numbers', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [whatsappCloudReady()] })
    getCronJobs.mockResolvedValue([{ deliver: 'whatsapp_cloud', enabled: true, id: 'a' }])

    const { unmount } = await renderMessaging()
    await openChannel('WhatsApp Cloud API')

    expect(await screen.findByText(en.messaging.connectedListening)).toBeTruthy()
    expect(
      screen.getByText(en.messaging.whatsappCloudPage.callbackLine('https://bot.example.com/whatsapp/webhook'))
    ).toBeTruthy()
    expect(screen.getByText(en.messaging.whatsappCloudPage.whoOnlyNumbers(2))).toBeTruthy()
    // Routines cannot deliver to this channel yet, so none is counted.
    expect(screen.queryByText(en.messaging.botRoutines(1))).toBeNull()
    unmount()

    getMessagingPlatforms.mockResolvedValue({
      platforms: [whatsappCloudReady({ env_vars: [envField('WHATSAPP_CLOUD_ALLOWED_USERS', '')] })]
    })
    await renderMessaging()
    await openChannel('WhatsApp Cloud API')
    expect(await screen.findByText(en.messaging.whatsappCloudPage.whoNone)).toBeTruthy()
  })

  it('walks Email through its first connection step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ id: 'email', name: 'Email' })] })

    await renderMessaging()
    await openChannel('Email')

    expect(await screen.findByText(en.messaging.emailPage.whoTitle)).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows Email as settings: the mailbox it checks and who can write', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [emailReady()] })

    await renderMessaging()
    await openChannel('Email')

    expect(await screen.findByText(en.messaging.emailPage.connectedLabel)).toBeTruthy()
    expect(screen.getByText(/bot@example\.com/)).toBeTruthy()
    expect(screen.getByText(en.messaging.emailPage.whoCanWriteTitle)).toBeTruthy()
    expect(screen.getByText(en.messaging.emailPage.whoOnlyAddresses(2))).toBeTruthy()
    expect(screen.getByText(en.messaging.emailPage.repliesToEmail)).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.messaging.edit }))
    })
    fireEvent.change(screen.getByLabelText(en.messaging.emailPage.listTitle), { target: { value: '*' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    expect(screen.getByText(en.messaging.envErrors.emailAddress('*'))).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('walks SMS through its first connection step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ id: 'sms', name: 'SMS (Twilio)' })] })

    await renderMessaging()
    await openChannel('SMS')

    expect(await screen.findByText(en.messaging.smsPage.whoTitle)).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows SMS as settings: the number, who can text and approval by code', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [smsReady()] })

    const { unmount } = await renderMessaging()
    await openChannel('SMS')

    expect(await screen.findByText(/\+15551234567/)).toBeTruthy()
    expect(screen.getByText(en.messaging.smsPage.whoCanTextTitle)).toBeTruthy()
    expect(screen.getByText(en.messaging.smsPage.whoOnlyNumbers(2))).toBeTruthy()

    // Approving people as they text clears the list.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.messaging.edit }))
    })
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(en.messaging.smsPage.approveTitle) }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('sms', { clear_env: ['SMS_ALLOWED_USERS'] })
    )
    unmount()

    getMessagingPlatforms.mockResolvedValue({
      platforms: [smsReady({ env_vars: [envField('SMS_ALLOWED_USERS', '')] })]
    })
    await renderMessaging()
    await openChannel('SMS')
    expect(await screen.findByText(en.messaging.smsPage.approveTitle)).toBeTruthy()
  })

  it('walks Google Chat through its first connection step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ id: 'google_chat', name: 'Google Chat' })] })

    await renderMessaging()
    await openChannel('Google Chat')

    expect(await screen.findByText(en.messaging.googleChatPage.whoTitle)).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows Google Chat as settings: how events arrive and who can talk', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [googleChatReady()] })

    const { unmount } = await renderMessaging()
    await openChannel('Google Chat')

    expect(await screen.findByText(en.messaging.googleChatPage.modePubsub)).toBeTruthy()
    expect(screen.getByText(en.messaging.channelSettings.whoOnlyPeople(2))).toBeTruthy()
    expect(screen.getByText('ana@acme.com, bruno@acme.com')).toBeTruthy()

    // Approving people as they message clears the list.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.messaging.edit }))
    })
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(en.messaging.channelSettings.approveTitle) }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('google_chat', { clear_env: ['GOOGLE_CHAT_ALLOWED_USERS'] })
    )
    unmount()

    getMessagingPlatforms.mockResolvedValue({
      platforms: [
        googleChatReady({
          env_vars: [
            envField('GOOGLE_CHAT_HTTP_EVENTS_URL', 'https://bot.example.com/api/platforms/google_chat/events'),
            envField('GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL', 'chat@system.gserviceaccount.com'),
            envField('GOOGLE_CHAT_ALLOWED_USERS', '')
          ]
        })
      ]
    })
    await renderMessaging()
    await openChannel('Google Chat')
    expect(await screen.findByText(en.messaging.googleChatPage.modeHttp)).toBeTruthy()
    expect(screen.getByText(en.messaging.channelSettings.whoApprove)).toBeTruthy()
  })

  it('walks the API server through its first setup step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ id: 'api_server', name: 'API server' })] })

    await renderMessaging()
    await openChannel('API server')

    expect(await screen.findByText(en.messaging.apiServerPage.keyTitle)).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows the API server as an endpoint: listening, its key and the browser apps it allows', async () => {
    const s = en.messaging.apiServerPage
    getMessagingPlatforms.mockResolvedValue({ platforms: [apiServerReady()] })

    await renderMessaging()
    await openChannel('API server')

    // Listening, in the header and on the endpoint line, never "Connected".
    expect((await screen.findAllByText(en.messaging.stateListening)).length).toBe(2)
    expect(screen.getByText('http://127.0.0.1:9000/v1')).toBeTruthy()
    expect(screen.getByText('AbCd...4f2a')).toBeTruthy()
    expect(screen.getByText(s.browserAppsNone)).toBeTruthy()
    expect(screen.getByText('work4you')).toBeTruthy()
    expect(screen.queryByText(en.messaging.whoCanTalkTitle)).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.messaging.edit }))
    })
    fireEvent.change(screen.getByLabelText(s.originsLabel), { target: { value: 'chat.example.com' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    expect(screen.getByText(en.messaging.envErrors.apiServerCorsOrigin('chat.example.com'))).toBeTruthy()

    fireEvent.change(screen.getByLabelText(s.originsLabel), { target: { value: 'https://chat.example.com' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('api_server', {
        env: { API_SERVER_CORS_ORIGINS: 'https://chat.example.com' }
      })
    )
  })

  it('replaces the API server key with a strong one only', async () => {
    const s = en.messaging.apiServerPage
    getMessagingPlatforms.mockResolvedValue({ platforms: [apiServerReady()] })

    await renderMessaging()
    await openChannel('API server')

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: s.replaceKey }))
    })
    fireEvent.change(screen.getByLabelText(s.keyLabel), { target: { value: 'short' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    expect(screen.getByText(en.messaging.envErrors.apiServerKey)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: s.generateKey }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.common.save }))
    })
    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('api_server', {
        env: { API_SERVER_KEY: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/) }
      })
    )
  })

  it('walks Webhooks through its first setup while the listener is off with no route', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ configured: true, id: 'webhook', name: 'Webhooks' })]
    })

    await renderMessaging()
    await openChannel('Webhooks')

    expect(await screen.findByText(en.messaging.webhookPage.listenerTitle)).toBeTruthy()
    expect(screen.getByText('http://localhost:8644/webhooks/<route>')).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows Webhooks as settings: listening, its routes and their switches', async () => {
    const s = en.messaging.webhookPage
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ configured: true, enabled: true, id: 'webhook', name: 'Webhooks', state: 'connected' })]
    })
    getWebhooks.mockResolvedValue({
      base_url: 'http://localhost:8644',
      enabled: true,
      subscriptions: [
        webhookRoute('github-issues', ['issues', 'issue_comment'], 'telegram'),
        webhookRoute('gitlab-deploys', ['pipeline'], 'log', false)
      ]
    })

    await renderMessaging()
    await openChannel('Webhooks')

    expect(await screen.findByText(s.listeningRoutes(2))).toBeTruthy()
    expect(screen.getByText(en.messaging.stateListening)).toBeTruthy()
    expect(screen.getByText(s.routeLine('issues, issue_comment', 'Telegram'))).toBeTruthy()
    expect(screen.getByText(s.routeLine('pipeline', s.localLogOnly))).toBeTruthy()
    // No restart is pending, so the listener line offers none.
    expect(screen.queryByRole('button', { name: en.messaging.restartGateway })).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: s.toggleRoute('gitlab-deploys') }))
    })
    expect(setWebhookEnabled).toHaveBeenCalledWith('gitlab-deploys', true, 'default')
  })

  it('opens an off listener that has routes on its settings, not the first setup', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ configured: true, id: 'webhook', name: 'Webhooks' })]
    })
    getWebhooks.mockResolvedValue({
      base_url: 'http://localhost:8644',
      enabled: false,
      subscriptions: [webhookRoute('github-issues', [], 'log')]
    })

    await renderMessaging()
    await openChannel('Webhooks')

    expect(await screen.findByText(en.messaging.webhookPage.routesTitle)).toBeTruthy()
    expect(
      screen.getByText(
        en.messaging.webhookPage.routeLine(en.messaging.webhookPage.everyEvent, en.messaging.webhookPage.localLogOnly)
      )
    ).toBeTruthy()
    expect(screen.queryByText(en.messaging.webhookPage.listenerTitle)).toBeNull()
  })

  it('walks A2A through its first setup while the listener is off with no peer', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ configured: true, id: 'a2a', name: 'A2A' })] })

    await renderMessaging()
    await openChannel('A2A')

    expect(await screen.findByText(en.messaging.a2aPage.whatTitle)).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows A2A as settings: who can reach it, its peers, outbound tools and tokens', async () => {
    const s = en.messaging.a2aPage
    getMessagingPlatforms.mockResolvedValue({
      platforms: [
        platform({
          configured: true,
          enabled: true,
          env_vars: [
            envField('A2A_HOST', '0.0.0.0'),
            envField('A2A_BEARER_TOKEN', 'secret', { is_password: true, value: null }),
            envField('A2A_PEER_TOKENS', '', { is_password: true, value: null }),
            envField('A2A_PUBLIC_URL', 'https://agents.example.com')
          ],
          id: 'a2a',
          name: 'A2A',
          state: 'connected'
        })
      ]
    })
    getA2AAgents.mockResolvedValue({
      agents: [
        {
          capabilities: [],
          has_auth: true,
          name: 'research-bot',
          timeout: 120,
          url: 'https://agents.example.com/research'
        }
      ]
    })
    getToolsets.mockResolvedValue([{ enabled: true, name: 'a2a' }])

    await renderMessaging()
    await openChannel('A2A')

    expect(await screen.findByText(`${s.reachNetworkFact} · ${s.tokenRequiredFact}`)).toBeTruthy()
    expect(screen.getByText(s.peerLine('https://agents.example.com/research', true))).toBeTruthy()
    expect(await screen.findByText(s.outboundOn)).toBeTruthy()
    expect(screen.getByText(s.sharedToken).nextSibling?.textContent).toBe(s.tokenSet)
    expect(screen.getByText(s.peerTokens).nextSibling?.textContent).toBe(s.tokenNone)
  })

  it('walks the Microsoft Graph webhook through its first setup step by step', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [platform({ id: 'msgraph_webhook', name: 'Microsoft Graph Webhook' })]
    })

    await renderMessaging()
    await openChannel('Microsoft Graph Webhook')

    expect(await screen.findByText(en.messaging.msgraphPage.secretTitle)).toBeTruthy()
    expect(screen.queryByText('Manual setup')).toBeNull()
  })

  it('shows the Microsoft Graph webhook as settings: its URL, security and accepted notifications', async () => {
    const s = en.messaging.msgraphPage
    getMessagingPlatforms.mockResolvedValue({
      platforms: [
        platform({
          configured: true,
          enabled: true,
          env_vars: [
            envField('MSGRAPH_WEBHOOK_CLIENT_STATE', 'secret', { is_password: true, required: true, value: null }),
            envField('MSGRAPH_WEBHOOK_HOST', '0.0.0.0'),
            envField('MSGRAPH_WEBHOOK_PORT', ''),
            envField('MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES', 'communications/onlineMeetings,chats/*/messages'),
            envField('MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS', '52.96.0.0/14,13.107.64.0/18'),
            envField('MSGRAPH_WEBHOOK_PUBLIC_URL', 'https://bot.example.com')
          ],
          id: 'msgraph_webhook',
          name: 'Microsoft Graph Webhook',
          state: 'connected'
        })
      ]
    })

    await renderMessaging()
    await openChannel('Microsoft Graph Webhook')

    expect(await screen.findByText('https://bot.example.com/msgraph/webhook')).toBeTruthy()
    expect(screen.getAllByText(en.messaging.stateListening)).toHaveLength(2)
    expect(screen.getByText('52.96.0.0/14, 13.107.64.0/18')).toBeTruthy()
    expect(screen.getByText('communications/onlineMeetings · chats/*/messages')).toBeTruthy()

    // Edit opens the secret and the allowlist; a CIDR without a mask is refused.
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: en.messaging.edit })[0])
    })
    fireEvent.change(screen.getByLabelText(s.cidrsLabel), { target: { value: '52.96.0.0' } })
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: en.common.save })[1])
    })
    expect(screen.getByText(en.messaging.envErrors.msgraphCidr('52.96.0.0'))).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('counts the routines that deliver to WhatsApp', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [whatsappReady({ whatsapp_setup: { allowed_users_set: true, home_channel_set: true, mode: 'bot' } })]
    })
    getCronJobs.mockResolvedValue([
      { deliver: 'whatsapp', enabled: true, id: 'a' },
      { deliver: 'telegram,whatsapp:15551234567', enabled: true, id: 'b' },
      { deliver: 'all', enabled: true, id: 'c' },
      { deliver: 'whatsapp_cloud', enabled: true, id: 'd' },
      { deliver: 'whatsapp', enabled: false, id: 'e' },
      { deliver: 'local', enabled: true, id: 'f' }
    ])

    await renderMessaging()
    await openChannel('WhatsApp')

    // Explicit targets plus `all` (this channel has a home chat); never the
    // Cloud API channel, a paused routine or a local one.
    expect(await screen.findByText(en.messaging.botRoutines(3))).toBeTruthy()
    expect(screen.getByText(en.messaging.botAlerts)).toBeTruthy()
  })
})

describe('MessagingView profile scope', () => {
  it('lists platforms and pairing for the active profile, never the primary one', async () => {
    // The chip stores no override while it follows the app's active profile.
    // Forwarding that raw `null` would omit `?profile=` and list the primary
    // backend's platforms under a chip that names the active profile.
    $activeGatewayProfile.set('coder')
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform()] })

    await renderMessaging()

    expect((await screen.findAllByText('Mattermost')).length).toBeGreaterThan(0)
    expect(getMessagingPlatforms).toHaveBeenCalledWith('coder')
    expect(getPairing).toHaveBeenCalledWith('coder')
    expect(getMessagingPlatforms).not.toHaveBeenCalledWith(null)
  })

  it('follows an explicit chip pick onto another profile', async () => {
    setSettingsScope('research')
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform()] })

    await renderMessaging()

    expect((await screen.findAllByText('Mattermost')).length).toBeGreaterThan(0)
    expect(getMessagingPlatforms).toHaveBeenCalledWith('research')
    expect(getPairing).toHaveBeenCalledWith('research')
  })
})
