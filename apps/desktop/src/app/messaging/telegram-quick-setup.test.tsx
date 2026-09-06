// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const startTelegramOnboarding = vi.fn()
const getTelegramOnboardingStatus = vi.fn()
const applyTelegramOnboarding = vi.fn()
const cancelTelegramOnboarding = vi.fn()
const getActionStatus = vi.fn()
const openExternalLink = vi.fn()
const notify = vi.fn()

vi.mock('@/work4you', () => ({
  applyTelegramOnboarding: (pairingId: string, ids: string[], profile?: null | string) =>
    applyTelegramOnboarding(pairingId, ids, profile),
  cancelTelegramOnboarding: (pairingId: string) => cancelTelegramOnboarding(pairingId),
  getActionStatus: () => getActionStatus(),
  getTelegramOnboardingStatus: (pairingId: string) => getTelegramOnboardingStatus(pairingId),
  startTelegramOnboarding: (botName?: string) => startTelegramOnboarding(botName)
}))

vi.mock('@/lib/external-link', () => ({
  openExternalLink: (href: string) => openExternalLink(href)
}))

vi.mock('@/store/notifications', () => ({
  notify: (input: unknown) => notify(input),
  notifyError: vi.fn()
}))

vi.mock('@/store/system-actions', async () => {
  const { atom } = await vi.importActual<typeof NanostoresModule>('nanostores')

  return { $gatewayRestarting: atom(false), runGatewayRestart: vi.fn() }
})

// The QR encoder is a real dependency, but the component only cares that it
// returns a renderable data URL.
vi.mock('qrcode', () => ({
  toDataURL: vi.fn(async () => 'data:image/png;base64,fake-qr')
}))

const START_RESPONSE = {
  deep_link: 'https://t.me/BotFather?start=abc',
  expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  pairing_id: 'pair-1',
  qr_payload: 'tg://resolve?domain=BotFather&start=abc',
  suggested_username: 'work4you_bot'
}

beforeEach(() => {
  startTelegramOnboarding.mockResolvedValue(START_RESPONSE)
  getTelegramOnboardingStatus.mockResolvedValue({ expires_at: START_RESPONSE.expires_at, status: 'waiting' })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderQuickSetup(onApplied = vi.fn(), scopeProfile: null | string = null) {
  const { TelegramQuickSetup } = await import('./telegram-quick-setup')

  await act(async () => {
    render(<TelegramQuickSetup configured={false} onApplied={onApplied} scopeProfile={scopeProfile} />)
  })

  return onApplied
}

async function startQuickSetup() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Create with QR/ }))
  })
}

describe('TelegramQuickSetup', () => {
  it('starts a pairing session and shows the scannable QR with a Telegram deep link', async () => {
    await renderQuickSetup()
    await startQuickSetup()

    expect(startTelegramOnboarding).toHaveBeenCalledWith('Work4You')
    const qr = await screen.findByAltText('Telegram setup QR code')
    expect(qr.getAttribute('src')).toBe('data:image/png;base64,fake-qr')

    // The deep link must route through the validated external opener — a raw
    // anchor would let Electron try to resolve tg:// itself.
    fireEvent.click(screen.getByRole('button', { name: /Open Telegram/ }))
    expect(openExternalLink).toHaveBeenCalledWith(START_RESPONSE.deep_link)
  })

  it('applies with the detected owner id and reports the gateway restart', async () => {
    getTelegramOnboardingStatus.mockResolvedValue({
      bot_username: 'work4you_bot',
      expires_at: START_RESPONSE.expires_at,
      owner_user_id: '4242',
      status: 'ready'
    })
    applyTelegramOnboarding.mockResolvedValue({
      needs_restart: false,
      ok: true,
      platform: 'telegram',
      restart_started: true
    })

    const onApplied = await renderQuickSetup(vi.fn(), 'work')
    await startQuickSetup()

    // First poll fires ~1.2s after the QR renders; the detected owner arrives
    // pre-filled as the allowlist.
    expect(await screen.findByText('@work4you_bot', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByText('4242')).toBeTruthy()
    expect(screen.getByText('Owner detected')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save and restart/ }))
    })

    await waitFor(() => expect(applyTelegramOnboarding).toHaveBeenCalledWith('pair-1', ['4242'], 'work'))
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('rejects a non-numeric manual allowlist entry without calling the backend', async () => {
    getTelegramOnboardingStatus.mockResolvedValue({
      bot_username: 'work4you_bot',
      expires_at: START_RESPONSE.expires_at,
      status: 'ready'
    })

    await renderQuickSetup()
    await startQuickSetup()

    expect(await screen.findByText('@work4you_bot', {}, { timeout: 4000 })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Telegram user ID'), { target: { value: '@carla' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText(/must be numeric/)).toBeTruthy()

    // With no detected owner and no valid entry, apply is refused client-side.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save and restart/ }))
    })
    expect(applyTelegramOnboarding).not.toHaveBeenCalled()
  })

  it('cancels the session server-side and returns to the idle card', async () => {
    await renderQuickSetup()
    await startQuickSetup()

    await screen.findByAltText('Telegram setup QR code')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(cancelTelegramOnboarding).toHaveBeenCalledWith('pair-1')
    expect(screen.queryByAltText('Telegram setup QR code')).toBeNull()
    expect(screen.getByRole('button', { name: /Create with QR/ })).toBeTruthy()
  })
})
