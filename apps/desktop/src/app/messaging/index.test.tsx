// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MessagingPlatformInfo } from '@/types/work4you'

const getMessagingPlatforms = vi.fn()
const updateMessagingPlatform = vi.fn()
const testMessagingPlatform = vi.fn()
const getPairing = vi.fn()
const approvePairing = vi.fn()
const revokePairing = vi.fn()
const openExternalLink = vi.fn()

vi.mock('@/work4you', () => ({
  approvePairing: (platformId: string, requestId: string) => approvePairing(platformId, requestId),
  applyTelegramOnboarding: vi.fn(),
  applyWhatsAppOnboarding: vi.fn(),
  cancelTelegramOnboarding: vi.fn(),
  cancelWhatsAppOnboarding: vi.fn(),
  getActionStatus: vi.fn(),
  getMessagingPlatforms: () => getMessagingPlatforms(),
  getPairing: () => getPairing(),
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  getTelegramOnboardingStatus: vi.fn(),
  getWhatsAppOnboardingStatus: vi.fn(),
  revokePairing: (platformId: string, userId: string) => revokePairing(platformId, userId),
  setApiRequestProfile: vi.fn(),
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

  return { $gatewayRestarting: atom(false), runGatewayRestart: vi.fn() }
})

function platform(patch: Partial<MessagingPlatformInfo> = {}): MessagingPlatformInfo {
  return {
    configured: false,
    description: 'A platform.',
    docs_url: '',
    enabled: false,
    env_vars: [],
    gateway_running: true,
    id: 'teams',
    name: 'Microsoft Teams',
    state: 'disabled',
    ...patch
  }
}

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'teams' })
  getPairing.mockResolvedValue({ approved: [], pending: [] })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderMessaging() {
  const { MessagingView } = await import('./index')
  let result: ReturnType<typeof render>
  await act(async () => {
    result = render(
      <MemoryRouter>
        <MessagingView />
      </MemoryRouter>
    )
  })

  return result!
}

describe('MessagingView setup-guide link', () => {
  it('hides the setup-guide button for a plugin platform with no docs URL', async () => {
    // Teams (and other plugin platforms) ship an empty docs_url. Rendering an
    // anchor with href="" let Electron resolve it to the app's own packaged
    // index.html and fail with an OS "file not found" dialog. The button must
    // simply not appear when there is no guide to open.
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ docs_url: '' })] })

    await renderMessaging()

    expect((await screen.findAllByText('Microsoft Teams')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Open setup guide')).toBeNull()
  })

  it('opens a real docs URL through the validated external opener', async () => {
    const docsUrl = 'https://work4you.ai/docs/user-guide/messaging/teams'
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ docs_url: docsUrl })] })

    await renderMessaging()

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
    platform: 'teams',
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

    const approve = await screen.findByRole('button', { name: 'Approve' })
    await act(async () => {
      fireEvent.click(approve)
    })

    await waitFor(() => expect(approvePairing).toHaveBeenCalledWith('teams', 'a1b2c3d4e5f60718'))
  })

  it('restores the pending row when approval fails', async () => {
    // Optimistic removal must not silently swallow the request: a failed
    // approve has to leave the operator something to retry.
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform()] })
    getPairing.mockResolvedValue({ approved: [], pending: [pendingUser] })
    approvePairing.mockRejectedValue(new Error('500 boom'))

    await renderMessaging()

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

    expect((await screen.findAllByText('Microsoft Teams')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByText(/Pending requests/)).toBeNull()
  })

  it('still renders platforms when the pairing endpoint fails', async () => {
    // An older backend without the endpoint must not blank the page.
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform()] })
    getPairing.mockRejectedValue(new Error('404 not found'))

    await renderMessaging()

    expect((await screen.findAllByText('Microsoft Teams')).length).toBeGreaterThan(0)
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
              key: 'TEAMS_APP_PASSWORD',
              prompt: 'Teams app password',
              redacted_value: null,
              required: true,
              url: null
            }
          ]
        })
      ]
    })

    await renderMessaging()

    const input = await screen.findByLabelText('Teams app password')
    fireEvent.change(input, { target: { value: 'abc-123' } })

    const save = await screen.findByRole('button', { name: /Save & enable/ })
    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('teams', {
        enabled: true,
        env: { TEAMS_APP_PASSWORD: 'abc-123' }
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
              key: 'TEAMS_APP_PASSWORD',
              prompt: 'Teams app password',
              redacted_value: 'abc…123',
              required: true,
              url: null
            }
          ]
        })
      ]
    })

    await renderMessaging()

    fireEvent.change(await screen.findByLabelText('Teams app password'), { target: { value: 'new-token' } })

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Save changes/ }))
    })

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith('teams', { env: { TEAMS_APP_PASSWORD: 'new-token' } })
    )
  })

  it('blocks the save and shows the field error for a malformed Telegram token', async () => {
    getMessagingPlatforms.mockResolvedValue({
      platforms: [
        platform({
          id: 'telegram',
          name: 'Telegram',
          env_vars: [
            {
              advanced: false,
              description: 'Bot token.',
              is_password: true,
              is_set: false,
              key: 'TELEGRAM_BOT_TOKEN',
              prompt: 'Telegram bot token',
              redacted_value: null,
              required: true,
              url: null
            }
          ]
        })
      ]
    })

    await renderMessaging()

    // Only the numeric bot-id half of the token — the classic paste mistake.
    fireEvent.change(await screen.findByLabelText('Bot token'), { target: { value: '123456789' } })

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Save & enable/ }))
    })

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(await screen.findByText(/complete token from @BotFather/)).toBeTruthy()

    // Editing the rejected value clears the stale error immediately.
    fireEvent.change(screen.getByLabelText('Bot token'), { target: { value: '123456789:' } })
    expect(screen.queryByText(/complete token from @BotFather/)).toBeNull()
  })

  it('runs the connection test from the action bar and reports the result', async () => {
    const { notify } = await import('@/store/notifications')

    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ configured: true, enabled: true })] })
    testMessagingPlatform.mockResolvedValue({ message: 'Connected as @bot', ok: true })

    await renderMessaging()

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Test' }))
    })

    await waitFor(() => expect(testMessagingPlatform).toHaveBeenCalledWith('teams'))
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success', message: 'Connected as @bot' }))
    )
  })

  it('hides the connection test until the channel has credentials to probe', async () => {
    getMessagingPlatforms.mockResolvedValue({ platforms: [platform({ configured: false })] })

    await renderMessaging()

    expect((await screen.findAllByText('Microsoft Teams')).length).toBeGreaterThan(0)
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
