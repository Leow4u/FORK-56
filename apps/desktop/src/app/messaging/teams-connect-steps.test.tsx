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

const s = en.messaging.teamsPage
const CLIENT_ID = '1b2c3d4e-0000-4000-8000-00000000abcd'
const TENANT_ID = '9a8b7c6d-0000-4000-8000-00000000dcba'
const PERSON = '6f1c2a9e-0b7d-4c55-9a51-2f3e4d5c6b7a'

function envVar(key: string, value: null | string, isSet = Boolean(value)): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: key === 'TEAMS_CLIENT_SECRET',
    is_set: isSet,
    key,
    prompt: key,
    redacted_value: null,
    required: false,
    url: null,
    value: key === 'TEAMS_CLIENT_SECRET' ? null : value
  }
}

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'teams' })
  testMessagingPlatform.mockResolvedValue({ message: 'Listener is up on port 3978 (localhost-only).', ok: true })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderSteps({ envVars = [] as MessagingEnvVarInfo[], scopeProfile = null as null | string } = {}) {
  const { TeamsConnectSteps } = await import('./teams-connect-steps')

  await act(async () => {
    render(
      <TeamsConnectSteps
        envVars={envVars}
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

function fillAzure(secret = 'azure-secret-value') {
  fireEvent.change(screen.getByLabelText(s.clientIdLabel), { target: { value: CLIENT_ID } })
  fireEvent.change(screen.getByLabelText(s.tenantIdLabel), { target: { value: TENANT_ID } })

  if (secret) {
    fireEvent.change(screen.getByLabelText(s.secretLabel), { target: { value: secret } })
  }
}

/** Who → Azure → endpoint (with a public origin) → Who can talk. */
async function reachWhoCanTalk(audience: RegExp) {
  choose(audience)
  await next()
  fillAzure()
  await next()
  fireEvent.change(screen.getByLabelText(s.publicUrlLabel), { target: { value: 'https://bot.example.com' } })
  await next()
}

describe('TeamsConnectSteps', () => {
  it('takes the Azure registration and checks the ids are GUIDs', async () => {
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()

    expect(screen.getByText(s.azureTitle)).toBeTruthy()
    expect(screen.getByText('teams app create', { selector: 'code' })).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    // An app name pasted where the client id belongs is caught at once.
    fireEvent.change(screen.getByLabelText(s.clientIdLabel), { target: { value: 'my-bot' } })
    expect(screen.getByText(en.messaging.envErrors.teamsGuid('my-bot'))).toBeTruthy()

    fillAzure()
    expect(nextButton().disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: s.openPortal }))
    expect(openExternalLink).toHaveBeenCalledWith('https://portal.azure.com')
  })

  it('shows the endpoint Azure needs, following the public origin', async () => {
    await renderSteps()

    choose(new RegExp(s.othersTitle))
    await next()
    fillAzure()
    await next()

    // Until there is a public origin the endpoint is this machine, and the
    // field says Teams cannot reach it.
    expect(screen.getByText('http://127.0.0.1:3978/api/messages')).toBeTruthy()
    expect(screen.getByText(s.tunnelWarning)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(s.publicUrlLabel), { target: { value: 'http://bot.example.com' } })
    expect(screen.getByText(en.messaging.envErrors.teamsPublicUrl('http://bot.example.com'))).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(s.publicUrlLabel), { target: { value: 'https://bot.example.com/' } })
    expect(screen.getByText('https://bot.example.com/api/messages')).toBeTruthy()
    expect(nextButton().disabled).toBe(false)
  })

  it('saves the registration, restarts and proves the listener', async () => {
    await renderSteps({ scopeProfile: 'work' })
    choose(new RegExp(s.othersTitle))
    await next()
    fillAzure()
    await next()
    fireEvent.click(screen.getByRole('button', { name: s.bindNetwork }))
    fireEvent.change(screen.getByLabelText(s.publicUrlLabel), { target: { value: 'https://bot.example.com' } })
    await next()

    fireEvent.change(screen.getByLabelText(en.messaging.channelSettings.listTitle), { target: { value: 'ana' } })
    await next()
    expect(screen.getByText(en.messaging.envErrors.teamsGuid('ana'))).toBeTruthy()

    fireEvent.change(screen.getByLabelText(en.messaging.channelSettings.listTitle), { target: { value: PERSON } })
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'teams',
        {
          enabled: true,
          env: {
            TEAMS_ALLOWED_USERS: PERSON,
            TEAMS_CLIENT_ID: CLIENT_ID,
            TEAMS_CLIENT_SECRET: 'azure-secret-value',
            TEAMS_HOST: '0.0.0.0',
            TEAMS_PUBLIC_URL: 'https://bot.example.com',
            TEAMS_TENANT_ID: TENANT_ID
          }
        },
        'work'
      )
    )
    expect(restartGateway).toHaveBeenCalled()
    expect(await screen.findByText(s.checkListener('3978'), {}, { timeout: 4000 })).toBeTruthy()
    expect(testMessagingPlatform).toHaveBeenCalledWith('teams', 'work')
    expect(screen.getByText('https://bot.example.com/api/messages', { selector: 'b' })).toBeTruthy()
  })

  it('lets the whole organization in with the allowlist wildcard', async () => {
    await renderSteps()
    await reachWhoCanTalk(new RegExp(s.othersTitle))

    choose(new RegExp(s.everyoneTitle))
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'teams',
        expect.objectContaining({ env: expect.objectContaining({ TEAMS_ALLOWED_USERS: '*' }) }),
        null
      )
    )
    expect(await screen.findByText(s.checkListener('3978'), {}, { timeout: 4000 })).toBeTruthy()
  })

  it('approves "just me" by code when no object ID is given', async () => {
    await renderSteps()
    await reachWhoCanTalk(new RegExp(s.meTitle))

    expect(screen.getByText(s.meIdTitle)).toBeTruthy()
    await next()

    await waitFor(() => expect(updateMessagingPlatform).toHaveBeenCalled())
    const [, body] = updateMessagingPlatform.mock.calls[0] as [string, { env: Record<string, string> }]
    expect(body.env.TEAMS_ALLOWED_USERS).toBeUndefined()
    expect(await screen.findByText(s.checkListener('3978'), {}, { timeout: 4000 })).toBeTruthy()
  })

  it('keeps a saved secret and clears an emptied list when run again', async () => {
    await renderSteps({
      envVars: [
        envVar('TEAMS_CLIENT_ID', CLIENT_ID),
        envVar('TEAMS_TENANT_ID', TENANT_ID),
        envVar('TEAMS_CLIENT_SECRET', null, true),
        envVar('TEAMS_ALLOWED_USERS', PERSON),
        envVar('TEAMS_PUBLIC_URL', 'https://bot.example.com')
      ]
    })

    choose(new RegExp(s.othersTitle))
    await next()
    expect((screen.getByLabelText(s.secretLabel) as HTMLInputElement).placeholder).toBe(s.secretKept)
    expect(nextButton().disabled).toBe(false)
    await next()
    await next()

    fireEvent.change(screen.getByLabelText(en.messaging.channelSettings.listTitle), { target: { value: '' } })
    await next()

    await waitFor(() =>
      expect(updateMessagingPlatform).toHaveBeenCalledWith(
        'teams',
        {
          clear_env: ['TEAMS_ALLOWED_USERS'],
          enabled: true,
          env: {
            TEAMS_CLIENT_ID: CLIENT_ID,
            TEAMS_HOST: '127.0.0.1',
            TEAMS_PUBLIC_URL: 'https://bot.example.com',
            TEAMS_TENANT_ID: TENANT_ID
          }
        },
        null
      )
    )
  })
})
