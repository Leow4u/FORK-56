import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { AccountFooter } from './account-footer'

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

const desktopWindow = window as unknown as { work4youDesktop?: unknown }
const initialDesktop = desktopWindow.work4youDesktop

afterEach(() => {
  cleanup()

  if (initialDesktop) {
    desktopWindow.work4youDesktop = initialDesktop
  } else {
    delete desktopWindow.work4youDesktop
  }

  vi.restoreAllMocks()
})

function installCloudStatus(status: { email?: null | string; portalBaseUrl?: string; signedIn: boolean }) {
  const statusFn = vi.fn(async () => ({ portalBaseUrl: 'https://portal.example', ...status }))

  desktopWindow.work4youDesktop = { cloud: { status: statusFn } }

  return statusFn
}

// Records where the footer's actions navigate to, so the tests assert the
// REAL router outcome (landing on /settings) instead of a mocked callback.
function LocationProbe() {
  const location = useLocation()

  return <div data-testid="location">{location.pathname}</div>
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
  it('shows the account email and opens the user menu with a Settings entry', async () => {
    installCloudStatus({ signedIn: true, email: 'user@example.com' })

    renderFooter()

    const trigger = await screen.findByRole('button', { name: 'user@example.com' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')

    fireEvent.pointerDown(trigger, { button: 0 })

    fireEvent.click(await screen.findByRole('menuitem', { name: /open settings/i }))
    expect(screen.getByTestId('location').textContent).toBe('/settings')
  })

  it('falls back to a direct settings button when signed out (titlebar-gear parity)', async () => {
    const statusFn = installCloudStatus({ signedIn: false, email: null })

    renderFooter()

    await act(async () => {
      await statusFn.mock.results[0]?.value
    })

    const button = screen.getByRole('button', { name: 'Open settings' })

    fireEvent.click(button)
    expect(screen.getByTestId('location').textContent).toBe('/settings')
  })

  it('keeps the settings button reachable without the desktop bridge (web / tests)', () => {
    delete desktopWindow.work4youDesktop

    renderFooter()

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(screen.getByTestId('location').textContent).toBe('/settings')
  })

  it('keeps the settings button when the shell predates the email field (signed in, no email)', async () => {
    const statusFn = installCloudStatus({ signedIn: true })

    renderFooter()

    await act(async () => {
      await statusFn.mock.results[0]?.value
    })

    expect(screen.getByRole('button', { name: 'Open settings' })).toBeTruthy()
  })

  it('picks the email up when the window regains focus after a portal sign-in', async () => {
    const statusFn = installCloudStatus({ signedIn: false, email: null })

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
