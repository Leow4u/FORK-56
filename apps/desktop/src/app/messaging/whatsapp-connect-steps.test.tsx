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
const runGatewayRestart = vi.fn()

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

vi.mock('@/store/system-actions', async () => {
  const { atom } = await vi.importActual<typeof NanostoresModule>('nanostores')

  return { $gatewayRestarting: atom(false), runGatewayRestart: () => runGatewayRestart() }
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

const APPLIED = { needs_restart: false, ok: true, platform: 'whatsapp', restart_started: true }

beforeEach(() => {
  startWhatsAppOnboarding.mockResolvedValue(WAITING_RESPONSE)
  getWhatsAppOnboardingStatus.mockResolvedValue(WAITING_RESPONSE)
  applyWhatsAppOnboarding.mockResolvedValue(APPLIED)
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderSteps({
  onAdvanced = vi.fn(),
  onApplied = vi.fn(),
  onDone = vi.fn(),
  savedMode = null as null | string,
  scopeProfile = null as null | string
} = {}) {
  const { WhatsAppConnectSteps } = await import('./whatsapp-connect-steps')

  await act(async () => {
    render(
      <WhatsAppConnectSteps
        onAdvanced={onAdvanced}
        onApplied={onApplied}
        onDone={onDone}
        savedMode={savedMode}
        scopeProfile={scopeProfile}
      />
    )
  })

  return { onAdvanced, onApplied, onDone }
}

function choose(name: RegExp | string) {
  fireEvent.click(screen.getByRole('radio', { name }))
}

async function next() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  })
}

const nextButton = () => screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement

describe('WhatsAppConnectSteps', () => {
  it('asks who will use the channel first, then starts the pairing for that choice', async () => {
    await renderSteps({ scopeProfile: 'work' })

    expect(screen.getByText('Who will use WhatsApp with Work4You?')).toBeTruthy()
    expect(nextButton().disabled).toBe(true)
    expect(startWhatsAppOnboarding).not.toHaveBeenCalled()

    choose(/Clients and team/)
    await next()

    // Other people in = the bot mode of the bridge; the allowlist comes later.
    expect(startWhatsAppOnboarding).toHaveBeenCalledWith('bot', '', 'work')
    const qr = await screen.findByAltText('WhatsApp setup QR code')
    expect(qr.getAttribute('src')).toBe('data:image/png;base64,fake-qr')
    expect(screen.getByText(/Linked devices/)).toBeTruthy()
    // The who-can-talk step exists only when other people are let in.
    expect(screen.getByText('Who can talk')).toBeTruthy()
    // Nothing to continue to until the phone scanned the code.
    expect(nextButton().disabled).toBe(true)
  })

  it('links the own number in self-chat mode and skips the who-can-talk step', async () => {
    await renderSteps()

    choose(/Just me, from my own number/)
    await next()

    expect(startWhatsAppOnboarding).toHaveBeenCalledWith('self-chat', '', null)
    expect(screen.queryByText('Who can talk')).toBeNull()
  })

  it('shows the bridge-preparing state until polling delivers the QR', async () => {
    startWhatsAppOnboarding.mockResolvedValue({ ...WAITING_RESPONSE, qr_payload: null, status: 'installing' })

    await renderSteps()
    choose(/Clients and team/)
    await next()

    expect(screen.getByText(/Preparing the WhatsApp bridge/)).toBeTruthy()
    expect(screen.queryByAltText('WhatsApp setup QR code')).toBeNull()

    // Next poll delivers the QR payload — the placeholder swaps for the code.
    expect(await screen.findByAltText('WhatsApp setup QR code', {}, { timeout: 4000 })).toBeTruthy()
  })

  it('unlocks Next once the scan lands, saves in one call and reports the restart', async () => {
    getWhatsAppOnboardingStatus.mockResolvedValue(CONNECTED_RESPONSE)
    const { onApplied, onDone } = await renderSteps()

    choose(/A dedicated number for the bot/)
    await next()
    await screen.findByAltText('WhatsApp setup QR code')

    expect(await screen.findByText('Linked as +15551234567', {}, { timeout: 4000 })).toBeTruthy()
    expect(nextButton().disabled).toBe(false)

    // The wa.me link routes through the validated external opener.
    fireEvent.click(screen.getByRole('button', { name: /Open chat/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://wa.me/15551234567')

    await next()

    // "Just me" with a dedicated number: bot mode, no allowlist — the first
    // message asks for approval here.
    await waitFor(() =>
      expect(applyWhatsAppOnboarding).toHaveBeenCalledWith('wa-pair-1', { allowed_users: '', mode: 'bot' }, null)
    )
    expect(await screen.findByText('WhatsApp is set up.')).toBeTruthy()
    expect(screen.getByText('Number linked as +15551234567')).toBeTruthy()
    expect(screen.getByText(/the first message from your phone asks for your approval/)).toBeTruthy()
    expect(onApplied).toHaveBeenCalled()

    expect(await screen.findByText('Messaging gateway restarted', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByText(/send hi to \+15551234567/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalled()
  })

  it('collects the allowed numbers for clients and team and sends them with the save', async () => {
    // A session already linked on disk: start reports connected at once.
    startWhatsAppOnboarding.mockResolvedValue(CONNECTED_RESPONSE)

    await renderSteps({ scopeProfile: 'work' })
    choose(/Clients and team/)
    await next()

    expect(screen.getByText('Linked as +15551234567')).toBeTruthy()
    expect(getWhatsAppOnboardingStatus).not.toHaveBeenCalled()
    await next()

    expect(screen.getByText('Who can talk to the bot?')).toBeTruthy()
    const numbers = screen.getByLabelText('Only these numbers')

    // Shape mistakes are caught before the save, and an empty list too.
    await next()
    expect(screen.getByText(/Enter at least one number/)).toBeTruthy()
    fireEvent.change(numbers, { target: { value: '15557654321, carla' } })
    await next()
    expect(screen.getByText(/does not look like a WhatsApp number/)).toBeTruthy()
    expect(applyWhatsAppOnboarding).not.toHaveBeenCalled()

    fireEvent.change(numbers, { target: { value: '15557654321, 15551112222' } })
    await next()

    await waitFor(() =>
      expect(applyWhatsAppOnboarding).toHaveBeenCalledWith(
        'wa-pair-1',
        { allowed_users: '15557654321, 15551112222', mode: 'bot' },
        'work'
      )
    )
    expect(await screen.findByText('2 numbers can talk to the bot')).toBeTruthy()
  })

  it('lets people be approved as they message instead of listing numbers', async () => {
    startWhatsAppOnboarding.mockResolvedValue(CONNECTED_RESPONSE)

    await renderSteps()
    choose(/Clients and team/)
    await next()
    await next()

    choose(/Approve people as they message/)
    expect(screen.queryByLabelText('Only these numbers')).toBeNull()
    await next()

    await waitFor(() =>
      expect(applyWhatsAppOnboarding).toHaveBeenCalledWith('wa-pair-1', { allowed_users: '', mode: 'bot' }, null)
    )
    expect(await screen.findByText('People you approve as they message')).toBeTruthy()
  })

  it('returns to the screen it left, with the error, when the save fails', async () => {
    startWhatsAppOnboarding.mockResolvedValue(CONNECTED_RESPONSE)
    applyWhatsAppOnboarding.mockRejectedValue(new Error('500 boom'))

    await renderSteps()
    choose(/Clients and team/)
    await next()
    await next()
    fireEvent.change(screen.getByLabelText('Only these numbers'), { target: { value: '15557654321' } })
    await next()

    expect(await screen.findByText('500 boom')).toBeTruthy()
    expect(screen.getByText('Who can talk to the bot?')).toBeTruthy()
  })

  it('reports a failed gateway restart on the ready screen with a restart action', async () => {
    startWhatsAppOnboarding.mockResolvedValue(CONNECTED_RESPONSE)
    getActionStatus.mockResolvedValue({ exit_code: 1, running: false })

    await renderSteps()
    choose(/Just me, from my own number/)
    await next()
    await next()

    expect(await screen.findByText('Gateway restart failed (exit 1)', {}, { timeout: 4000 })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Restart gateway/ }))
    expect(runGatewayRestart).toHaveBeenCalled()
    expect(screen.getByText('Only you, from Message yourself')).toBeTruthy()
  })

  it('cancels the pairing session when going back from the QR', async () => {
    await renderSteps()
    choose(/Clients and team/)
    await next()
    await screen.findByAltText('WhatsApp setup QR code')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    })

    expect(cancelWhatsAppOnboarding).toHaveBeenCalledWith('wa-pair-1')
    expect(screen.queryByAltText('WhatsApp setup QR code')).toBeNull()
    expect(screen.getByText('Who will use WhatsApp with Work4You?')).toBeTruthy()
  })

  it('hands over to the advanced setup from the QR screen', async () => {
    const { onAdvanced } = await renderSteps()
    choose(/Clients and team/)
    await next()

    fireEvent.click(await screen.findByRole('button', { name: 'Advanced setup' }))
    expect(onAdvanced).toHaveBeenCalled()
  })
})
