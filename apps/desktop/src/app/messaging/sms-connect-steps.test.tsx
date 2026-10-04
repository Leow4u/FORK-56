// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'

const updateMessagingPlatform = vi.fn()
const testMessagingPlatform = vi.fn()
const restartGateway = vi.fn()
const getActionStatus = vi.fn()
const openExternalLink = vi.fn()

vi.mock('@/work4you', () => ({
  getActionStatus: () => getActionStatus(),
  restartGateway: () => restartGateway(),
  testMessagingPlatform: (id: string, profile?: null | string) => testMessagingPlatform(id, profile),
  updateMessagingPlatform: (id: string, body: unknown, profile?: null | string) =>
    updateMessagingPlatform(id, body, profile)
}))

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

const s = en.messaging.smsPage
// Built at runtime so no SID-shaped literal sits in the source.
const SID = 'AC' + '0123456789abcdef'.repeat(2)
const HOOK = 'https://bot.example.com/webhooks/twilio'

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'sms' })
  testMessagingPlatform.mockResolvedValue({ message: 'Twilio credentials and phone number verified.', ok: true })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderSteps({ scopeProfile = null as null | string } = {}) {
  const { SmsConnectSteps } = await import('./sms-connect-steps')

  await act(async () => {
    render(
      <SmsConnectSteps
        envVars={[]}
        onApplied={vi.fn()}
        onDone={vi.fn()}
        platformConnected={false}
        scopeProfile={scopeProfile}
      />
    )
  })
}

function choose(name: RegExp | string) {
  fireEvent.click(screen.getByRole('radio', { name }))
}

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

const next = () => click('Next')
const nextButton = () => screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement

function fillTwilio() {
  fireEvent.change(screen.getByLabelText(s.sidLabel), { target: { value: SID } })
  fireEvent.change(screen.getByLabelText(s.tokenLabel), { target: { value: 'auth-token-value' } })
  fireEvent.change(screen.getByLabelText(s.numberLabel), { target: { value: '+15551234567' } })
}

async function reachWhoCanText(audience: RegExp) {
  choose(audience)
  await next()
  fillTwilio()
  await next()
  fireEvent.change(screen.getByLabelText(s.webhookLabel), { target: { value: HOOK } })
  await next()
}

describe('SmsConnectSteps', () => {
  it('takes the Twilio account and checks the SID and the number', async () => {
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()
    expect(nextButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(s.sidLabel), { target: { value: 'SK123' } })
    expect(screen.getByText(en.messaging.envErrors.twilioAccountSid)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.numberLabel), { target: { value: '5551234567' } })
    expect(screen.getByText(en.messaging.envErrors.smsNumber('5551234567'))).toBeTruthy()

    fillTwilio()
    expect(nextButton().disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: s.openConsole }))
    expect(openExternalLink).toHaveBeenCalledWith('https://console.twilio.com/')
  })

  it('needs the public webhook URL before going on', async () => {
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()
    fillTwilio()
    await next()

    expect(screen.getByText(s.webhookCaution)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(s.webhookLabel), { target: { value: 'bot.example.com' } })
    expect(screen.getByText(en.messaging.envErrors.smsWebhookUrl('bot.example.com'))).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(s.webhookLabel), { target: { value: HOOK } })
    expect(nextButton().disabled).toBe(false)
  })

  it('saves the numbers with their +, restarts and checks the account with Twilio', async () => {
    await renderSteps({ scopeProfile: 'work' })
    await reachWhoCanText(new RegExp(s.othersTitle))

    const list = screen.getByLabelText(s.listTitle)
    fireEvent.change(list, { target: { value: '5511999993977' } })
    await next()
    expect(screen.getByText(en.messaging.envErrors.smsNumber('5511999993977'))).toBeTruthy()

    fireEvent.change(list, { target: { value: '+5511999993977, +5511988880000' } })
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'sms',
        {
          enabled: true,
          env: {
            SMS_ALLOWED_USERS: '+5511999993977,+5511988880000',
            SMS_WEBHOOK_URL: HOOK,
            TWILIO_ACCOUNT_SID: SID,
            TWILIO_AUTH_TOKEN: 'auth-token-value',
            TWILIO_PHONE_NUMBER: '+15551234567'
          }
        },
        'work'
      )
    )
    expect(await screen.findByText('+15551234567', { selector: 'li b' })).toBeTruthy()
    expect(testMessagingPlatform).toHaveBeenCalledWith('sms', 'work')
    expect(screen.getByText(s.whoList(2))).toBeTruthy()
    expect(await screen.findByText(en.messaging.channelSteps.checkRestarted, {}, { timeout: 4000 })).toBeTruthy()
  })

  it('approves people by code when no list is given', async () => {
    await renderSteps()
    await reachWhoCanText(new RegExp(s.othersTitle))

    choose(new RegExp(s.approveTitle))
    await next()

    await waitFor(() => expect(updateMessagingPlatform).toHaveBeenCalled())
    const [, body] = updateMessagingPlatform.mock.calls[0] as [string, { env: Record<string, string> }]
    expect(body.env.SMS_ALLOWED_USERS).toBeUndefined()
    expect(await screen.findByText(s.whoApprove)).toBeTruthy()
  })

  it('takes the own number for "just me"', async () => {
    await renderSteps()
    await reachWhoCanText(new RegExp(s.meTitle))

    expect(screen.getByText(s.meNumberTitle)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.meNumberLabel), { target: { value: '+5511999993977' } })
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'sms',
        expect.objectContaining({ env: expect.objectContaining({ SMS_ALLOWED_USERS: '+5511999993977' }) }),
        null
      )
    )
    expect(await screen.findByText(s.whoMe)).toBeTruthy()
  })
})
