// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const updateMessagingPlatform = vi.fn()
const openExternalLink = vi.fn()
const notify = vi.fn()

vi.mock('@/work4you', () => ({
  updateMessagingPlatform: (platformId: string, body: unknown, profile?: null | string) =>
    updateMessagingPlatform(platformId, body, profile)
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

// Built at runtime so the literal never matches credential-shaped push
// protection patterns.
const VALID_SID = 'AC' + 'a'.repeat(32)

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'sms' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderQuickSetup({
  configured = false,
  onApplied = vi.fn(),
  scopeProfile = null as null | string
} = {}) {
  const { SmsQuickSetup } = await import('./sms-quick-setup')

  await act(async () => {
    render(<SmsQuickSetup configured={configured} onApplied={onApplied} scopeProfile={scopeProfile} />)
  })

  return onApplied
}

function setField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Save & enable/ }))
  })
}

describe('SmsQuickSetup', () => {
  it('links the Twilio console', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /Open Twilio console/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://console.twilio.com/')
  })

  it('flags a malformed Account SID and phone number live', async () => {
    await renderQuickSetup()

    setField('Account SID', 'SK123')
    expect(screen.getByText(/starts with AC followed by 32 characters/)).toBeTruthy()

    setField('Twilio phone number', '5551234567')
    expect(screen.getByText(/5551234567 is not a phone number in E.164 format/)).toBeTruthy()
  })

  it('refuses to save until all required fields are filled', async () => {
    await renderQuickSetup()

    setField('Account SID', VALID_SID)
    setField('Auth token', 'auth-token')
    setField('Twilio phone number', '+15551234567')
    await save()

    expect(screen.getByText(/Enter the Account SID, Auth Token, phone number, and webhook URL/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('blocks the save on a webhook URL without a scheme', async () => {
    await renderQuickSetup()

    setField('Account SID', VALID_SID)
    setField('Auth token', 'auth-token')
    setField('Twilio phone number', '+15551234567')
    setField('Public webhook URL', 'my-domain.com/webhooks/twilio')
    await save()

    expect(screen.getByText(/not a valid webhook URL/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('rejects malformed allowlist numbers client-side before any API call', async () => {
    await renderQuickSetup()

    setField('Account SID', VALID_SID)
    setField('Auth token', 'auth-token')
    setField('Twilio phone number', '+15551234567')
    setField('Public webhook URL', 'https://example.com/webhooks/twilio')
    setField('Allowed senders', '+15559876543, 12345')
    await save()

    expect(screen.getByText(/12345 is not a phone number in E.164 format/)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('saves everything with enabled=true, trims values, and omits an empty allowlist', async () => {
    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })

    setField('Account SID', ` ${VALID_SID} `)
    setField('Auth token', 'auth-token')
    setField('Twilio phone number', ' +15551234567 ')
    setField('Public webhook URL', 'https://example.com/webhooks/twilio')
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'sms',
      {
        enabled: true,
        env: {
          TWILIO_ACCOUNT_SID: VALID_SID,
          TWILIO_AUTH_TOKEN: 'auth-token',
          TWILIO_PHONE_NUMBER: '+15551234567',
          SMS_WEBHOOK_URL: 'https://example.com/webhooks/twilio'
        }
      },
      'work'
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('includes the allowlist when provided, accepting the * wildcard', async () => {
    await renderQuickSetup()

    setField('Account SID', VALID_SID)
    setField('Auth token', 'auth-token')
    setField('Twilio phone number', '+15551234567')
    setField('Public webhook URL', 'https://example.com/webhooks/twilio')
    setField('Allowed senders', '+15559876543, *')
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'sms',
      expect.objectContaining({
        env: expect.objectContaining({ SMS_ALLOWED_USERS: '+15559876543, *' })
      }),
      null
    )
  })
})
