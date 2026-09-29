import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WorkspaceAddButton, WorkspaceShowMoreButton } from './workspace-header'

afterEach(cleanup)

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      sidebar: {
        projects: {
          copyPath: 'Copy path',
          menu: 'Actions',
          removeWorktree: 'Remove worktree',
          reveal: 'Reveal in file manager',
          startWork: 'New worktree'
        },
        showMore: 'Show more',
        showMoreIn: (n: number, label: string) => `Show ${n} more in ${label}`
      }
    }
  })
}))

vi.mock('@/store/projects', () => ({
  copyPath: vi.fn(),
  revealPath: vi.fn()
}))

// StartWorkButton no longer renders a dialog. It publishes an intent to the one
// WorktreeDialog that is mounted in the sidebar. Stub the store action, so this
// test keeps the button separate from the git probes of the resolver.
vi.mock('@/store/coding-status', () => ({
  openWorktreeDialog: vi.fn()
}))

const tipTrigger = (button: HTMLElement) => button.closest('[data-slot="tooltip-trigger"]')

describe('WorkspaceAddButton', () => {
  it('wraps the "+" button in a Tip', () => {
    render(<WorkspaceAddButton label="New session in Test D" onClick={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'New session in Test D' })
    expect(tipTrigger(button)).toBeTruthy()
  })

  it('still fires onClick', () => {
    const onClick = vi.fn()
    render(<WorkspaceAddButton label="New session in Test D" onClick={onClick} />)

    fireEvent.click(screen.getByRole('button', { name: 'New session in Test D' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('WorkspaceShowMoreButton', () => {
  it('shows a visible Show more row and keeps the count in the tip label', () => {
    render(<WorkspaceShowMoreButton count={5} label="Test D" onClick={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Show 5 more in Test D' })
    expect(button.textContent).toBe('Show more')
    expect(tipTrigger(button)).toBeTruthy()
  })
})
