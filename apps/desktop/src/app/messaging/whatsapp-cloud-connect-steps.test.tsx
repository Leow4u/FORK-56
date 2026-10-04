// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'
import type { MessagingEnvVarInfo } from '@/types/work4you'

const updateMessagingPlatform = vi.fn()
const testMessagingPlatform = vi.fn()
const restartGateway = vi.fn()
const getActionStatus = vi.fn()
const openExternalLink = vi.fn()
const writeText = vi.fn()

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

const s = en.messaging.whatsappCloudPage
const PHONE_ID = '109876543210987'
const TOKEN = `EAA${'x'.repeat(120)}`
const SECRET = '0123456789abcdef0123456789abcdef'
const VERIFY = 'k3n9-verify-token-value'

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'whatsapp_cloud' })
  testMessagingPlatform.mockResolvedValue({
    message: 'Meta confirmed the access token for +55 11 99999-3977 (Work4You). Listener is up on port 8090.',
    ok: true
  })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderSteps({ envVars = [] as MessagingEnvVarInfo[], scopeProfile = null as null | string } = {}) {
  const { WhatsAppCloudConnectSteps } = await import('./whatsapp-cloud-connect-steps')

  await act(async () => {
    render(
      <WhatsAppCloudConnectSteps envVars={envVars} onApplied={vi.fn()} onDone={vi.fn()} scopeProfile={scopeProfile} />
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

function fillMeta() {
  fireEvent.change(screen.getByLabelText(s.phoneIdLabel), { target: { value: PHONE_ID } })
  fireEvent.change(screen.getByLabelText(s.tokenLabel), { target: { value: TOKEN } })
  fireEvent.change(screen.getByLabelText(s.secretLabel), { target: { value: SECRET } })
}

/** Who → Meta values → webhook (verify token + public origin) → Who can talk. */
async function reachWhoCanTalk(audience: RegExp) {
  choose(audience)
  await next()
  fillMeta()
  await next()
  fireEvent.change(screen.getByLabelText(s.verifyLabel), { target: { value: VERIFY } })
  fireEvent.change(screen.getByLabelText(s.publicUrlLabel), { target: { value: 'https://bot.example.com' } })
  await next()
}

describe('WhatsAppCloudConnectSteps', () => {
  it('takes the three values from Meta and catches the usual paste mistakes', async () => {
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()
    expect(screen.getByText(s.metaTitle)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    // The phone number itself where its ID belongs, and a short temporary token.
    fireEvent.change(screen.getByLabelText(s.phoneIdLabel), { target: { value: '15551234567' } })
    expect(screen.getByText(en.messaging.envErrors.whatsappCloudPhoneNumberPasted)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.tokenLabel), { target: { value: 'EAAshort' } })
    expect(screen.getByText(en.messaging.envErrors.whatsappCloudAccessToken)).toBeTruthy()

    fillMeta()
    expect(nextButton().disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: s.openDashboard }))
    expect(openExternalLink).toHaveBeenCalledWith('https://developers.facebook.com/apps')
  })

  it('generates the verify token and shows the callback Meta needs', async () => {
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()
    fillMeta()
    await next()

    expect(nextButton().disabled).toBe(true)
    await click(s.generate)
    expect((screen.getByLabelText(s.verifyLabel) as HTMLInputElement).value).toMatch(/^[0-9a-f]{64}$/)

    expect(screen.getByText('http://127.0.0.1:8090/whatsapp/webhook')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.publicUrlLabel), { target: { value: 'https://bot.example.com/' } })
    expect(screen.getByText('https://bot.example.com/whatsapp/webhook')).toBeTruthy()
    expect(nextButton().disabled).toBe(false)

    await click(s.copyCallback)
    expect(writeText).toHaveBeenCalledWith('https://bot.example.com/whatsapp/webhook')
  })

  it('needs a list of numbers, saves, restarts and shows who Meta confirmed', async () => {
    await renderSteps({ scopeProfile: 'work' })
    await reachWhoCanTalk(new RegExp(s.othersTitle))

    // The Cloud API sends no approval codes: the list is the only answer.
    expect(screen.getAllByRole('radio')).toHaveLength(1)
    await next()
    expect(screen.getByText(s.numbersRequired)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(s.listTitle), { target: { value: '*' } })
    await next()
    expect(screen.getByText(en.messaging.envErrors.whatsappNumber('*'))).toBeTruthy()

    fireEvent.change(screen.getByLabelText(s.listTitle), { target: { value: '5511999993977, 5511988880000' } })
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'whatsapp_cloud',
        {
          enabled: true,
          env: {
            WHATSAPP_CLOUD_ACCESS_TOKEN: TOKEN,
            WHATSAPP_CLOUD_ALLOWED_USERS: '5511999993977,5511988880000',
            WHATSAPP_CLOUD_APP_SECRET: SECRET,
            WHATSAPP_CLOUD_PHONE_NUMBER_ID: PHONE_ID,
            WHATSAPP_CLOUD_PUBLIC_URL: 'https://bot.example.com',
            WHATSAPP_CLOUD_VERIFY_TOKEN: VERIFY,
            WHATSAPP_CLOUD_WEBHOOK_HOST: '127.0.0.1'
          }
        },
        'work'
      )
    )
    expect(restartGateway).toHaveBeenCalled()
    expect(await screen.findByText('+55 11 99999-3977', { selector: 'b' }, { timeout: 4000 })).toBeTruthy()
    expect(testMessagingPlatform).toHaveBeenCalledWith('whatsapp_cloud', 'work')
    expect(screen.getByText(s.whoList(2))).toBeTruthy()
    expect(screen.getByText('Verify and save', { selector: 'b' })).toBeTruthy()
  })

  it('takes the own number for testing', async () => {
    await renderSteps()
    await reachWhoCanTalk(new RegExp(s.meTitle))

    expect(screen.getByText(s.meNumberTitle)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.meNumberLabel), { target: { value: '5511999993977' } })
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'whatsapp_cloud',
        expect.objectContaining({ env: expect.objectContaining({ WHATSAPP_CLOUD_ALLOWED_USERS: '5511999993977' }) }),
        null
      )
    )
    expect(await screen.findByText(s.whoMe)).toBeTruthy()
  })
})
