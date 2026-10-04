// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'

const updateMessagingPlatform = vi.fn()
const testMessagingPlatform = vi.fn()
const restartGateway = vi.fn()
const getActionStatus = vi.fn()
const getA2AAgents = vi.fn()
const createA2AAgent = vi.fn()
const deleteA2AAgent = vi.fn()
const getToolsets = vi.fn()
const setToolsetEnabled = vi.fn()

vi.mock('@/work4you', () => ({
  createA2AAgent: (body: unknown, profile?: null | string) => createA2AAgent(body, profile),
  deleteA2AAgent: (name: string, profile?: null | string) => deleteA2AAgent(name, profile),
  getA2AAgents: (profile?: null | string) => getA2AAgents(profile),
  getActionStatus: () => getActionStatus(),
  getToolsets: (profile?: null | string) => getToolsets(profile),
  restartGateway: () => restartGateway(),
  setToolsetEnabled: (name: string, enabled: boolean, profile?: null | string) =>
    setToolsetEnabled(name, enabled, profile),
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

const s = en.messaging.a2aPage

const UP =
  'Listener is up on port 9900 (remote (bearer auth)). Agent Card: https://agents.example.com/.well-known/agent-card.json. 1 outbound peer configured.'

let peers: { capabilities: string[]; has_auth: boolean; name: string; timeout: number; url: string }[] = []
let outboundOn = false

beforeEach(() => {
  vi.useFakeTimers()
  peers = []
  outboundOn = false
  getA2AAgents.mockImplementation(async () => ({ agents: peers }))
  createA2AAgent.mockImplementation(async (body: { name: string; token?: string; url: string }) => {
    const peer = { capabilities: [], has_auth: Boolean(body.token), name: body.name, timeout: 120, url: body.url }
    peers = [...peers, peer]

    return peer
  })
  getToolsets.mockImplementation(async () => [{ enabled: outboundOn, name: 'a2a' }])
  setToolsetEnabled.mockImplementation(async (name: string, enabled: boolean) => {
    outboundOn = enabled

    return { enabled, name, ok: true }
  })
  updateMessagingPlatform.mockResolvedValue({ ok: true, platform: 'a2a' })
  testMessagingPlatform.mockResolvedValue({ message: UP, ok: true })
  restartGateway.mockResolvedValue({ name: 'gateway-restart', ok: true, pid: 1 })
  getActionStatus.mockResolvedValue({ exit_code: 0, running: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

/** Lets queries, the restart watch and the live test run to their end. */
async function settle(ms = 60_000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function renderSteps({ scopeProfile = 'work' as null | string } = {}) {
  const { A2AConnectSteps } = await import('./a2a-connect-steps')

  await act(async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <A2AConnectSteps envVars={[]} onApplied={vi.fn()} onDone={vi.fn()} scopeProfile={scopeProfile} />
      </QueryClientProvider>
    )
  })
  await settle(50)
}

function choose(title: string) {
  fireEvent.click(screen.getByRole('radio', { name: (name: string) => name.startsWith(title) }))
}

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

const next = () => click('Next')
const nextButton = () => screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement
const stepLabels = () => screen.getAllByRole('listitem').map(item => item.textContent)
const shown = (text: string) => screen.getAllByRole('listitem').some(item => item.textContent === text)

describe('A2AConnectSteps', () => {
  it('asks what A2A is for and keeps only the steps that apply', async () => {
    await renderSteps()

    expect(stepLabels()).toEqual(['1What for', '2Be callable', '3Call other agents', '4Ready'])
    expect(nextButton().disabled).toBe(true)

    choose(s.outboundTitle)
    expect(stepLabels()).toEqual(['1What for', '2Call other agents', '3Ready'])

    choose(s.inboundTitle)
    expect(stepLabels()).toEqual(['1What for', '2Be callable', '3Ready'])
  })

  it('needs a token for a network bind, adds a peer, and proves the listener', async () => {
    testMessagingPlatform
      .mockResolvedValueOnce({ message: 'A2A starts with the gateway. Start it, then peers can fetch it.', ok: true })
      .mockResolvedValue({ message: UP, ok: true })
    await renderSteps()

    choose(s.bothTitle)
    await next()

    expect(screen.getByText('http://127.0.0.1:9900/.well-known/agent-card.json')).toBeTruthy()
    await click(s.reachNetwork)
    expect(screen.getByText(s.networkNeedsToken)).toBeTruthy()
    expect(nextButton().disabled).toBe(true)

    await click(s.generateToken)
    const token = (screen.getByLabelText(s.tokenLabel) as HTMLInputElement).value
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    fireEvent.change(screen.getByLabelText(s.publicUrlLabel), { target: { value: 'https://agents.example.com' } })
    expect(screen.getByText('https://agents.example.com/.well-known/agent-card.json')).toBeTruthy()
    await next()

    expect(screen.getByText(s.peersTitle, { selector: 'h2' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText(s.peerNameLabel), { target: { value: 'research-bot' } })
    fireEvent.change(screen.getByLabelText(s.peerUrlLabel), {
      target: { value: 'https://agents.example.com/research' }
    })
    fireEvent.change(screen.getByLabelText(s.peerTokenLabel), { target: { value: 'peer-token' } })
    await click(s.addPeer)
    await settle(50)
    expect(createA2AAgent).toHaveBeenCalledWith(
      { name: 'research-bot', token: 'peer-token', url: 'https://agents.example.com/research' },
      'work'
    )
    expect(screen.getByText(s.peerLine('https://agents.example.com/research', true))).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: s.outboundToggle }))
    })
    await settle(50)
    expect(setToolsetEnabled).toHaveBeenCalledWith('a2a', true, 'work')
    expect(screen.getByText(s.outboundOn)).toBeTruthy()

    await next()
    await settle()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'a2a',
      {
        enabled: true,
        env: { A2A_BEARER_TOKEN: token, A2A_HOST: '0.0.0.0', A2A_PUBLIC_URL: 'https://agents.example.com' }
      },
      'work'
    )
    expect(restartGateway).toHaveBeenCalled()
    expect(testMessagingPlatform).toHaveBeenCalledTimes(2)
    expect(shown(s.checkListener('9900', true))).toBe(true)
    expect(shown('Agent Card at https://agents.example.com/.well-known/agent-card.json')).toBe(true)
    expect(shown(s.checkPeers(1, true))).toBe(true)
    expect(screen.getByText('research-bot', { selector: 'p b' })).toBeTruthy()
  })

  it('needs no token for this machine only', async () => {
    await renderSteps()

    choose(s.inboundTitle)
    await next()
    expect(nextButton().disabled).toBe(false)
    await next()
    await settle()

    expect(updateMessagingPlatform).toHaveBeenCalledWith(
      'a2a',
      { enabled: true, env: { A2A_HOST: '127.0.0.1' } },
      'work'
    )
    expect(screen.getByText(s.tryItCard)).toBeTruthy()
  })

  it('leaves the listener alone when the bot only calls others', async () => {
    peers = [{ capabilities: [], has_auth: false, name: 'planner', timeout: 120, url: 'http://planner.local:9900' }]
    await renderSteps()

    choose(s.outboundTitle)
    await next()
    expect(screen.getByText(s.peerLine('http://planner.local:9900', false))).toBeTruthy()
    await next()
    await settle()

    expect(updateMessagingPlatform).not.toHaveBeenCalled()
    expect(testMessagingPlatform).not.toHaveBeenCalled()
    expect(restartGateway).toHaveBeenCalled()
    expect(shown(s.checkPeers(1, false))).toBe(true)
  })

  it('shows why the peer cannot be added', async () => {
    await renderSteps()

    choose(s.outboundTitle)
    await next()
    await click(s.addPeer)
    expect(screen.getByText(s.peerRequired)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(s.peerNameLabel), { target: { value: 'planner' } })
    fireEvent.change(screen.getByLabelText(s.peerUrlLabel), { target: { value: 'planner.local:9900' } })
    await click(s.addPeer)
    expect(screen.getByText(en.messaging.envErrors.a2aPublicUrl('planner.local:9900'))).toBeTruthy()
    expect(createA2AAgent).not.toHaveBeenCalled()
  })
})
