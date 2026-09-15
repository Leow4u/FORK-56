import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { atom } from 'nanostores'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { DesktopConnectionsRegistry, Work4YouConnection } from '@/global'
import { $commandPaletteOpen, closeCommandPalette } from '@/store/command-palette'
import { $connectionsRegistry } from '@/store/connections'
import { $notifications, clearNotifications } from '@/store/notifications'
import { $projectTree } from '@/store/projects'
import { $connection } from '@/store/session'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

vi.mock('@/store/coding-status', () => ({
  registerRepoStatusCwd: () => undefined,
  repoStatusForCwd: () =>
    atom({
      added: 12,
      ahead: 0,
      behind: 0,
      branch: 'bb/hitbox',
      defaultBranch: 'main',
      detached: false,
      removed: 3,
      untracked: 0
    }),
  repoWorktreesForCwd: () => atom([])
}))

const { CodingStatusRow } = await import('./coding-row')

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

function registry(over: Partial<DesktopConnectionsRegistry> = {}): DesktopConnectionsRegistry {
  return {
    connections: [],
    primary: 'local',
    secureTokenStorage: true,
    version: 2,
    ...over
  }
}

function renderRow(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

afterEach(() => {
  cleanup()
  closeCommandPalette()
  $connectionsRegistry.set(null)
  $connection.set(null)
  $projectTree.set([])
})

describe('CodingStatusRow', () => {
  it('opens the review pane from the branch and the diff counts, never the bar itself', () => {
    const onOpen = vi.fn()

    const { container } = renderRow(<CodingStatusRow onOpen={onOpen} repoPath="/repo" />)

    const bar = container.querySelector<HTMLElement>('.coding-status-bar')

    expect(bar).not.toBeNull()

    fireEvent.click(bar!)
    expect(onOpen).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('bb/hitbox'))
    expect(onOpen).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('12'))
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('wraps the click targets without adding a layout box', () => {
    const { container } = renderRow(<CodingStatusRow onOpen={() => undefined} repoPath="/repo" />)

    // `display: contents` is what keeps the branch label and the counts direct
    // flex children of the row — the hit areas cost nothing visually.
    expect(screen.getByText('bb/hitbox').parentElement?.classList.contains('contents')).toBe(true)
    expect(screen.getByText('12').closest('button')?.classList.contains('contents')).toBe(true)
    // The glyph button fills the row's existing 3.5 leading slot exactly.
    expect(container.querySelector('button[class~="size-3.5"]')).not.toBeNull()
  })

  it('parks the copy glyph against the end of the path, not the end of the row', () => {
    renderRow(<CodingStatusRow onOpen={() => undefined} repoPath="/Users/someone/www/repo" />)

    const path = screen.getByText('~/www/repo')

    // The path sizes to its content and the glyph is its immediate sibling, so
    // the pair reads as one unit. `flex-1` belongs to the wrapper (which holds
    // the row's slack open) — on the label it stretched the text and pushed the
    // glyph out to the kebab.
    expect(path.classList.contains('flex-1')).toBe(false)
    expect(path.parentElement?.classList.contains('flex-1')).toBe(true)
    expect(path.nextElementSibling?.tagName).toBe('BUTTON')
  })

  it('copies the absolute cwd inline — checkmark feedback, no toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    clearNotifications()

    renderRow(<CodingStatusRow onOpen={() => undefined} repoPath="/Users/someone/www/repo" />)

    // Painted tildified, copied raw.
    expect(screen.getByText('~/www/repo')).toBeTruthy()

    const copy = screen.getByRole('button', { name: 'Copy Path' })

    fireEvent.click(copy)

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('/Users/someone/www/repo'))
    // Confirmation is the button turning into a checkmark, not a notification.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy())
    expect($notifications.get()).toHaveLength(0)
  })

  it('keeps name off the empty-chat coding row', () => {
    renderRow(<CodingStatusRow onOpen={() => undefined} repoPath="/repos/website" />)

    expect(screen.queryByRole('button', { name: 'Select workspace' })).toBeNull()
    expect(screen.getByText('bb/hitbox')).toBeTruthy()
  })

  it('rounds the git bar as the top of the composer card', () => {
    for (const showWorkspaceName of [false, true]) {
      const { container, unmount } = renderRow(
        <CodingStatusRow onOpen={() => undefined} repoPath="/repo" showWorkspaceName={showWorkspaceName} />
      )

      expect(container.querySelector('.coding-status-bar')?.className).toContain('rounded-t-[inherit]')
      unmount()
    }
  })

  it('paints name · branch on one occupied strip', () => {
    $projectTree.set([
      {
        id: 'p_web',
        label: 'Website',
        path: '/repos/website',
        repos: [],
        sessionCount: 0
      }
    ])

    const { container } = renderRow(
      <CodingStatusRow onOpen={() => undefined} repoPath="/repos/website" showWorkspaceName />
    )

    const strip = container.querySelector('[data-slot="workspace-context-strip"]')

    expect(strip?.textContent).toContain('Website')
    expect(strip?.textContent).toContain('·')
    expect(strip?.textContent).toContain('bb/hitbox')
    expect(screen.queryByText('This device')).toBeNull()
  })

  it('adds the active source when more than one connection exists', () => {
    $connectionsRegistry.set(
      registry({
        connections: [
          { id: 'local', kind: 'local', label: 'This device', tokenPreview: null, tokenSet: false },
          { id: 'cloud', kind: 'cloud', label: 'Work4You Cloud', tokenPreview: null, tokenSet: false }
        ]
      })
    )
    $connection.set({ connectionId: 'local' } as Work4YouConnection)

    renderRow(<CodingStatusRow onOpen={() => undefined} repoPath="/repo" showWorkspaceName />)

    expect(screen.getByRole('button', { name: 'Select workspace' }).textContent).toContain('repo')
    expect(screen.getByText('bb/hitbox')).toBeTruthy()
    expect(screen.getByText('This device')).toBeTruthy()
    expect(screen.queryByText('Work4You Cloud')).toBeNull()
  })

  it('opens Select workspace from the occupied name', async () => {
    renderRow(<CodingStatusRow onOpen={() => undefined} repoPath="/repo" showWorkspaceName />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Select workspace' }), { button: 0 })

    expect(await screen.findByRole('menu')).toBeTruthy()
    expect($commandPaletteOpen.get()).toBe(false)
    expect(screen.getByRole('menuitem', { name: /Open folder as project/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Remote/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /New project/ })).toBeTruthy()
  })
})
