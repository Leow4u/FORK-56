// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

const s = en.messaging.msgraphPage
const UP = 'Listener is up on port 8646 (localhost-only). Register https://bot.example.com/msgraph/webhook with Graph.'

function envVar(key: string, value: null | string, isSet = Boolean(value)): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: key === 'MSGRAPH_WEBHOOK_CLIENT_STATE',
    is_set: isSet,
    key,
    prompt: key,
    redacted_value: null,
    required: key === 'MSGRAPH_WEBHOOK_CLIENT_STATE',
    url: null,
    value: key === 'MSGRAPH_WEBHOOK_CLIENT_STATE' ? null : value
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'msgraph_webhook' })
  testMessagingPlatform.mockResolvedValue({ message: UP, ok: true })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

async function renderSteps({ envVars = [] as MessagingEnvVarInfo[], scopeProfile = 'work' as null | string } = {}) {
  const { MsgraphConnectSteps } = await import('./msgraph-connect-steps')

  await act(async () => {
    render(<MsgraphConnectSteps envVars={envVars} onApplied={vi.fn()} onDone={vi.fn()} scopeProfile={scopeProfile} />)
  })
}

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000)
  })
}

const next = () => click('Next')
const nextButton = () => screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement
const shown = (text: string) => screen.getAllByRole('listitem').some(item => item.textContent === text)

describe('MsgraphConnectSteps', () => {
  it('needs a clientState secret before going on', async () => {
    await renderSteps()

    expect(screen.getByText(s.secretCaution)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(s.secretLabel), { target: { value: 'short' } })
    expect(screen.getByText(en.messaging.envErrors.msgraphClientState)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    await click(s.generateSecret)
    expect((screen.getByLabelText(s.secretLabel) as HTMLInputElement).value).toMatch(/^[0-9a-f]{64}$/)
    expect(nextButton().disabled).toBe(false)
  })

  it('asks for source CIDRs on a network bind and follows the public origin', async () => {
    await renderSteps({ envVars: [envVar('MSGRAPH_WEBHOOK_CLIENT_STATE', null, true)] })

    await next()
    expect(screen.getByText('http://127.0.0.1:8646/msgraph/webhook')).toBeTruthy()

    await click(s.reachNetwork)
    expect(screen.getByText(s.networkNeedsCidrs)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(s.cidrsLabel), { target: { value: 'not-a-cidr' } })
    expect(screen.getByText(en.messaging.envErrors.msgraphCidr('not-a-cidr'))).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.cidrsLabel), { target: { value: '52.96.0.0/14' } })
    fireEvent.change(screen.getByLabelText(s.publicUrlLabel), { target: { value: 'https://bot.example.com' } })
    expect(screen.getByText('https://bot.example.com/msgraph/webhook')).toBeTruthy()
    expect(nextButton().disabled).toBe(false)
  })

  it('saves, restarts and waits until the listener answers', async () => {
    testMessagingPlatform
      .mockResolvedValueOnce({ message: 'Microsoft Graph webhook starts with the gateway. Start it.', ok: true })
      .mockResolvedValue({ message: UP, ok: true })
    await renderSteps()

    await click(s.generateSecret)
    const secret = (screen.getByLabelText(s.secretLabel) as HTMLInputElement).value
    await next()
    fireEvent.change(screen.getByLabelText(s.publicUrlLabel), { target: { value: 'https://bot.example.com' } })
    await next()
    fireEvent.change(screen.getByLabelText(s.resourcesLabel), {
      target: { value: 'communications/onlineMeetings, chats/*/messages' }
    })
    await next()
    await settle()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'msgraph_webhook',
      {
        enabled: true,
        env: {
          MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES: 'communications/onlineMeetings, chats/*/messages',
          MSGRAPH_WEBHOOK_CLIENT_STATE: secret,
          MSGRAPH_WEBHOOK_HOST: '127.0.0.1',
          MSGRAPH_WEBHOOK_PUBLIC_URL: 'https://bot.example.com'
        }
      },
      'work'
    )
    expect(testMessagingPlatform).toHaveBeenCalledTimes(2)
    expect(shown(s.checkListener('8646', false))).toBe(true)
    expect(shown('Register https://bot.example.com/msgraph/webhook with Graph')).toBe(true)
    expect(shown(en.messaging.channelSteps.checkRestarted)).toBe(true)

    await click(s.openGuide)
    expect(openExternalLink).toHaveBeenCalledWith('https://work4you.ai/docs/user-guide/messaging/msgraph-webhook')
  })

  it('keeps a saved secret and clears an emptied filter', async () => {
    await renderSteps({
      envVars: [
        envVar('MSGRAPH_WEBHOOK_CLIENT_STATE', null, true),
        envVar('MSGRAPH_WEBHOOK_HOST', '127.0.0.1'),
        envVar('MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES', 'chats/*/messages')
      ]
    })

    expect((screen.getByLabelText(s.secretLabel) as HTMLInputElement).placeholder).toBe(s.secretKept)
    await next()
    await next()
    fireEvent.change(screen.getByLabelText(s.resourcesLabel), { target: { value: '' } })
    await next()
    await settle()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'msgraph_webhook',
      { clear_env: ['MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES'], enabled: true, env: { MSGRAPH_WEBHOOK_HOST: '127.0.0.1' } },
      'work'
    )
  })
})
