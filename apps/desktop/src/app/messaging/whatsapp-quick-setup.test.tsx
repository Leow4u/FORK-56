// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const startWhatsAppOnboarding = vi.fn()
const getWhatsAppOnboardingStatus = vi.fn()
const applyWhatsAppOnboarding = vi.fn()
const cancelWhatsAppOnboarding = vi.fn()
const getActionStatus = vi.fn()
const openExternalLink = vi.fn()
const notify = vi.fn()

vi.mock('@/work4you', () => ({
  applyWhatsAppOnboarding: (pairingId: string, body: unknown, profile?: null | string) =>
    applyWhatsAppOnboarding(pairingId, body, profile),
  cancelWhatsAppOnboarding: (pairingId: string) => cancelWhatsAppOnboarding(pairingId),
  getActionStatus: () => getActionStatus(),
  getWhatsAppOnboardingStatus: (pairingId: string) => getWhatsAppOnboardingStatus(pairingId),
  startWhatsAppOnboarding: (mode: string, allowedUsers: string, profile?: null | string) =>
    startWhatsAppOnboarding(mode, allowedUsers, profile)
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

const EXPIRES_AT = new Date(Date.now() + 5 * 60_000).toISOString()

const WAITING_RESPONSE = {
  allowed_users: '',
  expires_at: EXPIRES_AT,
  mode: 'bot' as const,
  pairing_id: 'wa-pair-1',
  qr_payload: '2@fakepayload,fakekey,fakeident',
  status: 'waiting' as const
}

const CONNECTED_RESPONSE = {
  account_id: '15551234567:1@s.whatsapp.net',
  account_name: 'Carla',
  account_phone: '15551234567',
  allowed_users: '',
  expires_at: EXPIRES_AT,
  mode: 'bot' as const,
  pairing_id: 'wa-pair-1',
  qr_payload: null,
  status: 'connected' as const
}

beforeEach(() => {
  startWhatsAppOnboarding.mockResolvedValue(WAITING_RESPONSE)
  getWhatsAppOnboardingStatus.mockResolvedValue(WAITING_RESPONSE)
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderQuickSetup({
  allowedUsersSet = false,
  onApplied = vi.fn(),
  savedMode = null as null | string,
  scopeProfile = null as null | string
} = {}) {
  const { WhatsAppQuickSetup } = await import('./whatsapp-quick-setup')

  await act(async () => {
    render(
      <WhatsAppQuickSetup
        allowedUsersSet={allowedUsersSet}
        configured={false}
        onApplied={onApplied}
        savedMode={savedMode}
        scopeProfile={scopeProfile}
      />
    )
  })

  return onApplied
}

async function startQuickSetup() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Pair with QR/ }))
  })
}

describe('WhatsAppQuickSetup', () => {
  it('starts pairing in the selected mode and shows the Linked Devices QR', async () => {
    await renderQuickSetup({ scopeProfile: 'work' })

    fireEvent.click(screen.getByRole('button', { name: 'Self-chat' }))
    await startQuickSetup()

    expect(startWhatsAppOnboarding).toHaveBeenCalledWith('self-chat', '', 'work')
    const qr = await screen.findByAltText('WhatsApp setup QR code')
    expect(qr.getAttribute('src')).toBe('data:image/png;base64,fake-qr')
    expect(screen.getByText(/Linked devices/)).toBeTruthy()
  })

  it('shows the bridge-preparing state until polling delivers the QR', async () => {
    startWhatsAppOnboarding.mockResolvedValue({ ...WAITING_RESPONSE, qr_payload: null, status: 'installing' })

    await renderQuickSetup()
    await startQuickSetup()

    expect(screen.getByText(/Preparing the WhatsApp bridge/)).toBeTruthy()
    expect(screen.queryByAltText('WhatsApp setup QR code')).toBeNull()

    // Next poll delivers the QR payload — the placeholder swaps for the code.
    expect(await screen.findByAltText('WhatsApp setup QR code', {}, { timeout: 4000 })).toBeTruthy()
  })

  it('skips straight to save when a session is already linked on disk', async () => {
    startWhatsAppOnboarding.mockResolvedValue(CONNECTED_RESPONSE)
    applyWhatsAppOnboarding.mockResolvedValue({
      needs_restart: false,
      ok: true,
      platform: 'whatsapp',
      restart_started: true
    })

    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })
    await startQuickSetup()

    expect(screen.getByText('Linked as +15551234567')).toBeTruthy()
    expect(getWhatsAppOnboardingStatus).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Allowed WhatsApp numbers'), { target: { value: '15557654321' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save and restart/ }))
    })

    await waitFor(() =>
      expect(applyWhatsAppOnboarding).toHaveBeenCalledWith(
        'wa-pair-1',
        { allowed_users: '15557654321', mode: 'bot' },
        'work'
      )
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('reaches connected through polling after the user scans the QR', async () => {
    getWhatsAppOnboardingStatus.mockResolvedValue(CONNECTED_RESPONSE)

    await renderQuickSetup()
    await startQuickSetup()

    await screen.findByAltText('WhatsApp setup QR code')
    expect(await screen.findByText('Linked as +15551234567', {}, { timeout: 4000 })).toBeTruthy()

    // The wa.me link routes through the validated external opener.
    fireEvent.click(screen.getByRole('button', { name: /Open chat/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://wa.me/15551234567')
  })

  it('rejects a malformed allowlist entry without calling the backend', async () => {
    await renderQuickSetup()

    fireEvent.change(screen.getByLabelText('Allowed WhatsApp numbers'), { target: { value: '15551234567, carla' } })
    await startQuickSetup()

    expect(await screen.findByText(/does not look like a WhatsApp number/)).toBeTruthy()
    expect(startWhatsAppOnboarding).not.toHaveBeenCalled()
  })

  it('cancels the session server-side and returns to the idle card', async () => {
    await renderQuickSetup()
    await startQuickSetup()

    await screen.findByAltText('WhatsApp setup QR code')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(cancelWhatsAppOnboarding).toHaveBeenCalledWith('wa-pair-1')
    expect(screen.queryByAltText('WhatsApp setup QR code')).toBeNull()
    expect(screen.getByRole('button', { name: /Pair with QR/ })).toBeTruthy()
  })
})
