import { cleanup, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { DesktopConnectionsRegistry, Work4YouConnection } from '@/global'
import { $connectionsRegistry } from '@/store/connections'
import { $connection } from '@/store/session'
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
  $connectionsRegistry.set(null)
  $connection.set(null)
})

describe('CodingStatusRow without git', () => {
  it('stays hidden on an empty chat', () => {
    const { container } = renderRow(<CodingStatusRow repoPath="/repos/notes" />)

    expect(container.querySelector('.coding-status-bar')).toBeNull()
  })

  it('paints name · connection on an occupied chat', () => {
    $connectionsRegistry.set({
      connections: [
        { id: 'local', kind: 'local', label: 'This device', tokenPreview: null, tokenSet: false },
        { id: 'cloud', kind: 'cloud', label: 'Work4You Cloud', tokenPreview: null, tokenSet: false }
      ],
      primary: 'local',
      secureTokenStorage: true,
      version: 2
    } satisfies DesktopConnectionsRegistry)
    $connection.set({ connectionId: 'cloud' } as Work4YouConnection)

    renderRow(<CodingStatusRow repoPath="/repos/notes" showWorkspaceName />)

    expect(screen.getByText('notes')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Select workspace' })).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByText('Work4You Cloud')).toBeTruthy()
    expect(screen.queryByText('bb/hitbox')).toBeNull()
  })
})
