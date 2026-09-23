import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  $desktopVersion,
  $updateApply,
  $updateOverlayOpen,
  $updateOverlayTarget,
  $updateStatus,
  resetUpdateApplyState
} from '@/store/updates'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { ACCOUNT_CONTACT_URL, ACCOUNT_DOCS_URL, AccountFooter } from './account-footer'

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

const desktopWindow = window as unknown as { work4youDesktop?: unknown }
const initialDesktop = desktopWindow.work4youDesktop

afterEach(() => {
  cleanup()
  $desktopVersion.set(null)
  $updateStatus.set(null)
  $updateOverlayOpen.set(false)
  resetUpdateApplyState()

  if (initialDesktop) {
    desktopWindow.work4youDesktop = initialDesktop
  } else {
    delete desktopWindow.work4youDesktop
  }

  vi.restoreAllMocks()
})

function installCloud(status: {
  email?: null | string
  logout?: ReturnType<typeof vi.fn>
  openExternal?: ReturnType<typeof vi.fn>
  signedIn: boolean
}) {
  const statusFn = vi.fn(async () => ({ portalBaseUrl: 'https://portal.example', ...status }))

  const logout =
    status.logout ??
    vi.fn(async () => ({
      ok: true,
      portalBaseUrl: 'https://portal.example',
      signedIn: false
    }))

  const openExternal = status.openExternal ?? vi.fn(async () => undefined)

  desktopWindow.work4youDesktop = { cloud: { logout, status: statusFn }, openExternal }

  return { logout, openExternal, statusFn }
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
  it('shows the Portal email and a full account menu including Log Out', async () => {
    installCloud({ signedIn: true, email: 'user@example.com' })

    renderFooter()

    const trigger = await screen.findByRole('button', { name: 'user@example.com' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('title')).toBeNull()
    expect(trigger.querySelector('[data-slot="account-footer-mark"]')?.getAttribute('aria-hidden')).toBe('true')
    expect(trigger.querySelector('[data-slot="account-footer-mark"]')?.textContent).toBe('US')

    fireEvent.pointerDown(trigger, { button: 0 })

    expect(await screen.findByRole('menuitem', { name: /^settings$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^docs$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^shortcuts$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^contact us$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^log out$/i })).toBeTruthy()
  })

  it('navigates to Settings from the account menu', async () => {
    installCloud({ signedIn: true, email: 'user@example.com' })

    renderFooter()
    await openMenu('user@example.com')

    fireEvent.click(await screen.findByRole('menuitem', { name: /^settings$/i }))
    expect(screen.getByTestId('location').textContent).toBe('/settings')
  })

  it('navigates to Keyboard shortcuts from the account menu', async () => {
    installCloud({ signedIn: true, email: 'user@example.com' })

    renderFooter()
    await openMenu('user@example.com')

    fireEvent.click(await screen.findByRole('menuitem', { name: /^shortcuts$/i }))
    expect(screen.getByTestId('location').textContent).toBe('/settings?tab=keybinds')
  })

  it('opens Docs and Contact Us in the system browser', async () => {
    const { openExternal } = installCloud({ signedIn: true, email: 'user@example.com' })

    renderFooter()
    await openMenu('user@example.com')

    fireEvent.click(await screen.findByRole('menuitem', { name: /^docs$/i }))
    expect(openExternal).toHaveBeenCalledWith(ACCOUNT_DOCS_URL)

    await openMenu('user@example.com')
    fireEvent.click(await screen.findByRole('menuitem', { name: /^contact us$/i }))
    expect(openExternal).toHaveBeenCalledWith(ACCOUNT_CONTACT_URL)
  })

  it('signs out of the Portal account and drops Log Out from the menu', async () => {
    const { logout } = installCloud({ signedIn: true, email: 'user@example.com' })

    renderFooter()
    await openMenu('user@example.com')

    fireEvent.click(await screen.findByRole('menuitem', { name: /^log out$/i }))

    await act(async () => {
      await logout.mock.results[0]?.value
    })

    expect(logout).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: 'Account' })).toBeTruthy()

    await openMenu('Account')
    expect(await screen.findByRole('menuitem', { name: /^settings$/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^log out$/i })).toBeNull()
  })

  it('shows the same menu without Log Out when there is no Portal email', async () => {
    const { statusFn } = installCloud({ signedIn: false, email: null })

    renderFooter()

    await act(async () => {
      await statusFn.mock.results[0]?.value
    })

    const trigger = screen.getByRole('button', { name: 'Account' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')

    fireEvent.pointerDown(trigger, { button: 0 })

    expect(await screen.findByRole('menuitem', { name: /^settings$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^docs$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^shortcuts$/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^contact us$/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^log out$/i })).toBeNull()
  })

  it('keeps the account menu without the desktop bridge (web / tests)', async () => {
    delete desktopWindow.work4youDesktop

    renderFooter()

    await openMenu('Account')
    expect(screen.getByRole('menuitem', { name: /^settings$/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^log out$/i })).toBeNull()
  })

  it('keeps Log Out off when signed in but the shell has no email field', async () => {
    const { statusFn } = installCloud({ signedIn: true })

    renderFooter()

    await act(async () => {
      await statusFn.mock.results[0]?.value
    })

    await openMenu('Account')
    expect(await screen.findByRole('menuitem', { name: /^settings$/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^log out$/i })).toBeNull()
  })

  it('keeps the update chip off when the client is current', async () => {
    installCloud({ signedIn: false, email: null })
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
  })

  it('starts the existing apply from the Account chip, same as Update now', async () => {
    installCloud({ signedIn: false, email: null })
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
    installCloud({ signedIn: false, email: null })
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
    installCloud({ signedIn: false, email: null })
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

    fireEvent.click(await screen.findByRole('button', { name: 'Restart to finish' }))

    await vi.waitFor(() => {
      expect(apply).toHaveBeenCalled()
    })
  })

  it('picks the email up when the window regains focus after a portal sign-in', async () => {
    const { statusFn } = installCloud({ signedIn: false, email: null })

    renderFooter()

    await act(async () => {
      await statusFn.mock.results[0]?.value
    })
    expect(screen.queryByRole('button', { name: 'user@example.com' })).toBeNull()

    // The user signs into the Portal in the separate login window, then focus
    // returns to the main window — the footer must pick the email up now.
    statusFn.mockImplementation(async () => ({
      portalBaseUrl: 'https://portal.example',
      signedIn: true,
      email: 'user@example.com'
    }))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(await screen.findByRole('button', { name: 'user@example.com' })).toBeTruthy()
    expect(statusFn).toHaveBeenCalledTimes(2)
  })
})
