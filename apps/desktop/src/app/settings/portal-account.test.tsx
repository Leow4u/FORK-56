import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OAuthProvider } from '@/types/work4you'

const listOAuthProviders = vi.fn()
const disconnectOAuthProvider = vi.fn()
const startManualProviderOAuth = vi.fn()
const onboarding = atom({ manual: false })

vi.mock('@/work4you', () => ({
  disconnectOAuthProvider: (providerId: string) => disconnectOAuthProvider(providerId),
  listOAuthProviders: () => listOAuthProviders()
}))

vi.mock('@/store/onboarding', () => ({
  $desktopOnboarding: onboarding,
  startManualProviderOAuth: (providerId: string) => startManualProviderOAuth(providerId)
}))

function portal(loggedIn: boolean): OAuthProvider {
  return {
    cli_command: 'work4you login',
    disconnectable: true,
    docs_url: 'https://portal.work4you.ai',
    flow: 'pkce',
    id: 'work4you',
    name: 'Work4You Portal',
    status: { logged_in: loggedIn }
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Portal account', () => {
  it('shows Work4You Portal as connected and hides other accounts', async () => {
    listOAuthProviders.mockResolvedValue({
      providers: [portal(true), { ...portal(false), id: 'minimax-oauth', name: 'MiniMax' }]
    })

    const { PortalAccount } = await import('./portal-account')
    render(<PortalAccount />)

    expect(await screen.findByText('Work4You Portal')).toBeTruthy()
    expect(screen.getByText('Connected')).toBeTruthy()
    expect(screen.queryByText('MiniMax')).toBeNull()
    expect(screen.queryByText('API keys')).toBeNull()
    expect(screen.queryByPlaceholderText('Search providers…')).toBeNull()
  })

  it('offers Portal sign-in when the account is not connected', async () => {
    listOAuthProviders.mockResolvedValue({ providers: [portal(false)] })

    const { PortalAccount } = await import('./portal-account')
    render(<PortalAccount />)

    fireEvent.click(await screen.findByRole('button', { name: /Work4You Portal/ }))

    expect(startManualProviderOAuth).toHaveBeenCalledWith('work4you')
  })
})
