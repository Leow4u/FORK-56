import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { $commandPaletteOpen, $commandPalettePage, closeCommandPalette } from '@/store/command-palette'
import { $projectScope, $projectTree, ALL_PROJECTS } from '@/store/projects'
import { $currentCwd, $newChatWorkspaceTarget, setCurrentCwd, setNewChatWorkspaceTarget } from '@/store/session'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { WorkspaceChipRow } from './workspace-chip'

const { openFolderAsProject, openProjectCreate } = vi.hoisted(() => ({
  openFolderAsProject: vi.fn(async () => undefined),
  openProjectCreate: vi.fn()
}))

vi.mock('@/store/projects', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return {
    ...actual,
    openFolderAsProject,
    openProjectCreate
  }
})

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

afterEach(() => {
  cleanup()
  closeCommandPalette()
  openFolderAsProject.mockClear()
  openProjectCreate.mockClear()
  $projectTree.set([])
  $projectScope.set(ALL_PROJECTS)
  setCurrentCwd('')
  setNewChatWorkspaceTarget(undefined)
})

function renderChip(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

async function openSelectWorkspace() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Select workspace' }), { button: 0 })

  return waitFor(() => screen.getByRole('menu'))
}

describe('WorkspaceChipRow', () => {
  it('paints Select workspace on an empty chat and opens a menu on the chip', async () => {
    const { container } = renderChip(<WorkspaceChipRow messagesEmpty />)

    const chip = screen.getByRole('button', { name: 'Select workspace' })

    expect(chip.textContent).toContain('Select workspace')
    expect(chip.textContent).not.toContain('Home')
    expect(chip.getAttribute('data-slot')).toBe('workspace-chip')
    expect(screen.getByRole('button', { name: 'Connection mode' })).toBeTruthy()
    expect(container.querySelector('.group\\/status-row')).toBeNull()

    await openSelectWorkspace()

    expect($commandPaletteOpen.get()).toBe(false)
    expect($commandPalettePage.get()).toBeNull()
    expect(screen.getByRole('menuitem', { name: /Open folder as project/ })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /Remote/ })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /New project/ })).toBeTruthy()
  })

  it('lists used projects and hides home and unused scans', async () => {
    $projectTree.set([
      {
        id: 'p_dute',
        label: 'DuteLog',
        path: '/repos/dute',
        repos: [],
        sessionCount: 2
      } satisfies SidebarProjectTree,
      {
        id: '__no_project__',
        isNoProject: true,
        label: 'Home',
        path: null,
        repos: [],
        sessionCount: 4
      } satisfies SidebarProjectTree,
      {
        id: '/scan',
        isAuto: true,
        label: 'scan',
        path: '/scan',
        repos: [],
        sessionCount: 0
      } satisfies SidebarProjectTree,
      {
        id: '/used',
        isAuto: true,
        label: 'Used repo',
        path: '/used',
        repos: [],
        sessionCount: 1
      } satisfies SidebarProjectTree
    ])
    renderChip(<WorkspaceChipRow messagesEmpty />)

    await openSelectWorkspace()

    expect(screen.getByRole('menuitem', { name: 'DuteLog' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Used repo' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Home' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'scan' })).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Search projects' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Clear active' })).toBeNull()
  })

  it('selects a recent project into the empty chat and can clear it', async () => {
    $projectTree.set([
      {
        id: 'p_dute',
        label: 'DuteLog',
        path: '/repos/dute',
        repos: [],
        sessionCount: 2
      } satisfies SidebarProjectTree
    ])
    renderChip(<WorkspaceChipRow messagesEmpty />)

    await openSelectWorkspace()
    fireEvent.click(screen.getByRole('menuitem', { name: 'DuteLog' }))

    expect($projectScope.get()).toBe('p_dute')
    expect($currentCwd.get()).toBe('/repos/dute')
    expect($newChatWorkspaceTarget.get()).toBe('/repos/dute')

    await openSelectWorkspace()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear active' }))

    expect($projectScope.get()).toBe(ALL_PROJECTS)
    expect($currentCwd.get()).toBe('')
    expect($newChatWorkspaceTarget.get()).toBeNull()
  })

  it('filters the recent list from the menu search', async () => {
    $projectTree.set([
      {
        id: 'p_tax',
        label: 'TAXCO',
        path: '/work/taxco',
        repos: [],
        sessionCount: 1
      } satisfies SidebarProjectTree,
      {
        id: 'p_w4y',
        label: 'work4you',
        path: '/work/work4you',
        repos: [],
        sessionCount: 1
      } satisfies SidebarProjectTree
    ])
    renderChip(<WorkspaceChipRow messagesEmpty />)

    await openSelectWorkspace()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search projects' }), { target: { value: 'tax' } })

    expect(screen.getByRole('menuitem', { name: 'TAXCO' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'work4you' })).toBeNull()
  })

  it('does not rename the chip for a cwd outside the entered project', () => {
    $projectScope.set('p_dute')
    $projectTree.set([
      {
        id: 'p_dute',
        label: 'DuteLog',
        path: '/repos/dute',
        repos: [],
        sessionCount: 1
      } satisfies SidebarProjectTree
    ])
    renderChip(<WorkspaceChipRow cwd="/other" messagesEmpty />)

    const chip = screen.getByRole('button', { name: 'Select workspace' })

    expect(chip.textContent).toContain('Select workspace')
    expect(chip.textContent).not.toContain('DuteLog')
  })

  it('names a scoped auto project on the empty-chat chip', () => {
    $projectScope.set('/used')
    $projectTree.set([
      {
        id: '/used',
        isAuto: true,
        label: 'Used repo',
        path: '/used',
        repos: [],
        sessionCount: 2
      } satisfies SidebarProjectTree
    ])
    renderChip(<WorkspaceChipRow cwd="/used" messagesEmpty />)

    const chip = screen.getByRole('button', { name: 'Select workspace' })

    expect(chip.textContent).toContain('Used repo')
    expect(chip.textContent).not.toContain('Select workspace')
  })

  it('runs Open folder and New project from the attached menu', async () => {
    renderChip(<WorkspaceChipRow messagesEmpty />)

    await openSelectWorkspace()
    fireEvent.click(screen.getByRole('menuitem', { name: /Open folder as project/ }))

    expect(openFolderAsProject).toHaveBeenCalledOnce()

    await openSelectWorkspace()
    fireEvent.click(screen.getByRole('menuitem', { name: /New project/ }))

    expect(openProjectCreate).toHaveBeenCalledOnce()
  })

  it('keeps the visible label Select workspace when a cwd is not a named project', () => {
    renderChip(<WorkspaceChipRow cwd="/repos/website/src" messagesEmpty />)

    expect(screen.getByRole('button', { name: 'Select workspace' }).textContent).toContain('Select workspace')
    expect(screen.getByRole('button', { name: 'Select workspace' }).textContent).not.toContain('website')
  })

  it('paints the named project on the empty-chat chip', () => {
    $projectTree.set([
      {
        id: 'p_cars',
        label: 'Carros Eduardo',
        path: '/Users/leona/Aplicativos',
        repos: [],
        sessionCount: 0
      } satisfies SidebarProjectTree
    ])
    renderChip(<WorkspaceChipRow cwd="/Users/leona/Aplicativos" messagesEmpty />)

    const chip = screen.getByRole('button', { name: 'Select workspace' })

    expect(chip.textContent).toContain('Carros Eduardo')
    expect(chip.textContent).not.toContain('Select workspace')
    expect(chip.textContent).not.toContain('Aplicativos')
  })

  it('paints Select workspace as a second capsule stacked under the prompt card', () => {
    const { container } = renderChip(<WorkspaceChipRow messagesEmpty />)

    const chip = screen.getByRole('button', { name: 'Select workspace' })
    const shell = container.querySelector('[data-slot="composer-context-bar"]')
    const icon = chip.querySelector('svg')

    expect(shell).not.toBeNull()
    expect(shell?.className).toContain('rounded-3xl')
    expect(shell?.className).toContain('border-(--ui-stroke-secondary)')
    expect(shell?.className).toContain('-mt-1.5')
    expect(shell?.className).toContain('py-1.5')
    expect(chip.className).toContain('h-7')
    expect(chip.className).toContain('max-w-full')
    expect(chip.className).not.toContain('rounded-full')
    expect(chip.className).not.toContain('rounded-xl')
    expect(chip.className).not.toContain('muted-foreground')
    expect(icon?.classList.contains('size-3.5')).toBe(true)
  })

  it('stays off the composer once the transcript has messages', () => {
    const { container } = renderChip(<WorkspaceChipRow cwd="/repos/website" messagesEmpty={false} />)

    expect(screen.queryByRole('button', { name: 'Select workspace' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Connection mode' })).toBeNull()
    expect(container.querySelector('[data-slot="workspace-chip"]')).toBeNull()
    expect(container.querySelector('[data-slot="composer-run-target"]')).toBeNull()
    expect(container.querySelector('[data-slot="composer-context-bar"]')).toBeNull()
  })
})
