import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  $desktopOnboarding,
  cancelOnboardingFlow,
  type DesktopOnboardingState,
  type OnboardingContext
} from '@/store/onboarding'
import { makeOAuthProvider } from '@/test/oauth-provider'
import type { OAuthProvider } from '@/types/work4you'

import { DesktopOnboardingOverlay, Picker } from '.'

function setProviders(providers: OAuthProvider[], patch: Partial<DesktopOnboardingState> = {}) {
  $desktopOnboarding.set({
    configured: false,
    flow: { status: 'idle' },
    mode: 'oauth',
    providers,
    reason: null,
    requested: false,
    firstRunSkipped: false,
    manual: false,
    localEndpoint: false,
    reauth: false,
    ...patch
  } satisfies DesktopOnboardingState)
}

const ctx: OnboardingContext = { requestGateway: async () => undefined as never }

afterEach(() => {
  try {
    cancelOnboardingFlow()
  } finally {
    cleanup()
  }

  try {
    window.localStorage.clear()
  } catch {
    // jsdom localStorage should always be present; ignore if not.
  }

  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('onboarding')
    window.history.replaceState(window.history.state, '', url)
  } catch {
    // jsdom location should always be present; ignore if not.
  }

  $desktopOnboarding.set({
    configured: null,
    flow: { status: 'idle' },
    mode: 'oauth',
    providers: null,
    reason: null,
    requested: false,
    firstRunSkipped: false,
    manual: false,
    localEndpoint: false,
    reauth: false
  })
})

describe('onboarding Picker', () => {
  it('first-run offers only Get started — no labs, API key, or skip', () => {
    setProviders([makeOAuthProvider('anthropic', 'Anthropic Claude'), makeOAuthProvider('work4you', 'Work4You Portal')])
    render(<Picker ctx={ctx} />)

    expect(screen.getByRole('heading', { name: 'Work4You Desktop' })).toBeTruthy()
    expect(screen.getByText('The fastest way to start chatting.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy()
    expect(document.querySelector('img[src*="work4you-icon.png"]')).toBeTruthy()
    expect(screen.queryByText('Work4You Portal')).toBeNull()
    expect(screen.queryByText('Recommended')).toBeNull()
    expect(screen.queryByText(/300\+ frontier models/)).toBeNull()
    expect(screen.queryByText('Fireworks AI')).toBeNull()
    expect(screen.queryByText('Anthropic API Key')).toBeNull()
    expect(screen.queryByText('OpenRouter')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Other providers' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'I have an API key' })).toBeNull()
    expect(screen.queryByRole('button', { name: "I'll choose a provider later" })).toBeNull()
  })

  it('Portal reauth offers continue, not Recommended or a BrandMark in the control', () => {
    setProviders([makeOAuthProvider('work4you', 'Work4You Portal')], { reauth: true })
    render(<Picker ctx={ctx} />)

    const continueRow = screen.getByRole('button', { name: /Continue with Work4You Portal/ })
    expect(continueRow).toBeTruthy()
    expect(continueRow.querySelector('img')).toBeNull()
    expect(screen.getByText('Opens your browser')).toBeTruthy()
    expect(screen.queryByText('Recommended')).toBeNull()
    expect(screen.queryByText(/300\+ frontier models/)).toBeNull()
    expect(screen.queryByText('Fireworks AI')).toBeNull()
    expect(screen.queryByRole('button', { name: 'I have an API key' })).toBeNull()
    expect(screen.queryByRole('button', { name: "I'll choose a provider later" })).toBeNull()
  })

  it('first-run still offers only Portal when the catalog omitted it', () => {
    setProviders([
      makeOAuthProvider('anthropic', 'Anthropic Claude'),
      makeOAuthProvider('openai-codex', 'OpenAI Codex / ChatGPT')
    ])
    render(<Picker ctx={ctx} />)

    expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy()
    expect(screen.queryByText('Work4You Portal')).toBeNull()
    expect(screen.queryByText('Recommended')).toBeNull()
    expect(screen.queryByText('Fireworks AI')).toBeNull()
    expect(screen.queryByText('Anthropic API Key')).toBeNull()
    expect(screen.queryByText('ChatGPT or Codex Subscription')).toBeNull()
    expect(screen.queryByRole('button', { name: 'I have an API key' })).toBeNull()
    expect(screen.queryByRole('button', { name: "I'll choose a provider later" })).toBeNull()
  })

  it('manual mode keeps labs, keys, and the other-providers disclosure', () => {
    setProviders(
      [makeOAuthProvider('anthropic', 'Anthropic Claude'), makeOAuthProvider('work4you', 'Work4You Portal')],
      { manual: true }
    )
    render(<Picker ctx={ctx} />)

    expect(screen.getByText('Work4You Portal')).toBeTruthy()
    expect(screen.queryByText('Fireworks AI')).toBeNull()
    expect(screen.queryByText('Anthropic API Key')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Other providers' }))

    expect(screen.getByText('Fireworks AI')).toBeTruthy()
    expect(screen.getByText('Anthropic API Key')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I have an API key' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: "I'll choose a provider later" })).toBeNull()
  })

  it('shows Fireworks first in the expanded manual list, ahead of other OAuth providers', () => {
    setProviders(
      [
        makeOAuthProvider('openai-codex', 'OpenAI Codex / ChatGPT'),
        makeOAuthProvider('minimax-oauth', 'MiniMax'),
        makeOAuthProvider('work4you', 'Work4You Portal')
      ],
      { manual: true }
    )
    render(<Picker ctx={ctx} />)
    fireEvent.click(screen.getByRole('button', { name: 'Other providers' }))

    const labels = screen
      .getAllByRole('button')
      .map(el => el.textContent ?? '')
      .filter(text => /Work4You Portal|Fireworks AI|ChatGPT or Codex|MiniMax|OpenRouter/.test(text))

    const indexOf = (needle: string) => labels.findIndex(text => text.includes(needle))
    expect(indexOf('Work4You Portal')).toBeGreaterThanOrEqual(0)
    expect(indexOf('Fireworks AI')).toBeGreaterThan(indexOf('Work4You Portal'))
    expect(indexOf('ChatGPT or Codex')).toBeGreaterThan(indexOf('Fireworks AI'))
    expect(indexOf('MiniMax')).toBeGreaterThan(indexOf('ChatGPT or Codex'))
  })

  it('shows every provider directly in manual mode when Work4You Portal is absent', () => {
    setProviders(
      [makeOAuthProvider('anthropic', 'Anthropic Claude'), makeOAuthProvider('openai-codex', 'OpenAI Codex / ChatGPT')],
      { manual: true }
    )
    render(<Picker ctx={ctx} />)

    expect(screen.getByText('Fireworks AI')).toBeTruthy()
    expect(screen.getByText('Anthropic API Key')).toBeTruthy()
    expect(screen.getByText('ChatGPT or Codex Subscription')).toBeTruthy()
    expect(screen.queryByText('Other sign-in options')).toBeNull()
    expect(screen.queryByText('Recommended')).toBeNull()
  })

  it('preview picker seeds login instead of starting OAuth', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search: '?onboarding=1' }
    })

    try {
      setProviders([makeOAuthProvider('work4you', 'Work4You Portal')])
      render(<Picker ctx={ctx} />)
      fireEvent.click(screen.getByRole('button', { name: 'Get started' }))

      expect($desktopOnboarding.get().flow.status).toBe('awaiting_user')
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })

      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('onboarding')
        window.history.replaceState(window.history.state, '', url)
      } catch {
        // ignore
      }
    }
  })
})

describe('DesktopOnboardingOverlay reauth chrome', () => {
  const requestGateway: OnboardingContext['requestGateway'] = async () => undefined as never

  it('shows Sign in to continue and hides the technical banner', () => {
    setProviders([makeOAuthProvider('work4you', 'Work4You Portal')], {
      configured: false,
      reauth: true,
      reason:
        'No access token found for Work4You Portal login. setup.status reports configured credentials, but runtime resolution still failed.'
    })
    render(<DesktopOnboardingOverlay enabled={false} profile="default" requestGateway={requestGateway} />)

    expect(screen.getByText('Sign in to continue')).toBeTruthy()
    expect(screen.getByText('Your Work4You Portal session expired. Sign in again to keep chatting.')).toBeTruthy()
    expect(screen.queryByText(/setup.status/)).toBeNull()
    expect(screen.queryByText(/No access token found/)).toBeNull()
    expect(screen.queryByText("Let's get you setup with Work4You")).toBeNull()
  })

  it('hides a Portal token banner even before the reauth flag is set', () => {
    setProviders([makeOAuthProvider('work4you', 'Work4You Portal')], {
      configured: false,
      reauth: false,
      reason:
        'No access token found for Work4You Portal login. setup.status reports configured credentials, but runtime resolution still failed.'
    })
    render(<DesktopOnboardingOverlay enabled={false} profile="default" requestGateway={requestGateway} />)

    expect(screen.queryByText(/setup.status/)).toBeNull()
    expect(screen.getByText("Let's get you setup with Work4You")).toBeTruthy()
  })

  it('keeps first-run preparing header when reauth is false and overlay is not ready', () => {
    setProviders([makeOAuthProvider('work4you', 'Work4You Portal')], { configured: false, reauth: false })
    render(<DesktopOnboardingOverlay enabled={false} profile="default" requestGateway={requestGateway} />)

    expect(screen.getByText("Let's get you setup with Work4You")).toBeTruthy()
    expect(screen.getByText(/300\+ frontier models/)).toBeTruthy()
    expect(screen.queryByText('Sign in to continue')).toBeNull()
  })

  it('keeps a waiting panel after authorize instead of Get started', () => {
    const portal = makeOAuthProvider('work4you', 'Work4You Portal')
    setProviders([portal], {
      configured: false,
      flow: { provider: portal, status: 'success' }
    })
    render(<DesktopOnboardingOverlay enabled profile="default" requestGateway={requestGateway} />)

    expect(screen.queryByRole('button', { name: 'Get started' })).toBeNull()
    expect(screen.getByText('Work4You Portal connected. Picking a default model...')).toBeTruthy()
  })

  it('keeps the device-code waiting panel while Portal poll is in flight', () => {
    const portal = makeOAuthProvider('work4you', 'Work4You Portal')
    setProviders([portal], {
      configured: false,
      flow: {
        copied: false,
        provider: { ...portal, flow: 'device_code' },
        start: {
          expires_in: 600,
          flow: 'device_code',
          poll_interval: 5,
          session_id: 'device-session',
          user_code: '5X63-ZPDL',
          verification_url: 'https://portal.work4you.ai/device?user_code=5X63-ZPDL'
        },
        status: 'polling'
      }
    })
    render(<DesktopOnboardingOverlay enabled profile="default" requestGateway={requestGateway} />)

    expect(screen.queryByRole('button', { name: 'Get started' })).toBeNull()
    expect(screen.getByText('Waiting for you to authorize...')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('X')).toBeTruthy()
  })

  it('does not mint a second device code when Get started is clicked twice', async () => {
    let releaseStart: ((value: unknown) => void) | undefined
    const started = new Promise(resolve => {
      releaseStart = resolve
    })
    const startCalls: string[] = []

    Object.defineProperty(window, 'work4youDesktop', {
      configurable: true,
      value: {
        api: async ({ path }: { path: string }) => {
          if (path === '/api/providers/oauth/work4you/start') {
            startCalls.push(path)
            await started
            return {
              expires_in: 600,
              flow: 'device_code',
              poll_interval: 5,
              session_id: 'device-session',
              user_code: '5X63-ZPDL',
              verification_url: 'https://portal.work4you.ai/device?user_code=5X63-ZPDL'
            }
          }

          if (path.includes('/poll/')) {
            return { status: 'pending' }
          }

          throw new Error(`unexpected api path: ${path}`)
        },
        openExternal: async () => undefined
      }
    })

    const portal = { ...makeOAuthProvider('work4you', 'Work4You Portal'), flow: 'device_code' as const }
    setProviders([portal], { configured: false })

    const requestGateway: OnboardingContext['requestGateway'] = async method => {
      if (method === 'setup.status') {
        return { provider_configured: false } as never
      }

      if (method === 'setup.runtime_check') {
        return { ok: false, error: 'No usable credentials found.' } as never
      }

      throw new Error(`unexpected gateway method: ${method}`)
    }

    render(<DesktopOnboardingOverlay enabled profile="default" requestGateway={requestGateway} />)

    const getStarted = await waitFor(() => screen.getByRole('button', { name: 'Get started' }))
    await act(async () => {
      getStarted.click()
      getStarted.click()
    })

    expect(startCalls).toHaveLength(1)
    expect($desktopOnboarding.get().flow.status).toBe('starting')

    releaseStart?.(undefined)

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Get started' })).toBeNull())
    expect($desktopOnboarding.get().flow.status).toBe('polling')
    expect(startCalls).toHaveLength(1)
    expect(screen.getByText('Waiting for you to authorize...')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('X')).toBeTruthy()
  })

  it('first-run overlay is a full-bleed Get started door', async () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search: '?onboarding=1' }
    })

    try {
      render(<DesktopOnboardingOverlay enabled={false} profile="default" requestGateway={requestGateway} />)

      await waitFor(() => expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy())
      expect(screen.getByRole('heading', { name: 'Work4You Desktop' })).toBeTruthy()
      expect(screen.getByText('The fastest way to start chatting.')).toBeTruthy()
      expect(screen.queryByText("Let's get you setup with Work4You")).toBeNull()
      expect(screen.queryByText('Recommended')).toBeNull()
      expect(screen.queryByText('Work4You Portal')).toBeNull()
      expect(screen.queryByText('Sign in to continue')).toBeNull()
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })

      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('onboarding')
        window.history.replaceState(window.history.state, '', url)
      } catch {
        // ignore
      }
    }
  })
})
