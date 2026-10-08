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
    const { container } = renderRow(<CodingStatusRow placement="changes" repoPath="/repos/notes" />)

    expect(container.textContent).toBe('')
  })

  it('stays hidden on an occupied chat', () => {
    const { container } = renderRow(<CodingStatusRow placement="identity" repoPath="/repos/notes" />)

    expect(container.textContent).toBe('')
    expect(screen.queryByText('notes')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Select project' })).toBeNull()
  })
})
