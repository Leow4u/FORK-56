import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { clearNotifications, notify } from '@/store/notifications'

import { NotificationStack, toastTitleClassName } from './notifications'

const LONG_TITLE = 'This turn is no longer in server history (it may have been compressed away).'
const DETAIL = 'target user message is no longer in session history'

describe('toast titles', () => {
  beforeEach(() => {
    clearNotifications()
  })

  afterEach(() => {
    cleanup()
    clearNotifications()
  })

  it('drops the one-line clamp so a long error title can wrap', () => {
    const className = toastTitleClassName()

    expect(className).toMatch(/\bline-clamp-none\b/)
    expect(className).not.toMatch(/\bline-clamp-1\b/)
    expect(className).toMatch(/\bwhitespace-normal\b/)
    expect(className).toContain('max-h-[4.5em]')
    expect(className).toMatch(/\boverflow-y-auto\b/)
  })

  it('renders the full title and body instead of truncating them', () => {
    notify({ kind: 'error', title: LONG_TITLE, message: DETAIL })

    render(
      <I18nProvider configClient={null} initialLocale="en">
        <NotificationStack />
      </I18nProvider>
    )

    const title = screen.getByText(LONG_TITLE)

    expect(title.textContent).toBe(LONG_TITLE)
    expect(title.getAttribute('title')).toBe(LONG_TITLE)
    expect(title.className).toMatch(/\bline-clamp-none\b/)
    expect(title.className).not.toMatch(/\bline-clamp-1\b/)
    expect(title.className).toMatch(/\boverflow-y-auto\b/)
    expect(screen.getByText(DETAIL)).toBeTruthy()
  })
})

it('uses one region and preserves expansion, details, actions and dismiss callbacks', () => {
  const action = vi.fn()
  const olderDismiss = vi.fn()
  const latestDismiss = vi.fn()
  notify({
    id: 'older',
    message: 'Background task completed',
    placement: 'bottom-right',
    durationMs: 0,
    onDismiss: olderDismiss
  })
  notify({
    id: 'latest',
    kind: 'error',
    title: 'Could not finish',
    message: 'Try again',
    detail: 'Error trace',
    placement: 'default',
    action: { label: 'Retry', onClick: action },
    onDismiss: latestDismiss
  })

  const view = render(
    <I18nProvider configClient={null} initialLocale="en">
      <NotificationStack />
    </I18nProvider>
  )

  const region = screen.getByRole('region')
  expect(view.container.children).toHaveLength(0) // Body portal, including over dialogs.
  expect(screen.getAllByRole('region')).toHaveLength(1)
  expect(screen.queryByText('Background task completed')).toBeNull()
  const expand = within(region).getByRole('button', { name: /1.*more/i })
  fireEvent.click(expand)
  expect(screen.getByText('Background task completed')).toBeTruthy()
  expect(expand.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(within(region).getByRole('button', { name: /details/i }))
  expect(screen.getByText('Error trace')).toBeTruthy()
  fireEvent.click(within(region).getByRole('button', { name: 'Retry' }))
  expect(action).toHaveBeenCalledOnce()
  expect(latestDismiss).toHaveBeenCalledOnce()
  expect(screen.queryByText('Could not finish')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
  expect(olderDismiss).toHaveBeenCalledOnce()
  expect(screen.queryByRole('region')).toBeNull()
  cleanup()
  clearNotifications()
})

it('clears the whole queue from the collapsed stack', () => {
  notify({ message: 'First', durationMs: 0 })
  notify({ message: 'Second', durationMs: 0 })
  render(
    <I18nProvider configClient={null} initialLocale="pt">
      <NotificationStack />
    </I18nProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Limpar tudo' }))
  expect(screen.queryByRole('region')).toBeNull()
  cleanup()
})
