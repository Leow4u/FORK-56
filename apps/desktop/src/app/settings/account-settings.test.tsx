import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PortalAccountIdentity } from '@/types/work4you'

const api = vi.hoisted(() => ({
  disconnect: vi.fn(async (providerId: string) => ({ ok: true, provider: providerId })),
  read: vi.fn<() => Promise<PortalAccountIdentity>>(),
  refresh: vi.fn<() => Promise<PortalAccountIdentity>>()
}))

const onboarding = vi.hoisted(() => ({
  request: vi.fn(),
  signIn: vi.fn()
}))

const notify = vi.hoisted(() => vi.fn())
const openExternalLink = vi.hoisted(() => vi.fn())

vi.mock('@/work4you', () => ({
  disconnectOAuthProvider: (providerId: string) => api.disconnect(providerId),
  getPortalAccount: () => api.read(),
  listOAuthProviders: vi.fn(async () => ({ providers: [] })),
  refreshPortalAccount: () => api.refresh()
}))

vi.mock('@/store/onboarding', () => ({
  $desktopOnboarding: atom({ manual: false }),
  requestDesktopOnboarding: () => onboarding.request(),
  startManualProviderOAuth: (providerId: string) => onboarding.signIn(providerId)
}))

vi.mock('@/store/notifications', () => ({
  notify: (...args: unknown[]) => notify(...args),
  notifyError: vi.fn()
}))

vi.mock('@/lib/external-link', () => ({
  openExternalLink: (url: string) => openExternalLink(url)
}))

import { PORTAL_ACCOUNT_CHANGED } from '@/app/chat/sidebar/portal-session'

import { AccountSettings } from './account-settings'

const SIGNED_IN: PortalAccountIdentity = {
  email: 'leo@work4you.ai',
  first_name: 'Leonardo',
  last_name: 'Duarte',
  logged_in: true,
  name: 'Leonardo Duarte',
  portal_url: 'https://portal.example.test/'
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  delete (window as unknown as { work4youDesktop?: unknown }).work4youDesktop
})

function installSave(result: { ok: true; firstName: string; lastName: string } | { ok: false; error: string }) {
  const saveAccountProfile = vi.fn(async () => result)
  const logout = vi.fn(async () => ({ ok: true, portalBaseUrl: 'https://portal.example.test', signedIn: false }))

  const desktop = window as unknown as {
    work4youDesktop?: { cloud: { logout: typeof logout; saveAccountProfile: typeof saveAccountProfile } }
  }

  desktop.work4youDesktop = {
    cloud: { logout, saveAccountProfile }
  }

  return saveAccountProfile
}

describe('Account settings', () => {
  it('shows the cadastro and opens linked accounts on the portal', async () => {
    api.read.mockResolvedValue(SIGNED_IN)
    installSave({ ok: true, firstName: 'Leonardo', lastName: 'Duarte' })

    render(<AccountSettings />)

    expect(await screen.findByRole('heading', { name: 'Account' })).toBeTruthy()
    expect(screen.getByText('The person signed in to Work4You.')).toBeTruthy()
    expect(screen.getByText('leo@work4you.ai', { selector: 'span' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'First name' })).toHaveProperty('value', 'Leonardo')
    expect(screen.getByRole('textbox', { name: 'Last name' })).toHaveProperty('value', 'Duarte')
    expect(screen.getByText('LD')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Manage' }))

    expect(openExternalLink).toHaveBeenCalledWith('https://portal.example.test/orgs/personal/settings')
  })

  it('saves both names and tells the account menu to re-read', async () => {
    api.read.mockResolvedValue(SIGNED_IN)
    api.refresh.mockResolvedValue({ ...SIGNED_IN, first_name: 'Leo', name: 'Leo Duarte' })
    const saveAccountProfile = installSave({ ok: true, firstName: 'Leo', lastName: 'Duarte' })
    const changed = vi.fn()
    window.addEventListener(PORTAL_ACCOUNT_CHANGED, changed)

    render(<AccountSettings />)
    fireEvent.change(await screen.findByRole('textbox', { name: 'First name' }), { target: { value: ' Leo ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))

    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success', message: 'Name saved.' }))
    })
    expect(saveAccountProfile).toHaveBeenCalledWith({ firstName: 'Leo', lastName: 'Duarte' })
    expect(api.refresh).toHaveBeenCalled()
    expect(changed).toHaveBeenCalled()

    window.removeEventListener(PORTAL_ACCOUNT_CHANGED, changed)
  })

  it('asks for another sign-in when the portal cookie cannot save', async () => {
    api.read.mockResolvedValue(SIGNED_IN)
    installSave({ ok: false, error: 'unauthorized' })

    render(<AccountSettings />)
    fireEvent.click(await screen.findByRole('button', { name: 'Save name' }))

    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Sign in again to save your name.' }))
    })
    expect(api.refresh).not.toHaveBeenCalled()
  })

  it('keeps Save name off until both parts are filled', async () => {
    api.read.mockResolvedValue({ ...SIGNED_IN, first_name: null, last_name: null, name: null })
    installSave({ ok: true, firstName: 'Leonardo', lastName: 'Duarte' })

    render(<AccountSettings />)

    expect(await screen.findByRole('button', { name: 'Save name' })).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Last name' }), { target: { value: 'Duarte' } })
    expect(screen.getByRole('button', { name: 'Save name' })).toHaveProperty('disabled', true)
  })

  it('signs out through the same portal door as the account menu', async () => {
    api.read.mockResolvedValue(SIGNED_IN)
    installSave({ ok: true, firstName: 'Leonardo', lastName: 'Duarte' })

    render(<AccountSettings />)
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('button', { name: /Work4You Portal/ })).toBeTruthy()
    expect(api.disconnect).toHaveBeenCalledWith('work4you')
    expect(onboarding.request).toHaveBeenCalled()
  })

  it('offers portal sign-in when nobody is logged in', async () => {
    api.read.mockResolvedValue({ email: null, logged_in: false, name: null })

    render(<AccountSettings />)

    expect(await screen.findByRole('button', { name: /Work4You Portal/ })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'First name' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull()
  })
})
