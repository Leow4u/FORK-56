import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  $desktopOnboarding,
  clearPendingProfileAdopt,
  dismissProfileSetup,
  peekPendingProfileAdopt,
  requestDesktopOnboardingForCredentialWarning
} from '@/store/onboarding'
import { $activeGatewayProfile, $activeProfile } from '@/store/profile'
import { makeOAuthProvider } from '@/test/oauth-provider'
import type { OAuthProvider } from '@/types/work4you'
import type * as Work4You from '@/work4you'

import { ProfileSetupBanner, useProfileSetupWarning } from './profile-setup-banner'

const catalog = vi.hoisted(() => ({ providers: [] as OAuthProvider[], calls: 0 }))

vi.mock('@/work4you', async importOriginal => ({
  ...(await importOriginal<typeof Work4You>()),
  listOAuthProviders: async () => {
    catalog.calls += 1

    return { providers: catalog.providers }
  }
}))

const WARNING = "No API key configured for provider 'openrouter'. First message will fail."

function Harness() {
  const warning = useProfileSetupWarning()

  return warning ? <ProfileSetupBanner warning={warning} /> : <span>no banner</span>
}

function renderHarness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  )
}

const signedInPortal = () => ({ ...makeOAuthProvider('work4you', 'Work4You Portal'), status: { logged_in: true } })

describe('ProfileSetupBanner', () => {
  beforeEach(() => {
    catalog.providers = [signedInPortal()]
    catalog.calls = 0
    $activeProfile.set('default')
    $activeGatewayProfile.set('research')
    requestDesktopOnboardingForCredentialWarning(undefined)
    dismissProfileSetup()
    clearPendingProfileAdopt()
  })

  afterEach(() => {
    cleanup()
    requestDesktopOnboardingForCredentialWarning(undefined)
    dismissProfileSetup()
    clearPendingProfileAdopt()
    $activeGatewayProfile.set('default')
    $activeProfile.set('default')
  })

  it('offers the one-click Portal adopt on a secondary profile whose backend sees the root login', async () => {
    requestDesktopOnboardingForCredentialWarning(WARNING)
    renderHarness()

    expect(screen.getByText('This profile has no model provider yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose a provider' })).toBeTruthy()

    const adopt = await screen.findByRole('button', { name: 'Use my Work4You account' })
    fireEvent.click(adopt)

    expect($desktopOnboarding.get().profileSetup?.profile).toBe('research')
    expect(peekPendingProfileAdopt()).toBe(true)
    // The overlay owns the screen now; the row steps aside instead of doubling up.
    expect(screen.getByText('no banner')).toBeTruthy()
  })

  it('opens the profile picker without the adopt hand-off from Choose a provider', () => {
    requestDesktopOnboardingForCredentialWarning(WARNING)
    renderHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Choose a provider' }))

    expect($desktopOnboarding.get().profileSetup?.profile).toBe('research')
    expect(peekPendingProfileAdopt()).toBe(false)
  })

  it('never offers the adopt on the primary profile and does not fetch its catalog', () => {
    $activeGatewayProfile.set('default')
    requestDesktopOnboardingForCredentialWarning(WARNING)
    renderHarness()

    expect(screen.getByRole('button', { name: 'Choose a provider' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Use my Work4You account' })).toBeNull()
    expect(catalog.calls).toBe(0)
  })

  it('stays hidden when the warning belongs to another profile than the live one', () => {
    requestDesktopOnboardingForCredentialWarning(WARNING)
    $activeGatewayProfile.set('default')
    renderHarness()

    expect(screen.getByText('no banner')).toBeTruthy()
  })

  it('dismiss hides the row until a different warning arrives', () => {
    requestDesktopOnboardingForCredentialWarning(WARNING)
    renderHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.getByText('no banner')).toBeTruthy()

    // A heartbeat repeating the same warning does not resurrect it…
    act(() => requestDesktopOnboardingForCredentialWarning(WARNING))
    expect(screen.getByText('no banner')).toBeTruthy()

    // …a new warning does.
    act(() =>
      requestDesktopOnboardingForCredentialWarning(
        "No API key configured for provider 'openai'. First message will fail."
      )
    )
    expect(screen.getByText('This profile has no model provider yet.')).toBeTruthy()
  })
})
