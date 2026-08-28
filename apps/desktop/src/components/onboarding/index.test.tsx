import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { $desktopOnboarding, type DesktopOnboardingState, type OnboardingContext } from '@/store/onboarding'
import { makeOAuthProvider } from '@/test/oauth-provider'
import type { OAuthProvider } from '@/types/work4you'

import { Picker } from '.'

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
    ...patch
  } satisfies DesktopOnboardingState)
}

const ctx: OnboardingContext = { requestGateway: async () => undefined as never }

afterEach(() => {
  cleanup()

  try {
    window.localStorage.clear()
  } catch {
    // jsdom localStorage should always be present; ignore if not.
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
    localEndpoint: false
  })
})

describe('onboarding Picker', () => {
  it('first-run offers only Work4You Portal — no labs, API key, or skip', () => {
    setProviders([makeOAuthProvider('anthropic', 'Anthropic Claude'), makeOAuthProvider('work4you', 'Work4You Portal')])
    render(<Picker ctx={ctx} />)

    expect(screen.getByText('Work4You Portal')).toBeTruthy()
    expect(screen.getByText('Recommended')).toBeTruthy()
    expect(screen.queryByText('Fireworks AI')).toBeNull()
    expect(screen.queryByText('Anthropic API Key')).toBeNull()
    expect(screen.queryByText('OpenRouter')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Other providers' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'I have an API key' })).toBeNull()
    expect(screen.queryByRole('button', { name: "I'll choose a provider later" })).toBeNull()
  })

  it('first-run still offers only Portal when the catalog omitted it', () => {
    setProviders([makeOAuthProvider('anthropic', 'Anthropic Claude'), makeOAuthProvider('openai-codex', 'OpenAI Codex / ChatGPT')])
    render(<Picker ctx={ctx} />)

    expect(screen.getByText('Work4You Portal')).toBeTruthy()
    expect(screen.getByText('Recommended')).toBeTruthy()
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
      [
        makeOAuthProvider('anthropic', 'Anthropic Claude'),
        makeOAuthProvider('openai-codex', 'OpenAI Codex / ChatGPT')
      ],
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
      fireEvent.click(screen.getByRole('button', { name: /Work4You Portal/ }))

      expect($desktopOnboarding.get().flow.status).toBe('awaiting_user')
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    }
  })
})
