// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { A2AAgentInfo, MessagingEnvVarInfo, ToolsetInfo } from '@/types/work4you'

const updateMessagingPlatform = vi.fn()
const getA2AAgents = vi.fn()
const createA2AAgent = vi.fn()
const deleteA2AAgent = vi.fn()
const getToolsets = vi.fn()
const setToolsetEnabled = vi.fn()
const openExternalLink = vi.fn()
const notify = vi.fn()
const writeText = vi.fn()

vi.mock('@/work4you', () => ({
  updateMessagingPlatform: (platformId: string, body: unknown, profile?: null | string) =>
    updateMessagingPlatform(platformId, body, profile),
  getA2AAgents: (profile?: null | string) => getA2AAgents(profile),
  createA2AAgent: (body: unknown, profile?: null | string) => createA2AAgent(body, profile),
  deleteA2AAgent: (name: string, profile?: null | string) => deleteA2AAgent(name, profile),
  getToolsets: (profile?: null | string) => getToolsets(profile),
  setToolsetEnabled: (name: string, enabled: boolean, profile?: null | string) =>
    setToolsetEnabled(name, enabled, profile)
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

vi.mock('@/store/profile', async () => {
  const { atom } = await vi.importActual<typeof NanostoresModule>('nanostores')

  return { $profileScope: atom<null | string>(null) }
})

function envVar(key: string, value: null | string = null, isSet = Boolean(value)): MessagingEnvVarInfo {
  return {
    advanced: false,
    description: '',
    is_password: key.includes('TOKEN'),
    is_set: isSet,
    key,
    prompt: key,
    redacted_value: null,
    required: false,
    url: null,
    value
  }
}

function peer(name: string, url = `http://127.0.0.1:990${name.length}`): A2AAgentInfo {
  return { capabilities: [], has_auth: false, name, timeout: 120, url }
}

function toolset(name: string, enabled: boolean): ToolsetInfo {
  return { configured: true, description: '', enabled, label: name, name, tools: [] }
}

beforeEach(() => {
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'a2a' })
  getA2AAgents.mockResolvedValue({ agents: [] })
  createA2AAgent.mockResolvedValue(peer('researcher'))
  deleteA2AAgent.mockResolvedValue({ ok: true, name: 'researcher' })
  getToolsets.mockResolvedValue([toolset('a2a', false)])
  setToolsetEnabled.mockResolvedValue({ ok: true, name: 'a2a', enabled: true })
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
  enabled = false,
  envVars = [envVar('A2A_PORT'), envVar('A2A_HOST'), envVar('A2A_BEARER_TOKEN'), envVar('A2A_PUBLIC_URL')],
  onApplied = vi.fn(),
  scopeProfile = null as null | string
} = {}) {
  const { A2AQuickSetup } = await import('./a2a-quick-setup')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <A2AQuickSetup
          configured={configured}
          enabled={enabled}
          envVars={envVars}
          onApplied={onApplied}
          scopeProfile={scopeProfile}
        />
      </QueryClientProvider>
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
  it('builds the Agent Card URL from public URL, else the local bind', async () => {
    const { a2aCardUrl } = await import('./a2a-quick-setup')

    expect(a2aCardUrl([])).toBe('http://127.0.0.1:9900/.well-known/agent-card.json')
    expect(a2aCardUrl([envVar('A2A_PORT', '9911'), envVar('A2A_HOST', 'my-box.local')])).toBe(
      'http://my-box.local:9911/.well-known/agent-card.json'
    )
    expect(a2aCardUrl([envVar('A2A_HOST', '0.0.0.0')])).toBe('http://127.0.0.1:9900/.well-known/agent-card.json')
    expect(a2aCardUrl([envVar('A2A_PUBLIC_URL', 'https://tunnel.example/')])).toBe(
      'https://tunnel.example/.well-known/agent-card.json'
    )
  })

  it('treats a missing token or loopback host as localhost-only', async () => {
    const { a2aIsLocalhostOnly, a2aIsNetworkExposed } = await import('./a2a-quick-setup')

    expect(a2aIsLocalhostOnly([])).toBe(true)
    expect(a2aIsNetworkExposed([envVar('A2A_HOST', '0.0.0.0')])).toBe(true)
    expect(a2aIsLocalhostOnly([envVar('A2A_HOST', '0.0.0.0'), envVar('A2A_BEARER_TOKEN', null, true)])).toBe(false)
    expect(a2aIsLocalhostOnly([envVar('A2A_HOST', '0.0.0.0')])).toBe(true)
  })

  it('generates tokens that pass the inbound strength check', async () => {
    const { generateA2AToken } = await import('./a2a-quick-setup')
    const { isUsableApiServerKey } = await import('./validate-env')

    const token = generateA2AToken()

    expect(isUsableApiServerKey(token)).toBe(true)
    expect(generateA2AToken()).not.toBe(token)
  })
})

describe('A2AQuickSetup', () => {
  it('saves inbound as localhost without a token', async () => {
    const onApplied = await renderQuickSetup({ scopeProfile: 'work' })

    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'a2a',
      { enabled: true, env: { A2A_HOST: '127.0.0.1' } },
      'work'
    )
    expect(onApplied).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }))
  })

  it('refuses a remote bind until a token exists', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /Network/ }))
    await save()

    expect(screen.getByText(/bearer token is required/i)).toBeTruthy()
    expect(updateMessagingPlatform).not.toHaveBeenCalled()
  })

  it('saves a generated token with a remote bind', async () => {
    await renderQuickSetup({ scopeProfile: 'work' })

    fireEvent.click(screen.getByRole('button', { name: /Generate token/ }))
    fireEvent.click(screen.getByRole('button', { name: /Network/ }))

    const token = (screen.getByLabelText('Bearer token') as HTMLInputElement).value

    await save()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'a2a',
      { enabled: true, env: { A2A_HOST: '0.0.0.0', A2A_BEARER_TOKEN: token } },
      'work'
    )
  })

  it('copies the Agent Card URL', async () => {
    await renderQuickSetup({
      envVars: [envVar('A2A_PORT', '9911'), envVar('A2A_HOST', '127.0.0.1')]
    })

    expect(screen.getByText('http://127.0.0.1:9911/.well-known/agent-card.json')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy Agent Card URL/ }))
    })
    expect(writeText).toHaveBeenCalledWith('http://127.0.0.1:9911/.well-known/agent-card.json')
  })

  it('adds and deletes outbound peers without leaking tokens', async () => {
    getA2AAgents.mockResolvedValue({ agents: [peer('researcher', 'http://research-box.local:9900')] })
    await renderQuickSetup({ scopeProfile: 'work' })

    await waitFor(() => expect(screen.getByText('researcher')).toBeTruthy())
    expect(screen.getByText('http://research-box.local:9900')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Peer name'), { target: { value: 'coder' } })
    fireEvent.change(screen.getByLabelText('Peer URL'), { target: { value: 'http://coder.local:9900' } })
    fireEvent.change(screen.getByLabelText('Peer token (optional)'), { target: { value: 'peer-secret' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add peer/ }))
    })

    expect(createA2AAgent).toHaveBeenCalledWith(
      { name: 'coder', url: 'http://coder.local:9900', token: 'peer-secret' },
      'work'
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Remove/ }))
    })
    expect(deleteA2AAgent).toHaveBeenCalledWith('researcher', 'work')
  })

  it('enables the outbound toolset without touching inbound chaining', async () => {
    await renderQuickSetup({ enabled: true, scopeProfile: 'work' })

    expect(screen.getByText(/outbound tools are still off/i)).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enable outbound tools/ }))
    })

    expect(setToolsetEnabled).toHaveBeenCalledWith('a2a', true, 'work')
  })

  it('links the A2A guide', async () => {
    await renderQuickSetup()

    fireEvent.click(screen.getByRole('button', { name: /A2A guide/ }))
    expect(openExternalLink).toHaveBeenCalledWith('https://work4you.ai/docs/user-guide/messaging/a2a')
  })
})
