import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { $notifications, clearNotifications } from '@/store/notifications'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

vi.mock('@/store/coding-status', () => ({
  registerRepoStatusCwd: () => undefined,
  repoStatusForCwd: () =>
    atom({
      added: 12,
      ahead: 2,
      behind: 1,
      branch: 'bb/hitbox',
      changed: 2,
      defaultBranch: 'main',
      detached: false,
      removed: 3,
      untracked: 0
    })
}))
const { CodingStatusRow } = await import('./coding-row')

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})
afterEach(() => {
  cleanup()
  clearNotifications()
})

describe('active-session Git chips', () => {
  it('opens current changes without repeating the branch selector', () => {
    const onOpen = vi.fn()
    render(<CodingStatusRow onOpen={onOpen} placement="changes" repoPath="/repo" />)
    fireEvent.click(screen.getByRole('button', { name: /Changes/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.queryByText('bb/hitbox')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('copies only the branch name without opening review or a switch menu', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const onOpen = vi.fn()
    render(<CodingStatusRow onOpen={onOpen} placement="identity" repoPath="/Users/someone/www/repo" />)
    const chip = screen.getByRole('button', { name: 'Copy branch name' })
    expect(chip.textContent).toContain('bb/hitbox')
    expect(chip.hasAttribute('aria-haspopup')).toBe(false)
    fireEvent.click(chip)
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('bb/hitbox'))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy()
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
    expect($notifications.get()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Select project' })).toBeNull()
    // Existing sync information remains available next to the identity chip.
    expect(screen.getByLabelText(/2.*ahead|ahead.*2/i)).toBeTruthy()
    expect(screen.getByLabelText(/1.*behind|behind.*1/i)).toBeTruthy()
  })
})
