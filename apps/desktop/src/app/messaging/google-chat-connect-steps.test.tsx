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

const s = en.messaging.googleChatPage
const cs = en.messaging.channelSettings
const SUBSCRIPTION = 'projects/work4you-chat/subscriptions/chat-events'
const EVENTS_URL = 'https://bot.example.com/api/platforms/google_chat/events'

function envVar(key: string, value: null | string, isSet = Boolean(value)): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: key === 'GOOGLE_CHAT_SERVICE_ACCOUNT_JSON',
    is_set: isSet,
    key,
    prompt: key,
    redacted_value: null,
    required: false,
    url: null,
    value: key === 'GOOGLE_CHAT_SERVICE_ACCOUNT_JSON' ? null : value
  }
}

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'google_chat' })
  testMessagingPlatform.mockResolvedValue({
    message: 'Credentials verified and the Pub/Sub subscription is reachable. Restart the gateway to connect.',
    ok: true
  })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderSteps({ envVars = [] as MessagingEnvVarInfo[], scopeProfile = null as null | string } = {}) {
  const { GoogleChatConnectSteps } = await import('./google-chat-connect-steps')

  await act(async () => {
    render(
      <GoogleChatConnectSteps
        envVars={envVars}
        onApplied={vi.fn()}
        onDone={vi.fn()}
        platformConnected={false}
        scopeProfile={scopeProfile}
      />
    )
  })
}

function choose(title: string) {
  fireEvent.click(screen.getByRole('radio', { name: (name: string) => name.startsWith(title) }))
}

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

function setField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

const next = () => click('Next')
const nextButton = () => screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement

const checked = (title: string) =>
  screen.getByRole('radio', { name: (name: string) => name.startsWith(title) }).getAttribute('aria-checked')

/** Who (team) → How events arrive (Pub/Sub) → Google Cloud, filled in. */
async function throughPubsub() {
  choose(s.othersTitle)
  await next()
  await next()
  setField(s.projectLabel, 'work4you-chat')
  setField(s.subscriptionLabel, SUBSCRIPTION)
  await next()
}

describe('GoogleChatConnectSteps', () => {
  it('starts on Pub/Sub, links the console and checks the Google Cloud values', async () => {
    await renderSteps()

    choose(s.othersTitle)
    await next()
    expect(screen.getByText(s.modeTitle)).toBeTruthy()
    expect(checked(s.pubsubTitle)).toBe('true')
    await next()

    expect(screen.getByText(s.cloudNote)).toBeTruthy()
    expect(screen.getByText('chat-api-push@system.gserviceaccount.com', { selector: 'b' })).toBeTruthy()
    await click(s.openChatApi)
    expect(openExternalLink).toHaveBeenCalledWith(
      'https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat'
    )
    await click(s.openConsole)
    expect(openExternalLink).toHaveBeenCalledWith('https://console.cloud.google.com/')

    expect(nextButton().disabled).toBe(true)
    setField(s.projectLabel, 'My Project!')
    expect(screen.getByText(en.messaging.envErrors.googleChatProjectId('My Project!'))).toBeTruthy()
    setField(s.subscriptionLabel, 'chat-events')
    expect(screen.getByText(en.messaging.envErrors.googleChatSubscription('chat-events'))).toBeTruthy()

    // A project id that differs from the one inside the path is caught here,
    // before the gateway subscribes against the wrong project.
    setField(s.projectLabel, 'other-project')
    setField(s.subscriptionLabel, SUBSCRIPTION)
    expect(screen.getByText(s.projectMismatch)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    setField(s.projectLabel, 'work4you-chat')
    expect(screen.queryByText(s.projectMismatch)).toBeNull()
    expect(nextButton().disabled).toBe(false)
  })

  it('saves Pub/Sub with a list, restarts and checks the credentials', async () => {
    await renderSteps({ scopeProfile: 'work' })

    choose(s.othersTitle)
    await next()
    await next()
    setField(s.keyLabel, ' /home/ana/keys/work4you-chat.json ')
    setField(s.projectLabel, ' work4you-chat ')
    setField(s.subscriptionLabel, SUBSCRIPTION)
    await next()

    expect(screen.getByText(s.talkTitle)).toBeTruthy()
    expect(checked(cs.listTitle)).toBe('true')
    await next()
    expect(screen.getByText(s.emailsRequired)).toBeTruthy()

    setField(cs.listTitle, '*')
    await next()
    expect(screen.getByText(en.messaging.envErrors.emailAddress('*'))).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()

    setField(cs.listTitle, 'ana@acme.com, bruno@acme.com, ana@acme.com')
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'google_chat',
        {
          enabled: true,
          env: {
            GOOGLE_CHAT_ALLOWED_USERS: 'ana@acme.com,bruno@acme.com',
            GOOGLE_CHAT_PROJECT_ID: 'work4you-chat',
            GOOGLE_CHAT_SERVICE_ACCOUNT_JSON: '/home/ana/keys/work4you-chat.json',
            GOOGLE_CHAT_SUBSCRIPTION_NAME: SUBSCRIPTION
          }
        },
        'work'
      )
    )
    expect(await screen.findByText(s.checkPubsub)).toBeTruthy()
    expect(testMessagingPlatform).toHaveBeenCalledWith('google_chat', 'work')
    expect(testMessagingPlatform).toHaveBeenCalledTimes(1)
    expect(screen.getByText(s.whoList(2))).toBeTruthy()
    expect(await screen.findByText(en.messaging.channelSteps.checkRestarted, {}, { timeout: 4000 })).toBeTruthy()
  })

  it('takes the HTTP callback values and clears the saved Pub/Sub ones', async () => {
    testMessagingPlatform.mockResolvedValue({ message: 'Credentials verified. HTTP callback mode.', ok: true })
    await renderSteps({
      envVars: [
        envVar('GOOGLE_CHAT_SERVICE_ACCOUNT_JSON', null, true),
        envVar('GOOGLE_CHAT_PROJECT_ID', 'work4you-chat'),
        envVar('GOOGLE_CHAT_SUBSCRIPTION_NAME', SUBSCRIPTION)
      ]
    })

    choose(s.othersTitle)
    await next()
    choose(s.httpTitle)
    await next()

    expect(screen.getByText(s.cloudNoteHttp)).toBeTruthy()
    expect(screen.queryByLabelText(s.subscriptionLabel)).toBeNull()
    expect(screen.getByText(/set Connection settings to/)).toBeTruthy()
    expect((screen.getByLabelText(s.keyLabel) as HTMLInputElement).placeholder).toBe(s.keyKept)

    setField(s.eventsUrlLabel, EVENTS_URL)
    setField(s.saEmailLabel, 'chat at system')
    expect(screen.getByText(en.messaging.envErrors.emailAddress('chat at system'))).toBeTruthy()
    expect(nextButton().disabled).toBe(true)
    setField(s.saEmailLabel, 'chat@system.gserviceaccount.com')
    expect((screen.getByLabelText(s.audienceLabel) as HTMLInputElement).placeholder).toBe(EVENTS_URL)
    await next()

    // A saved project with no saved list means people were approved by code.
    expect(checked(cs.approveTitle)).toBe('true')
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'google_chat',
        {
          clear_env: ['GOOGLE_CHAT_SUBSCRIPTION_NAME'],
          enabled: true,
          env: {
            GOOGLE_CHAT_HTTP_EVENTS_SERVICE_ACCOUNT_EMAIL: 'chat@system.gserviceaccount.com',
            GOOGLE_CHAT_HTTP_EVENTS_URL: EVENTS_URL
          }
        },
        null
      )
    )
    expect(await screen.findByText(s.checkHttp)).toBeTruthy()
    expect(screen.getByText(s.whoApprove)).toBeTruthy()
  })

  it('clears a saved list when people are approved by code instead', async () => {
    await renderSteps({
      envVars: [
        envVar('GOOGLE_CHAT_PROJECT_ID', 'work4you-chat'),
        envVar('GOOGLE_CHAT_SUBSCRIPTION_NAME', SUBSCRIPTION),
        envVar('GOOGLE_CHAT_ALLOWED_USERS', 'ana@acme.com')
      ]
    })

    choose(s.othersTitle)
    await next()
    await next()
    expect(nextButton().disabled).toBe(false)
    await next()

    expect(checked(cs.listTitle)).toBe('true')
    expect((screen.getByLabelText(cs.listTitle) as HTMLInputElement).value).toBe('ana@acme.com')
    choose(cs.approveTitle)
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'google_chat',
        {
          clear_env: ['GOOGLE_CHAT_ALLOWED_USERS'],
          enabled: true,
          env: { GOOGLE_CHAT_PROJECT_ID: 'work4you-chat', GOOGLE_CHAT_SUBSCRIPTION_NAME: SUBSCRIPTION }
        },
        null
      )
    )
  })

  it('asks for your own account when it is just you, and shows why Google refused', async () => {
    testMessagingPlatform.mockResolvedValue({
      message: 'The Service Account lacks Pub/Sub Subscriber (and Viewer) on the subscription.',
      ok: false
    })
    await renderSteps()

    choose(s.meTitle)
    await next()
    await next()
    setField(s.projectLabel, 'work4you-chat')
    setField(s.subscriptionLabel, SUBSCRIPTION)
    await next()

    expect(screen.getByText(s.meEmailTitle)).toBeTruthy()
    await next()
    expect(screen.getByText(s.emailsRequired)).toBeTruthy()

    setField(s.meEmailLabel, 'ana@acme.com')
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'google_chat',
        {
          enabled: true,
          env: {
            GOOGLE_CHAT_ALLOWED_USERS: 'ana@acme.com',
            GOOGLE_CHAT_PROJECT_ID: 'work4you-chat',
            GOOGLE_CHAT_SUBSCRIPTION_NAME: SUBSCRIPTION
          }
        },
        null
      )
    )
    expect(
      await screen.findByText('The Service Account lacks Pub/Sub Subscriber (and Viewer) on the subscription.')
    ).toBeTruthy()
    expect(screen.getByText(s.whoMe)).toBeTruthy()
  })

  it('goes back to who can talk with the reason when the save fails', async () => {
    updateMessagingPlatform.mockRejectedValue(new Error('Profile work is locked'))
    await renderSteps()

    await throughPubsub()
    setField(cs.listTitle, 'ana@acme.com')
    await next()

    expect(await screen.findByText('Profile work is locked')).toBeTruthy()
    expect(screen.getByText(s.talkTitle)).toBeTruthy()
    expect(restartGateway).not.toHaveBeenCalled()
    expect(testMessagingPlatform).not.toHaveBeenCalled()
  })
})
