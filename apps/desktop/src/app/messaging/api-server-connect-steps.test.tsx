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

const s = en.messaging.apiServerPage
const LIVE = 'API server is live at http://127.0.0.1:8642/v1 and the key is valid.'

function envVar(key: string, value: null | string, isSet = Boolean(value)): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: key === 'API_SERVER_KEY',
    is_set: isSet,
    key,
    prompt: key,
    redacted_value: null,
    required: key === 'API_SERVER_KEY',
    url: null,
    value: key === 'API_SERVER_KEY' ? null : value
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'api_server' })
  testMessagingPlatform.mockResolvedValue({ message: LIVE, ok: true })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

async function renderSteps({ envVars = [] as MessagingEnvVarInfo[], scopeProfile = null as null | string } = {}) {
  const { ApiServerConnectSteps } = await import('./api-server-connect-steps')

  await act(async () => {
    render(
      <ApiServerConnectSteps
        envVars={envVars}
        onApplied={vi.fn()}
        onDone={vi.fn()}
        platformConnected={false}
        scopeProfile={scopeProfile}
      />
    )
  })
}

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

/** Lets the restart watch and the live test run to their end. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000)
  })
}

const next = () => click('Next')
const nextButton = () => screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement
const keyInput = () => screen.getByLabelText(s.keyLabel) as HTMLInputElement
const shown = (text: string) => screen.getAllByRole('listitem').some(item => item.textContent === text)

describe('ApiServerConnectSteps', () => {
  it('generates a strong key and refuses a weak one', async () => {
    await renderSteps()

    expect(screen.getByText(s.keyTitle)).toBeTruthy()
    expect(screen.getByText(s.keyCaution)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    fireEvent.change(keyInput(), { target: { value: 'short' } })
    expect(screen.getByText(en.messaging.envErrors.apiServerKey)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    await click(s.generateKey)
    expect(keyInput().value).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(screen.queryByText(en.messaging.envErrors.apiServerKey)).toBeNull()
    expect(nextButton().disabled).toBe(false)
  })

  it('shows the values to paste into the tool, with the model the profile advertises', async () => {
    await renderSteps({ envVars: [envVar('API_SERVER_PORT', '9000')], scopeProfile: 'coder' })

    fireEvent.change(keyInput(), { target: { value: 'a-strong-key-of-32-characters-xx' } })
    await next()

    expect(screen.getByText(s.connectTitle, { selector: 'h2' })).toBeTruthy()
    expect(screen.getByText('http://127.0.0.1:9000/v1')).toBeTruthy()
    expect(screen.getByText('coder')).toBeTruthy()
    expect(screen.getByText(s.keyFromStep)).toBeTruthy()
    expect(screen.queryByText(s.networkExposed)).toBeNull()

    await click(s.openGuide)
    expect(openExternalLink).toHaveBeenCalledWith('https://work4you.ai/docs/user-guide/messaging/open-webui')
  })

  it('warns when the bind reaches the network', async () => {
    await renderSteps({ envVars: [envVar('API_SERVER_KEY', null, true), envVar('API_SERVER_HOST', '0.0.0.0')] })

    await next()
    expect(screen.getByText(s.networkExposed)).toBeTruthy()
  })

  it('saves the key, restarts and waits until the endpoint answers with it', async () => {
    // Right after the restart the test can still say the listener is not up.
    testMessagingPlatform
      .mockResolvedValueOnce({ message: 'Key looks strong. Restart the gateway to start the API server.', ok: true })
      .mockResolvedValueOnce({ message: LIVE, ok: true })
    await renderSteps({ scopeProfile: 'work' })

    fireEvent.change(keyInput(), { target: { value: ' a-strong-key-of-32-characters-xx ' } })
    await next()
    await next()
    await settle()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'api_server',
      { enabled: true, env: { API_SERVER_KEY: 'a-strong-key-of-32-characters-xx' } },
      'work'
    )
    expect(restartGateway).toHaveBeenCalled()
    expect(testMessagingPlatform).toHaveBeenCalledTimes(2)
    expect(testMessagingPlatform).toHaveBeenCalledWith('api_server', 'work')
    expect(screen.getByText(s.readyTitle)).toBeTruthy()
    expect(shown('API server is live at http://127.0.0.1:8642/v1 and the key is valid')).toBe(true)
    expect(shown(en.messaging.channelSteps.checkRestarted)).toBe(true)
    expect(shown('Model work on /v1/models')).toBe(true)
    expect(screen.getByText('work', { selector: 'p b' })).toBeTruthy()
  })

  it('keeps a saved key when none is typed', async () => {
    await renderSteps({ envVars: [envVar('API_SERVER_KEY', null, true)] })

    expect(keyInput().placeholder).toBe(s.keyKept)
    expect(nextButton().disabled).toBe(false)
    await next()
    await next()
    await settle()

    expect(updateMessagingPlatform).toHaveBeenCalledWith('api_server', { enabled: true }, null)
  })

  it('shows why the endpoint did not answer, and no model line', async () => {
    testMessagingPlatform.mockResolvedValue({
      message: 'The gateway is running but nothing answered on 127.0.0.1:8642.',
      ok: false
    })
    await renderSteps()

    await click(s.generateKey)
    await next()
    await next()
    await settle()

    expect(testMessagingPlatform).toHaveBeenCalledTimes(5)
    expect(shown('The gateway is running but nothing answered on 127.0.0.1:8642.')).toBe(true)
    expect(shown('Model work4you on /v1/models')).toBe(false)
    expect(screen.getByText(s.readySetUp)).toBeTruthy()
  })

  it('goes back to the tool values with the reason when the save fails', async () => {
    updateMessagingPlatform.mockRejectedValue(new Error('Profile work is locked'))
    await renderSteps()

    await click(s.generateKey)
    await next()
    await next()

    expect(screen.getByText('Profile work is locked')).toBeTruthy()
    expect(screen.getByText(s.connectNote)).toBeTruthy()
    expect(restartGateway).not.toHaveBeenCalled()
  })
})
