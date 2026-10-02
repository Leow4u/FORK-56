import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  $desktopOnboarding,
  cancelOnboardingFlow,
  type DesktopOnboardingState,
  type OnboardingContext,
  type ProfileSetupState
} from '@/store/onboarding'
import { $profiles } from '@/store/profile'
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
    profileSetup: null,
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
    reauth: false,
    profileSetup: null
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

  it('Portal reauth uses the same Get started door as first run', () => {
    setProviders([makeOAuthProvider('work4you', 'Work4You Portal')], { reauth: true })
    render(<Picker ctx={ctx} />)

    expect(screen.getByRole('heading', { name: 'Work4You Desktop' })).toBeTruthy()
    expect(screen.getByText('The fastest way to start chatting.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy()
    expect(screen.queryByText('Sign in to continue')).toBeNull()
    expect(screen.queryByText(/session expired/i)).toBeNull()
    expect(screen.queryByText('Continue with Work4You Portal')).toBeNull()
    expect(screen.queryByText('Opens your browser')).toBeNull()
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

  it('uses the first-run welcome after Portal sign-out and hides the technical banner', () => {
    setProviders([makeOAuthProvider('work4you', 'Work4You Portal')], {
      configured: false,
      reauth: true,
      reason:
        'No access token found for Work4You Portal login. setup.status reports configured credentials, but runtime resolution still failed.'
    })
    render(<DesktopOnboardingOverlay enabled profile="default" requestGateway={requestGateway} />)

    expect(screen.getByRole('heading', { name: 'Work4You Desktop' })).toBeTruthy()
    expect(screen.getByText('The fastest way to start chatting.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy()
    expect(screen.queryByText('Sign in to continue')).toBeNull()
    expect(screen.queryByText(/session expired/i)).toBeNull()
    expect(screen.queryByText('Continue with Work4You Portal')).toBeNull()
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
    expect(screen.queryByText("Let's get you setup with Work4You")).toBeNull()
    expect(screen.queryByText('Starting Work4You…')).toBeNull()
    expect(document.querySelector('img[src*="work4you-icon.png"]')).toBeTruthy()
  })

  it('shows only the mark while the gateway is still starting', () => {
    setProviders([makeOAuthProvider('work4you', 'Work4You Portal')], { configured: false, reauth: false })
    render(<DesktopOnboardingOverlay enabled={false} profile="default" requestGateway={requestGateway} />)

    expect(document.querySelector('img[src*="work4you-icon.png"]')).toBeTruthy()
    expect(screen.queryByText("Let's get you setup with Work4You")).toBeNull()
    expect(screen.queryByText('Starting Work4You…')).toBeNull()
    expect(screen.queryByText(/Waiting for Work4You backend/)).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(/300\+ frontier models/)).toBeNull()
    expect(screen.queryByText('Sign in to continue')).toBeNull()
  })

  it('drops the gate after authorize instead of a model-picking screen', () => {
    const portal = makeOAuthProvider('work4you', 'Work4You Portal')
    setProviders([portal], {
      configured: false,
      flow: { provider: portal, status: 'success' }
    })
    render(<DesktopOnboardingOverlay enabled profile="default" requestGateway={requestGateway} />)

    expect(screen.queryByRole('button', { name: 'Get started' })).toBeNull()
    expect(screen.queryByText('Work4You Portal connected. Picking a default model...')).toBeNull()
    expect(screen.queryByText('Finish in your browser.')).toBeNull()
  })

  it('keeps one browser wait while Portal poll is in flight', () => {
    const portal = makeOAuthProvider('work4you', 'Work4You Portal')
    const openExternal = vi.fn(async () => undefined)
    Object.defineProperty(window, 'work4youDesktop', {
      configurable: true,
      value: { openExternal }
    })
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
    expect(screen.getByRole('heading', { name: 'Work4You Desktop' })).toBeTruthy()
    expect(screen.getByText('Finish in your browser.')).toBeTruthy()
    expect(screen.queryByText('Waiting for you to authorize...')).toBeNull()
    expect(screen.queryByText('5')).toBeNull()
    expect(screen.queryByText('X')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(openExternal).toHaveBeenCalledWith('https://portal.work4you.ai/device?user_code=5X63-ZPDL')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect($desktopOnboarding.get().flow.status).toBe('idle')
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
    expect(screen.getByText('Finish in your browser.')).toBeTruthy()
    expect(screen.queryByText(/Starting sign-in/)).toBeNull()

    releaseStart?.(undefined)

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Get started' })).toBeNull())
    expect($desktopOnboarding.get().flow.status).toBe('polling')
    expect(startCalls).toHaveLength(1)
    expect(screen.getByText('Finish in your browser.')).toBeTruthy()
    expect(screen.queryByText('Waiting for you to authorize...')).toBeNull()
    expect(screen.queryByText('5')).toBeNull()
    expect(screen.queryByText('X')).toBeNull()
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

describe('DesktopOnboardingOverlay profile setup', () => {
  const requestGateway: OnboardingContext['requestGateway'] = async () => undefined as never
  const portal = makeOAuthProvider('work4you', 'Work4You Portal')
  const signedInPortal: OAuthProvider = { ...portal, status: { logged_in: true } }

  // What the live profile's backend answers while the panel is up: its OAuth
  // catalog (the overlay refreshes it on mount) and, for the adopt path, the
  // recommended-model lookup.
  let catalog: OAuthProvider[] = []
  let recommended: () => Promise<unknown> = async () => ({ provider: 'work4you', model: '', free_tier: null })

  const profileSetup = (patch: Partial<ProfileSetupState> = {}): ProfileSetupState => ({
    profile: 'research',
    reason: "No API key configured for provider 'openrouter'. First message will fail.",
    reauth: false,
    pendingPrompt: false,
    adopting: false,
    error: null,
    ...patch
  })

  beforeEach(() => {
    $profiles.set([
      {
        display_name: 'Research',
        has_env: false,
        is_default: false,
        model: null,
        name: 'research',
        path: '/home/u/.work4you/profiles/research',
        provider: null,
        skill_count: 0
      }
    ])
    Object.defineProperty(window, 'work4youDesktop', {
      configurable: true,
      value: {
        api: async ({ path }: { path: string }) => {
          if (path === '/api/providers/oauth') {
            return { providers: catalog }
          }

          if (path.startsWith('/api/model/recommended-default?')) {
            return recommended()
          }

          throw new Error(`unexpected api path: ${path}`)
        }
      }
    })
  })

  afterEach(() => {
    $profiles.set([])
    catalog = []
  })

  it('renders the profile panel on a configured app and adopts the Portal login the root holds', async () => {
    catalog = [signedInPortal]

    recommended = async () => {
      throw new Error('recommended-default is unreachable')
    }

    setProviders([signedInPortal], {
      configured: true,
      requested: true,
      profileSetup: profileSetup({ pendingPrompt: true })
    })
    render(<DesktopOnboardingOverlay enabled profile="research" requestGateway={requestGateway} />)

    expect(screen.getByRole('heading', { name: 'Set up Research' })).toBeTruthy()
    expect(
      screen.getByText('Connect a model provider for this profile. Other profiles stay exactly as they are.')
    ).toBeTruthy()
    expect(
      screen.getByText('Your message is waiting in the composer. Send it again once a provider is connected.')
    ).toBeTruthy()
    expect(screen.getByText('Signed in on this computer')).toBeTruthy()
    expect(screen.getByText('Saved to this profile only.')).toBeTruthy()
    expect(screen.getByRole('button', { name: "I'll choose a provider later" })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Get started' })).toBeNull()
    expect(screen.queryByText("Let's get you setup with Work4You")).toBeNull()
    expect(screen.queryByText('Recommended')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Use for this profile' }))

    // The adopt runs against this profile's backend; its failure stays on the
    // row instead of closing the panel or flipping the app-wide state.
    expect(await screen.findByText('recommended-default is unreachable')).toBeTruthy()
    expect($desktopOnboarding.get()).toMatchObject({ configured: true, requested: true })
    expect($desktopOnboarding.get().profileSetup).toMatchObject({ adopting: false })
    expect(window.localStorage.getItem('work4you-desktop-onboarded-v1')).toBeNull()
  })

  it('offers the Portal sign-in row when the root is not signed in', async () => {
    catalog = [portal]
    setProviders([portal], { configured: true, requested: true, profileSetup: profileSetup() })
    render(<DesktopOnboardingOverlay enabled profile="research" requestGateway={requestGateway} />)

    expect(screen.getByRole('heading', { name: 'Set up Research' })).toBeTruthy()
    expect(screen.getByText('Work4You Portal')).toBeTruthy()
    expect(screen.getByText('Recommended')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Use for this profile' })).toBeNull()
    expect(screen.queryByText(/waiting in the composer/)).toBeNull()

    // The catalog refresh on mount must not swap the panel for the key form.
    await waitFor(() => expect($desktopOnboarding.get().providers?.length).toBe(1))
    expect(screen.getByText('Work4You Portal')).toBeTruthy()
  })

  it("I'll choose a provider later closes the panel without touching configured", () => {
    catalog = [signedInPortal]
    setProviders([signedInPortal], { configured: true, requested: true, profileSetup: profileSetup() })
    render(<DesktopOnboardingOverlay enabled profile="research" requestGateway={requestGateway} />)

    fireEvent.click(screen.getByRole('button', { name: "I'll choose a provider later" }))

    expect($desktopOnboarding.get()).toMatchObject({ requested: false, profileSetup: null, configured: true })
    expect(screen.queryByRole('heading', { name: 'Set up Research' })).toBeNull()
  })

  it('shows the sign-in-again card for a Portal session failure and can switch to a key', () => {
    catalog = [portal]
    setProviders([portal], { configured: true, requested: true, profileSetup: profileSetup({ reauth: true }) })
    render(<DesktopOnboardingOverlay enabled profile="research" requestGateway={requestGateway} />)

    expect(screen.getByRole('heading', { name: 'Sign in to Work4You again' })).toBeTruthy()
    expect(screen.getByText(/The Work4You sign-in Research relies on has expired/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Set up Research' })).toBeNull()
    expect(screen.queryByText(/No access token/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Use an API key instead' }))

    expect(screen.getByPlaceholderText('Paste API key')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeTruthy()
  })

  it('?onboarding=profile previews the panel with the adopt row', async () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search: '?onboarding=profile' }
    })

    try {
      render(<DesktopOnboardingOverlay enabled={false} profile="default" requestGateway={requestGateway} />)

      await waitFor(() => expect(screen.getByRole('button', { name: 'Use for this profile' })).toBeTruthy())
      expect(screen.getByRole('heading', { name: 'Set up Research' })).toBeTruthy()
      expect(screen.getByText(/waiting in the composer/)).toBeTruthy()
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
