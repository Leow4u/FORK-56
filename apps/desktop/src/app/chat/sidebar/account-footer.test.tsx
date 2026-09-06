import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountFooter } from './account-footer'

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

describe('AccountFooter', () => {
  it('shows the signed-in account email as a quiet footer label', async () => {
    installCloudStatus({ signedIn: true, email: 'user@example.com' })

    render(<AccountFooter />)

    expect(await screen.findByText('user@example.com')).toBeTruthy()
    expect(screen.getByTitle('user@example.com')).toBeTruthy()
  })

  it('renders nothing when signed out', async () => {
    const statusFn = installCloudStatus({ signedIn: false, email: null })

    const { container } = render(<AccountFooter />)

    await act(async () => {
      await statusFn.mock.results[0]?.value
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the shell predates the email field (signed in, no email)', async () => {
    const statusFn = installCloudStatus({ signedIn: true })

    const { container } = render(<AccountFooter />)

    await act(async () => {
      await statusFn.mock.results[0]?.value
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing without the desktop bridge (web / tests)', () => {
    delete desktopWindow.work4youDesktop

    const { container } = render(<AccountFooter />)

    expect(container.firstChild).toBeNull()
  })

  it('re-checks the status when the window regains focus (sign-in happens in another window)', async () => {
    const statusFn = installCloudStatus({ signedIn: false, email: null })

    render(<AccountFooter />)

    await act(async () => {
      await statusFn.mock.results[0]?.value
    })
    expect(screen.queryByText('user@example.com')).toBeNull()

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

    expect(await screen.findByText('user@example.com')).toBeTruthy()
    expect(statusFn).toHaveBeenCalledTimes(2)
  })
})
