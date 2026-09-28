import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { $desktopOnboarding } from '@/store/onboarding'
import type * as OnboardingStore from '@/store/onboarding'
import {
  $desktopVersion,
  $updateApply,
  $updateOverlayOpen,
  $updateOverlayTarget,
  $updateStatus,
  resetUpdateApplyState
} from '@/store/updates'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'
import type { PortalAccountIdentity } from '@/types/work4you'
import type * as Work4YouApi from '@/work4you'

import { ACCOUNT_CONTACT_URL, ACCOUNT_DOCS_URL, AccountFooter } from './account-footer'

const portal = vi.hoisted(() => ({
  disconnect: vi.fn(async (providerId: string) => ({ ok: true, provider: providerId })),
  read: vi.fn<() => Promise<PortalAccountIdentity>>()
}))

const onboardingDoors = vi.hoisted(() => ({
  request: vi.fn(),
  signIn: vi.fn()
}))

vi.mock('@/work4you', async importOriginal => ({
  ...(await importOriginal<typeof Work4YouApi>()),
  disconnectOAuthProvider: (providerId: string) => portal.disconnect(providerId),
  getPortalAccount: () => portal.read()
}))

vi.mock('@/store/onboarding', async importOriginal => ({
  ...(await importOriginal<typeof OnboardingStore>()),
  requestDesktopOnboarding: (reason?: string) => onboardingDoors.request(reason),
  startManualProviderOAuth: (providerId: string) => onboardingDoors.signIn(providerId)
}))

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

const desktopWindow = window as unknown as { work4youDesktop?: unknown }
const initialDesktop = desktopWindow.work4youDesktop
const initialOnboarding = $desktopOnboarding.get()

afterEach(() => {
  cleanup()
  $desktopVersion.set(null)
  $updateStatus.set(null)
  $updateOverlayOpen.set(false)
  $desktopOnboarding.set(initialOnboarding)
  resetUpdateApplyState()

  if (initialDesktop) {
    desktopWindow.work4youDesktop = initialDesktop
  } else {
    delete desktopWindow.work4youDesktop
  }

  vi.clearAllMocks()
  vi.restoreAllMocks()
})

function signedIn(identity: { email?: null | string; name?: null | string } = {}): PortalAccountIdentity {
  return { email: identity.email ?? null, logged_in: true, name: identity.name ?? null }
}

const SIGNED_OUT: PortalAccountIdentity = { email: null, logged_in: false, name: null }

// The account menu reads the Portal login the agent runs on. The desktop
// bridge carries only what the menu opens (links, HUD, updates) and the old
// app-window session that Log Out also clears — never the identity.
function installAccount(identity: PortalAccountIdentity) {
  portal.read.mockResolvedValue(identity)

  const logout = vi.fn(async () => ({ ok: true, portalBaseUrl: 'https://portal.example', signedIn: false }))
  const openExternal = vi.fn(async () => undefined)

  desktopWindow.work4youDesktop = { cloud: { logout }, openExternal }

  return { logout, openExternal }
}

async function settleReads() {
  await act(async () => {
    await Promise.all(portal.read.mock.results.map(result => result.value).filter(Boolean))
  })
}

async function openMenu(triggerName: string) {
  const trigger = await screen.findByRole('button', { name: triggerName })

  fireEvent.pointerDown(trigger, { button: 0 })

  return trigger
}

// Records where the footer's actions navigate to, so the tests assert the
// REAL router outcome instead of a mocked callback.
function LocationProbe() {
  const location = useLocation()

  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderFooter() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route
          element={
            <>
              <AccountFooter />
              <LocationProbe />
            </>
          }
          path="*"
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('AccountFooter', () => {
  it('shows the cadastro name from the agent login with no app-window session', async () => {
    portal.read.mockResolvedValue(signedIn({ email: 'ada@example.com', name: 'Ada Lovelace' }))
    // No `cloud` bridge at all: the one first-run login is enough.
    desktopWindow.work4youDesktop = { openExternal: vi.fn(async () => undefined) }

    renderFooter()

    const trigger = await screen.findByRole('button', { name: 'Ada Lovelace' })
    expect(trigger.querySelector('[data-slot="account-footer-mark"]')?.textContent).toBe('AL')
    expect(screen.queryByRole('button', { name: 'ada@example.com' })).toBeNull()
  })

  it('shows the Portal email and a full account menu including Log Out', async () => {
    installAccount(signedIn({ email: 'user@example.com' }))

    renderFooter()

    const trigger = await screen.findByRole('button', { name: 'user@example.com' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('title')).toBeNull()
    expect(trigger.querySelector('[data-slot="account-footer-mark"]')?.getAttribute('aria-hidden')).toBe('true')
    expect(trigger.querySelector('[data-slot="account-footer-mark"]')?.textContent).toBe('US')

    fireEvent.pointerDown(trigger, { button: 0 })

    const menu = await screen.findByRole('menu')

    expect(menu.getAttribute('data-composer-menu')).toBe('')
    expect(menu.getAttribute('data-side')).toBe('top')
    expect(menu.className).toContain('shadow-work4you')
    expect(await screen.findByRole('menuitem', { name: /^settings$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^docs$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^shortcuts$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^contact us$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^log out$/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^sign in$/i })).toBeNull()
  })

  it('navigates to Settings from the account menu', async () => {
    installAccount(signedIn({ email: 'user@example.com' }))

    renderFooter()
    await openMenu('user@example.com')

    fireEvent.click(await screen.findByRole('menuitem', { name: /^settings$/i }))
    expect(screen.getByTestId('location').textContent).toBe('/settings')
  })

  it('opens HUD mode from the account menu', async () => {
    const open = vi.fn(async () => undefined)

    installAccount(SIGNED_OUT)
    ;(desktopWindow.work4youDesktop as { hud: { open: typeof open } }).hud = { open }

    renderFooter()
    await openMenu('Account')

    fireEvent.click(await screen.findByRole('menuitem', { name: /^hud mode$/i }))

    expect(open).toHaveBeenCalledWith(expect.objectContaining({ sessionId: null }))
  })

  it('navigates to Keyboard shortcuts from the account menu', async () => {
    installAccount(signedIn({ email: 'user@example.com' }))

    renderFooter()
    await openMenu('user@example.com')

    fireEvent.click(await screen.findByRole('menuitem', { name: /^shortcuts$/i }))
    expect(screen.getByTestId('location').textContent).toBe('/settings?tab=keybinds')
  })

  it('opens Docs and Contact Us in the system browser', async () => {
    const { openExternal } = installAccount(signedIn({ email: 'user@example.com' }))

    renderFooter()
    await openMenu('user@example.com')

    fireEvent.click(await screen.findByRole('menuitem', { name: /^docs$/i }))
    expect(openExternal).toHaveBeenCalledWith(ACCOUNT_DOCS_URL)

    await openMenu('user@example.com')
    fireEvent.click(await screen.findByRole('menuitem', { name: /^contact us$/i }))
    expect(openExternal).toHaveBeenCalledWith(ACCOUNT_CONTACT_URL)
  })

  it('Log Out removes the one Portal login and shows the sign-in screen', async () => {
    const { logout } = installAccount(signedIn({ email: 'user@example.com' }))

    renderFooter()
    await openMenu('user@example.com')

    portal.read.mockResolvedValue(SIGNED_OUT)
    fireEvent.click(await screen.findByRole('menuitem', { name: /^log out$/i }))

    expect(await screen.findByRole('button', { name: 'Account' })).toBeTruthy()
    expect(portal.disconnect).toHaveBeenCalledWith('work4you')
    expect(logout).toHaveBeenCalledTimes(1)
    expect(onboardingDoors.request).toHaveBeenCalledTimes(1)

    await openMenu('Account')
    expect(await screen.findByRole('menuitem', { name: /^sign in$/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^log out$/i })).toBeNull()
  })

  it('keeps the account when the Portal refuses Log Out', async () => {
    installAccount(signedIn({ email: 'user@example.com' }))
    portal.disconnect.mockRejectedValueOnce(new Error('backend unreachable'))

    renderFooter()
    await openMenu('user@example.com')

    fireEvent.click(await screen.findByRole('menuitem', { name: /^log out$/i }))

    await vi.waitFor(() => {
      expect(portal.disconnect).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('button', { name: 'user@example.com' })).toBeTruthy()
    expect(onboardingDoors.request).not.toHaveBeenCalled()
  })

  it('never repaints the old identity from a read that started before Log Out', async () => {
    installAccount(signedIn({ email: 'user@example.com' }))

    renderFooter()
    await openMenu('user@example.com')

    // A focus read goes out, then Log Out finishes before it answers.
    let answerLateRead: (identity: PortalAccountIdentity) => void = () => undefined
    portal.read.mockImplementationOnce(() => new Promise(resolve => (answerLateRead = resolve)))
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    fireEvent.click(await screen.findByRole('menuitem', { name: /^log out$/i }))
    expect(await screen.findByRole('button', { name: 'Account' })).toBeTruthy()

    await act(async () => {
      answerLateRead(signedIn({ email: 'user@example.com' }))
    })

    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'user@example.com' })).toBeNull()
  })

  it('offers Sign in when signed out, through the same first-run Portal door', async () => {
    installAccount(SIGNED_OUT)

    renderFooter()
    await settleReads()

    const trigger = screen.getByRole('button', { name: 'Account' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')

    fireEvent.pointerDown(trigger, { button: 0 })

    expect(await screen.findByRole('menuitem', { name: /^settings$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^docs$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^shortcuts$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^contact us$/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^log out$/i })).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: /^sign in$/i }))

    expect(onboardingDoors.signIn).toHaveBeenCalledWith('work4you')
  })

  it('keeps Log Out for a signed-in login whose name and email did not load', async () => {
    installAccount(signedIn())

    renderFooter()
    await settleReads()

    const trigger = screen.getByRole('button', { name: 'Account' })
    expect(trigger.querySelector('[data-slot="account-footer-mark"]')?.textContent).toBe('A')

    await openMenu('Account')
    expect(await screen.findByRole('menuitem', { name: /^log out$/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^sign in$/i })).toBeNull()
  })

  it('keeps the account menu when the backend cannot answer (web / tests)', async () => {
    delete desktopWindow.work4youDesktop
    portal.read.mockRejectedValue(new Error('no desktop bridge'))

    renderFooter()

    await openMenu('Account')
    expect(screen.getByRole('menuitem', { name: /^settings$/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^log out$/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /^sign in$/i })).toBeNull()
  })

  it('keeps the update chip off when the client is current', async () => {
    installAccount(SIGNED_OUT)
    $desktopVersion.set({
      appVersion: '0.20.4',
      electronVersion: '1',
      nodeVersion: '1',
      platform: 'linux',
      work4youRoot: '/tmp'
    })
    $updateStatus.set({ behind: 0, fetchedAt: 0, supported: true, updateAvailable: false })

    renderFooter()

    expect(await screen.findByRole('button', { name: 'Account' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull()

    await openMenu('Account')
    const version = await screen.findByText('Work4You 0.20.4')
    expect(version.getAttribute('data-slot')).toBe('account-menu-version')
    expect(screen.queryByRole('menuitem', { name: /Work4You 0\.20\.4/ })).toBeNull()
  })

  it('starts the existing apply from the Account chip, same as Update now', async () => {
    installAccount(SIGNED_OUT)
    const apply = vi.fn(async () => ({ handedOff: true, ok: true }))
    desktopWindow.work4youDesktop = {
      ...(desktopWindow.work4youDesktop as object),
      updates: { apply, check: vi.fn() }
    }
    $updateStatus.set({
      behind: 3,
      currentSha: '7d2ca4bdeadbeef',
      fetchedAt: 0,
      supported: true
    })

    renderFooter()

    expect(await screen.findByRole('button', { name: 'Account' })).toBeTruthy()

    const chip = screen.getByRole('button', { name: 'Update' })

    expect(chip.textContent).toMatch(/update/i)
    expect(chip.textContent).not.toMatch(/0\.20\.4/i)
    expect(chip.textContent).not.toMatch(/7d2ca4b/i)

    fireEvent.click(chip)

    expect($updateOverlayOpen.get()).toBe(true)
    expect($updateOverlayTarget.get()).toBe('client')
    await vi.waitFor(() => {
      expect(apply).toHaveBeenCalled()
    })
    expect($updateApply.get().applying).toBe(true)
  })

  it('shows prefetch percent on the Account chip and does not apply until Stage A is ready', async () => {
    installAccount(SIGNED_OUT)
    const apply = vi.fn(async () => ({ handedOff: true, ok: true }))
    desktopWindow.work4youDesktop = {
      ...(desktopWindow.work4youDesktop as object),
      updates: { apply, check: vi.fn() }
    }
    $updateStatus.set({
      behind: 0,
      channel: 'chrome',
      fetchedAt: 0,
      prefetchPercent: 42,
      prefetchReady: false,
      supported: true,
      updateAvailable: true
    })

    renderFooter()

    const chip = await screen.findByRole('button', { name: '42%' })
    expect(chip.textContent).toBe('42%')

    fireEvent.click(chip)

    expect($updateOverlayOpen.get()).toBe(true)
    expect(apply).not.toHaveBeenCalled()
    expect($updateApply.get().applying).toBe(false)
  })

  it('finalizes a ready chrome prefetch from the Account chip', async () => {
    installAccount(SIGNED_OUT)
    const apply = vi.fn(async () => ({ handedOff: true, ok: true }))
    desktopWindow.work4youDesktop = {
      ...(desktopWindow.work4youDesktop as object),
      updates: { apply, check: vi.fn() }
    }
    $updateStatus.set({
      behind: 0,
      channel: 'chrome',
      fetchedAt: 0,
      prefetchPercent: 100,
      prefetchReady: true,
      supported: true,
      updateAvailable: true
    })

    renderFooter()

    fireEvent.click(await screen.findByRole('button', { name: 'Update' }))

    await vi.waitFor(() => {
      expect(apply).toHaveBeenCalled()
    })
  })

  it('picks the identity up when the first-run sign-in finishes', async () => {
    installAccount(SIGNED_OUT)

    renderFooter()
    await settleReads()
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy()

    // The browser sign-in completes and the onboarding overlay closes.
    portal.read.mockResolvedValue(signedIn({ email: 'user@example.com', name: 'Ada Lovelace' }))
    await act(async () => {
      $desktopOnboarding.set({ ...$desktopOnboarding.get(), configured: true, manual: false, requested: false })
    })

    expect(await screen.findByRole('button', { name: 'Ada Lovelace' })).toBeTruthy()
  })

  it('picks the identity up when the window regains focus', async () => {
    installAccount(SIGNED_OUT)

    renderFooter()
    await settleReads()
    expect(screen.queryByRole('button', { name: 'user@example.com' })).toBeNull()

    portal.read.mockResolvedValue(signedIn({ email: 'user@example.com' }))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(await screen.findByRole('button', { name: 'user@example.com' })).toBeTruthy()
  })
})
