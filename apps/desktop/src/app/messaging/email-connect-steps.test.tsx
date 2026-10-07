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

vi.mock('@/work4you', () => ({
  getActionStatus: () => getActionStatus(),
  restartGateway: () => restartGateway(),
  testMessagingPlatform: (id: string, profile?: null | string) => testMessagingPlatform(id, profile),
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

const s = en.messaging.emailPage
const hd = en.messaging.homeDelivery
const home = (chatId: string) => ({ chat_id: chatId, name: chatId })

async function throughDeliver() {
  expect(await screen.findByText(hd.title)).toBeTruthy()
  await next()
}

function envVar(key: string, value: null | string, isSet = Boolean(value)): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: key === 'EMAIL_PASSWORD',
    is_set: isSet,
    key,
    prompt: key,
    redacted_value: null,
    required: false,
    url: null,
    value: key === 'EMAIL_PASSWORD' ? null : value
  }
}

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'email' })
  testMessagingPlatform.mockResolvedValue({ message: 'IMAP and SMTP logins succeeded.', ok: true })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderSteps({
  envVars = [] as MessagingEnvVarInfo[],
  requireFreshPassword = false,
  scopeProfile = null as null | string
} = {}) {
  const { EmailConnectSteps } = await import('./email-connect-steps')

  await act(async () => {
    render(
      <EmailConnectSteps
        envVars={envVars}
        onApplied={vi.fn()}
        onDone={vi.fn()}
        platformConnected={false}
        requireFreshPassword={requireFreshPassword}
        scopeProfile={scopeProfile}
      />
    )
  })
}

function choose(name: RegExp | string) {
  fireEvent.click(screen.getByRole('radio', { name }))
}

function addChip(label: string, value: string) {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

function chooseAppPasswordYes() {
  choose(new RegExp(s.appPasswordYes))
}

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

const next = () => click('Next')
const nextButton = () => screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement
const pressed = (name: string) => screen.getByRole('radio', { name }).getAttribute('aria-checked')

describe('EmailConnectSteps', () => {
  it('fills in the mail servers from the provider the address names', async () => {
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()
    expect(screen.getByText(s.mailboxTitle)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(s.addressLabel), { target: { value: 'bot@gmail.com' } })
    expect(pressed('Gmail / Workspace')).toBe('true')
    expect(screen.getByText(s.serversFilled('imap.gmail.com:993', 'smtp.gmail.com:587'))).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    chooseAppPasswordYes()
    fireEvent.change(screen.getByLabelText(s.passwordLabel), { target: { value: 'app-password' } })
    expect(nextButton().disabled).toBe(false)
  })

  it('takes custom mail servers and checks their shape', async () => {
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()
    fireEvent.change(screen.getByLabelText(s.addressLabel), { target: { value: 'bot@example.org' } })
    choose(new RegExp(`^${s.custom}$`))
    fireEvent.change(screen.getByLabelText(s.customPasswordLabel), { target: { value: 'secret' } })

    expect(nextButton().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(s.imapHostLabel), { target: { value: 'https://mail.example.org' } })
    expect(screen.getByText(en.messaging.envErrors.emailHost('https://mail.example.org'))).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.imapHostLabel), { target: { value: 'mail.example.org' } })
    fireEvent.change(screen.getByLabelText(s.smtpHostLabel), { target: { value: 'mail.example.org' } })
    fireEvent.change(screen.getByLabelText(s.smtpPortLabel), { target: { value: 'abc' } })
    expect(screen.getByText(en.messaging.envErrors.emailPort('abc'))).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(s.smtpPortLabel), { target: { value: '465' } })
    expect(nextButton().disabled).toBe(false)
    await next()
    addChip(s.allowedLabel, 'ana@example.org')
    await next()
    await throughDeliver()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'email',
        {
          enabled: true,
          env: {
            EMAIL_ADDRESS: 'bot@example.org',
            EMAIL_ALLOWED_USERS: 'ana@example.org',
            EMAIL_IMAP_HOST: 'mail.example.org',
            EMAIL_PASSWORD: 'secret',
            EMAIL_SMTP_HOST: 'mail.example.org',
            EMAIL_SMTP_PORT: '465'
          },
          home_channel: home('ana@example.org')
        },
        null
      )
    )
  })

  it('needs a list of addresses, saves, restarts and proves the logins', async () => {
    await renderSteps({ scopeProfile: 'work' })

    choose(new RegExp(s.othersTitle))
    await next()
    fireEvent.change(screen.getByLabelText(s.addressLabel), { target: { value: 'bot@gmail.com' } })
    chooseAppPasswordYes()
    fireEvent.change(screen.getByLabelText(s.passwordLabel), { target: { value: 'app-password' } })
    await next()

    expect(screen.getByText(s.writeTitle)).toBeTruthy()
    await next()
    expect(screen.getByText(s.addressesRequired)).toBeTruthy()

    // `*` would drop every email, so it is refused like any non-address.
    addChip(s.allowedLabel, '*')
    expect(screen.getByText(en.messaging.envErrors.emailAddress('*'))).toBeTruthy()

    addChip(s.allowedLabel, 'ana@example.com')
    addChip(s.allowedLabel, 'bruno@example.com')
    await next()
    await throughDeliver()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'email',
        {
          enabled: true,
          env: {
            EMAIL_ADDRESS: 'bot@gmail.com',
            EMAIL_ALLOWED_USERS: 'ana@example.com,bruno@example.com',
            EMAIL_IMAP_HOST: 'imap.gmail.com',
            EMAIL_PASSWORD: 'app-password',
            EMAIL_SMTP_HOST: 'smtp.gmail.com'
          },
          home_channel: home('ana@example.com')
        },
        'work'
      )
    )
    expect(await screen.findByText('bot@gmail.com', { selector: 'li b' })).toBeTruthy()
    expect(testMessagingPlatform).toHaveBeenCalledWith('email', 'work')
    expect(screen.getByText(s.whoList(2))).toBeTruthy()
    expect(await screen.findByText(en.messaging.channelSteps.checkRestarted, {}, { timeout: 4000 })).toBeTruthy()
  })

  it('shows why the mail servers refused the login', async () => {
    testMessagingPlatform.mockResolvedValue({
      message: 'IMAP login to imap.gmail.com:993 failed: bad password',
      ok: false
    })
    await renderSteps()

    choose(new RegExp(s.meTitle))
    await next()
    fireEvent.change(screen.getByLabelText(s.addressLabel), { target: { value: 'bot@gmail.com' } })
    chooseAppPasswordYes()
    fireEvent.change(screen.getByLabelText(s.passwordLabel), { target: { value: 'wrong' } })
    await next()

    expect(screen.getByText(s.meAddressTitle)).toBeTruthy()
    addChip(s.meAddressLabel, 'ana@example.com')
    await next()
    await throughDeliver()

    expect(await screen.findByText('IMAP login to imap.gmail.com:993 failed: bad password')).toBeTruthy()
    expect(screen.getByText(s.whoMe)).toBeTruthy()
  })

  it('requires a new app password when setup is re-run on a profile that already had one', async () => {
    await renderSteps({
      envVars: [envVar('EMAIL_PASSWORD', null, true), envVar('EMAIL_ADDRESS', 'bot@gmail.com')],
      requireFreshPassword: true
    })

    choose(new RegExp(s.meTitle))
    await next()
    fireEvent.change(screen.getByLabelText(s.addressLabel), { target: { value: 'bot@gmail.com' } })
    chooseAppPasswordYes()
    expect(nextButton().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(s.passwordLabel), { target: { value: 'fresh-app-password' } })
    expect(nextButton().disabled).toBe(false)
  })

  it('keeps the saved password and clears custom ports when a provider is picked again', async () => {
    await renderSteps({
      envVars: [
        envVar('EMAIL_ADDRESS', 'bot@example.org'),
        envVar('EMAIL_PASSWORD', null, true),
        envVar('EMAIL_IMAP_HOST', 'mail.example.org'),
        envVar('EMAIL_SMTP_HOST', 'mail.example.org'),
        envVar('EMAIL_IMAP_PORT', '143'),
        envVar('EMAIL_SMTP_PORT', '465'),
        envVar('EMAIL_ALLOWED_USERS', 'ana@example.org')
      ]
    })

    choose(new RegExp(s.othersTitle))
    await next()
    expect(pressed(s.custom)).toBe('true')
    expect((screen.getByLabelText(s.customPasswordLabel) as HTMLInputElement).placeholder).toBe(s.passwordKept)

    choose(/^Fastmail$/)
    chooseAppPasswordYes()
    expect(nextButton().disabled).toBe(false)
    await next()
    await next()
    await throughDeliver()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'email',
        {
          clear_env: ['EMAIL_IMAP_PORT', 'EMAIL_SMTP_PORT'],
          enabled: true,
          env: {
            EMAIL_ADDRESS: 'bot@example.org',
            EMAIL_ALLOWED_USERS: 'ana@example.org',
            EMAIL_IMAP_HOST: 'imap.fastmail.com',
            EMAIL_SMTP_HOST: 'smtp.fastmail.com'
          },
          home_channel: home('ana@example.org')
        },
        null
      )
    )
  })
})
