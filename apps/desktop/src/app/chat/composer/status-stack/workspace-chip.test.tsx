import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { $commandPaletteOpen, $commandPalettePage, closeCommandPalette } from '@/store/command-palette'
import { $projectTree } from '@/store/projects'
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
    expect(container.querySelector('.group\\/status-row')).toBeNull()

    await openSelectWorkspace()

    expect($commandPaletteOpen.get()).toBe(false)
    expect($commandPalettePage.get()).toBeNull()
    expect(screen.getByRole('menuitem', { name: /Open folder as project/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Remote/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /New project/ })).toBeTruthy()
  })

  it('keeps the project tree out of the chip menu', async () => {
    $projectTree.set([
      {
        id: 'p_dute',
        label: 'DuteLog',
        path: '/repos/dute',
        repos: [],
        sessionCount: 0
      } satisfies SidebarProjectTree
    ])
    renderChip(<WorkspaceChipRow messagesEmpty />)

    await openSelectWorkspace()

    expect(screen.queryByRole('menuitem', { name: 'DuteLog' })).toBeNull()
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
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

  it('uses the composer pill silhouette so the empty-chat chip stays readable', () => {
    renderChip(<WorkspaceChipRow messagesEmpty />)

    const chip = screen.getByRole('button', { name: 'Select workspace' })
    const icon = chip.querySelector('svg')

    expect(chip.className).toContain('h-(--composer-control-size)')
    expect(chip.className).toContain('rounded-full')
    expect(chip.className).toContain('border-border/65')
    expect(chip.className).toContain('text-(--ui-text-secondary)')
    expect(chip.className).not.toContain('muted-foreground')
    expect(icon?.classList.contains('size-3.5')).toBe(true)
  })

  it('stays off the composer once the transcript has messages', () => {
    const { container } = renderChip(<WorkspaceChipRow cwd="/repos/website" messagesEmpty={false} />)

    expect(screen.queryByRole('button', { name: 'Select workspace' })).toBeNull()
    expect(container.querySelector('[data-slot="workspace-chip"]')).toBeNull()
  })
})
