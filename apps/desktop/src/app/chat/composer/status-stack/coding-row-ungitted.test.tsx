import { cleanup, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

vi.mock('@/store/coding-status', () => ({
  registerRepoStatusCwd: () => undefined,
  repoStatusForCwd: () => atom(null),
  repoWorktreesForCwd: () => atom([])
}))

const { CodingStatusRow } = await import('./coding-row')

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

function renderRow(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

afterEach(() => {
  cleanup()
})

describe('CodingStatusRow without git', () => {
  it('stays hidden on an empty chat', () => {
    const { container } = renderRow(<CodingStatusRow repoPath="/repos/notes" />)

    expect(container.querySelector('.coding-status-bar')).toBeNull()
  })

  it('stays hidden on an occupied chat', () => {
    const { container } = renderRow(<CodingStatusRow repoPath="/repos/notes" showWorkspaceName />)

    expect(container.querySelector('.coding-status-bar')).toBeNull()
    expect(screen.queryByText('notes')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Select workspace' })).toBeNull()
  })
})
