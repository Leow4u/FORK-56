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

const GUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const OTHER_GUID = '9c1e2f10-8b44-4d21-9f0a-51b7c3d4e5f6'

function envVar(key: string, value: null | string = null, isSet = Boolean(value)): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: key === 'TEAMS_CLIENT_SECRET',
    is_set: isSet,
    key,
    prompt: key,
    redacted_value: null,
    required: key.endsWith('_ID') || key === 'TEAMS_CLIENT_SECRET',
    url: null,
    value
  }
}

const DEFAULT_VARS = [
  envVar('TEAMS_CLIENT_ID'),
  envVar('TEAMS_CLIENT_SECRET'),
  envVar('TEAMS_TENANT_ID'),
  envVar('TEAMS_ALLOWED_USERS'),
  envVar('TEAMS_PUBLIC_URL'),
  envVar('TEAMS_HOST'),
  envVar('TEAMS_PORT')
]

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'teams' })
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
  const { TeamsQuickSetup } = await import('./teams-quick-setup')

  await act(async () => {
    render(
      <TeamsQuickSetup configured={configured} envVars={envVars} onApplied={onApplied} scopeProfile={scopeProfile} />
    )
  })

  return onApplied
}

function fillCredentials() {
  fireEvent.change(screen.getByLabelText(/Application \(client\) ID/), { target: { value: GUID } })
  fireEvent.change(screen.getByLabelText(/Directory \(tenant\) ID/), { target: { value: OTHER_GUID } })
  fireEvent.change(screen.getByLabelText(/Client secret/), { target: { value: 'azure-secret-value' } })
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Save & enable/ }))
  })
}

describe('helpers', () => {
  it('builds the messaging endpoint from the public origin, else the local bind', async () => {
    const { teamsMessagingEndpoint } = await import('./teams-quick-setup')

    expect(teamsMessagingEndpoint([])).toBe('http://127.0.0.1:3978/api/messages')
    expect(teamsMessagingEndpoint([envVar('TEAMS_PORT', '3999'), envVar('TEAMS_HOST', 'bot.local')])).toBe(
      'http://bot.local:3999/api/messages'
    )
    // An all-interfaces bind is not a reachable address to hand Azure.
    expect(teamsMessagingEndpoint([envVar('TEAMS_HOST', '0.0.0.0')])).toBe('http://127.0.0.1:3978/api/messages')
    expect(teamsMessagingEndpoint([envVar('TEAMS_PUBLIC_URL', 'https://tunnel.example/')])).toBe(
      'https://tunnel.example/api/messages'
    )
  })

  it('treats an unset or loopback host as not network exposed', async () => {
    const { teamsIsNetworkExposed } = await import('./teams-quick-setup')

    expect(teamsIsNetworkExposed([])).toBe(false)
    expect(teamsIsNetworkExposed([envVar('TEAMS_HOST', '127.0.0.1')])).toBe(false)
    expect(teamsIsNetworkExposed([envVar('TEAMS_HOST', '0.0.0.0')])).toBe(true)
  })
})

describe('TeamsQuickSetup', () => {
  it('refuses to save without the ids', async () => {
    await renderQuickSetup()

    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(screen.getByText(/Enter the client ID and tenant ID first/)).toBeTruthy()
  })

  it('refuses to save without a client secret', async () => {
    await renderQuickSetup()

    fireEvent.change(screen.getByLabelText(/Application \(client\) ID/), { target: { value: GUID } })
    fireEvent.change(screen.getByLabelText(/Directory \(tenant\) ID/), { target: { value: OTHER_GUID } })
    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(screen.getByText(/Enter the client secret first/)).toBeTruthy()
  })

  it('keeps a saved secret when the field is left empty', async () => {
    await renderQuickSetup({
      configured: true,
      envVars: [
        envVar('TEAMS_CLIENT_ID', GUID),
        envVar('TEAMS_CLIENT_SECRET', null, true),
        envVar('TEAMS_TENANT_ID', OTHER_GUID),
        envVar('TEAMS_ALLOWED_USERS', GUID),
        envVar('TEAMS_PUBLIC_URL'),
        envVar('TEAMS_HOST'),
        envVar('TEAMS_PORT')
      ]
    })

    await save()

    const [, body] = updateMessagingPlatform.mock.calls[0]

    expect(body.env).not.toHaveProperty('TEAMS_CLIENT_SECRET')
    expect(body.env.TEAMS_CLIENT_ID).toBe(GUID)
  })

  it('rejects an app name pasted into the client id', async () => {
    await renderQuickSetup()

    fillCredentials()
    fireEvent.change(screen.getByLabelText(/Application \(client\) ID/), { target: { value: 'work4you-bot' } })
    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    // Shown twice on purpose: inline under the field and in the save banner.
    expect(screen.getAllByText(/is not an Azure AD GUID/).length).toBe(2)
  })

  it('rejects a plain-HTTP public origin', async () => {
    await renderQuickSetup()

    fillCredentials()
    fireEvent.change(screen.getByLabelText(/Public HTTPS origin/), { target: { value: 'http://tunnel.example' } })
    await save()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(screen.getAllByText(/is not a valid public URL/).length).toBe(2)
  })

  it('saves a localhost bind and the public origin', async () => {
    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })

    fillCredentials()
    fireEvent.change(screen.getByLabelText(/Public HTTPS origin/), { target: { value: 'https://tunnel.example' } })
    fireEvent.change(screen.getByLabelText(/Allowed users/), { target: { value: GUID } })
    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'teams',
      {
        enabled: true,
        env: {
          TEAMS_CLIENT_ID: GUID,
          TEAMS_TENANT_ID: OTHER_GUID,
          TEAMS_CLIENT_SECRET: 'azure-secret-value',
          TEAMS_HOST: '127.0.0.1',
          TEAMS_PUBLIC_URL: 'https://tunnel.example',
          TEAMS_ALLOWED_USERS: GUID
        }
      },
      'work'
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('saves a network bind when chosen', async () => {
    await renderQuickSetup()

    fillCredentials()
    fireEvent.click(screen.getByRole('button', { name: /Network/ }))
    await save()

    const [, body] = updateMessagingPlatform.mock.calls[0]

    expect(body.env.TEAMS_HOST).toBe('0.0.0.0')
  })

  it('copies the endpoint that Azure needs, following the public origin', async () => {
    await renderQuickSetup()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy endpoint/ }))
    })

    expect(writeText).toHaveBeenCalledWith('http://127.0.0.1:3978/api/messages')

    fireEvent.change(screen.getByLabelText(/Public HTTPS origin/), { target: { value: 'https://tunnel.example' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy endpoint/ }))
    })

    expect(writeText).toHaveBeenLastCalledWith('https://tunnel.example/api/messages')
  })

  it('warns while the endpoint still points at localhost', async () => {
    await renderQuickSetup()

    expect(screen.getByText(/which Teams cannot reach/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/Public HTTPS origin/), { target: { value: 'https://tunnel.example' } })

    expect(screen.queryByText(/which Teams cannot reach/)).toBeNull()
  })

  it('warns while no allowlist is set', async () => {
    await renderQuickSetup()

    expect(screen.getByText(/anyone who can find the bot in your tenant/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/Allowed users/), { target: { value: GUID } })

    expect(screen.queryByText(/anyone who can find the bot in your tenant/)).toBeNull()
  })

  it('opens the Teams guide and the Azure portal', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /Teams guide/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://work4you.ai/docs/user-guide/messaging/teams')

    fireEvent.click(screen.getByRole('button', { name: /Azure portal/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://portal.azure.com')
  })
})
