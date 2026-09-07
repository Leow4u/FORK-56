// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MessagingEnvVarInfo } from '@/types/work4you'

const updateMessagingPlatform = vi.fn()
const openExternalLink = vi.fn()
const notify = vi.fn()
const writeText = vi.fn()

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

function envVar(key: string, value: null | string = null, isSet = Boolean(value)): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: key.includes('STATE'),
    is_set: isSet,
    key,
    prompt: key,
    redacted_value: null,
    required: key === 'MSGRAPH_WEBHOOK_CLIENT_STATE',
    url: null,
    value
  }
}

const DEFAULT_VARS = [
  envVar('MSGRAPH_WEBHOOK_CLIENT_STATE'),
  envVar('MSGRAPH_WEBHOOK_HOST'),
  envVar('MSGRAPH_WEBHOOK_PORT'),
  envVar('MSGRAPH_WEBHOOK_PUBLIC_URL'),
  envVar('MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES'),
  envVar('MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS')
]

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'msgraph_webhook' })
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderQuickSetup({
  configured = false,
  envVars = DEFAULT_VARS,
  onApplied = vi.fn(),
  scopeProfile = null as null | string
} = {}) {
  const { MsgraphWebhookQuickSetup } = await import('./msgraph-webhook-quick-setup')

  await act(async () => {
    render(
      <MsgraphWebhookQuickSetup
        configured={configured}
        envVars={envVars}
        onApplied={onApplied}
        scopeProfile={scopeProfile}
      />
    )
  })

  return onApplied
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Save & enable/ }))
  })
}

describe('helpers', () => {
  it('builds the notification URL from public URL, else the local bind', async () => {
    const { msgraphNotificationUrl } = await import('./msgraph-webhook-quick-setup')

    expect(msgraphNotificationUrl([])).toBe('http://127.0.0.1:8646/msgraph/webhook')
    expect(
      msgraphNotificationUrl([envVar('MSGRAPH_WEBHOOK_PORT', '8651'), envVar('MSGRAPH_WEBHOOK_HOST', 'ops.local')])
    ).toBe('http://ops.local:8651/msgraph/webhook')
    expect(msgraphNotificationUrl([envVar('MSGRAPH_WEBHOOK_HOST', '0.0.0.0')])).toBe(
      'http://127.0.0.1:8646/msgraph/webhook'
    )
    expect(msgraphNotificationUrl([envVar('MSGRAPH_WEBHOOK_PUBLIC_URL', 'https://tunnel.example/')])).toBe(
      'https://tunnel.example/msgraph/webhook'
    )
  })

  it('treats an unset or loopback host as localhost-only', async () => {
    const { msgraphIsLocalhostOnly, msgraphIsNetworkExposed } = await import('./msgraph-webhook-quick-setup')

    expect(msgraphIsLocalhostOnly([])).toBe(true)
    expect(msgraphIsNetworkExposed([envVar('MSGRAPH_WEBHOOK_HOST', '0.0.0.0')])).toBe(true)
    expect(msgraphIsLocalhostOnly([envVar('MSGRAPH_WEBHOOK_HOST', '127.0.0.1')])).toBe(true)
  })

  it('generates a 64-char hex secret that passes the strength check', async () => {
    const { generateMsgraphClientState } = await import('./msgraph-webhook-quick-setup')
    const { validateMessagingEnv } = await import('./validate-env')

    const secret = generateMsgraphClientState()

    expect(secret).toMatch(/^[0-9a-f]{64}$/)
    expect(validateMessagingEnv('MSGRAPH_WEBHOOK_CLIENT_STATE', secret)).toBeNull()
    expect(generateMsgraphClientState()).not.toBe(secret)
  })
})

describe('MsgraphWebhookQuickSetup', () => {
  it('refuses to save without a client_state', async () => {
    await renderQuickSetup()

    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(screen.getByText(/Generate a clientState first/)).toBeTruthy()
  })

  it('saves localhost after generating a secret', async () => {
    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })

    fireEvent.click(screen.getByRole('button', { name: /Generate secret/ }))
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'msgraph_webhook',
      {
        enabled: true,
        env: expect.objectContaining({
          MSGRAPH_WEBHOOK_HOST: '127.0.0.1',
          MSGRAPH_WEBHOOK_CLIENT_STATE: expect.stringMatching(/^[0-9a-f]{64}$/)
        })
      },
      'work'
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('refuses a remote bind until CIDRs are set', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /Generate secret/ }))
    fireEvent.click(screen.getByRole('button', { name: /Network/ }))
    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(screen.getByText(/A network bind requires source CIDRs/)).toBeTruthy()
  })

  it('saves a remote bind when CIDRs are provided', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /Generate secret/ }))
    fireEvent.click(screen.getByRole('button', { name: /Network/ }))
    fireEvent.change(screen.getByLabelText(/Source CIDRs/), { target: { value: '52.96.0.0/14' } })
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'msgraph_webhook',
      {
        enabled: true,
        env: expect.objectContaining({
          MSGRAPH_WEBHOOK_HOST: '0.0.0.0',
          MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS: '52.96.0.0/14'
        })
      },
      null
    )
  })

  it('opens the Graph webhook guide', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /Graph webhook guide/ }))

    expect(openExternalLink).toHaveBeenCalledWith('https://work4you.ai/docs/user-guide/messaging/msgraph-webhook')
  })
})
