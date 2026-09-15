import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { SELECT_WORKSPACE_PAGE } from '@/app/command-palette/workspace-palette'
import { $commandPaletteOpen, $commandPalettePage, closeCommandPalette } from '@/store/command-palette'
import { $projectTree } from '@/store/projects'

import { WorkspaceChipRow } from './workspace-chip'

function treeNode(
  over: Partial<SidebarProjectTree> & Pick<SidebarProjectTree, 'id' | 'label'>
): SidebarProjectTree {
  return {
    path: null,
    repos: [],
    sessionCount: 0,
    ...over
  }
}

afterEach(() => {
  cleanup()
  closeCommandPalette()
  $projectTree.set([])
})

describe('WorkspaceChipRow', () => {
  it('paints Home with no cwd and opens Select workspace', () => {
    render(<WorkspaceChipRow />)

    const chip = screen.getByRole('button', { name: 'Select workspace' })

    expect(chip.textContent).toContain('Home')

    fireEvent.click(chip)

    expect($commandPaletteOpen.get()).toBe(true)
    expect($commandPalettePage.get()).toBe(SELECT_WORKSPACE_PAGE)
  })

  it('labels a named project and stays visible without git status', () => {
    $projectTree.set([treeNode({ id: 'p_web', label: 'Website', path: '/repos/website' })])

    render(<WorkspaceChipRow cwd="/repos/website/src" />)

    expect(screen.getByRole('button', { name: 'Select workspace' }).textContent).toContain('Website')
  })
})
