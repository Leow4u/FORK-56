import { afterEach, describe, expect, it } from 'vitest'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { $projectTree } from '@/store/projects'

import { emptyWorkspaceChipLabel, workspaceChipLabel } from './workspace-chip-label'

function treeNode(over: Partial<SidebarProjectTree> & Pick<SidebarProjectTree, 'id' | 'label'>): SidebarProjectTree {
  return {
    path: null,
    repos: [],
    sessionCount: 0,
    ...over
  }
}

describe('workspaceChipLabel', () => {
  afterEach(() => {
    $projectTree.set([])
  })

  it('uses Home when the session has no cwd', () => {
    expect(workspaceChipLabel('', 'Home')).toBe('Home')
    expect(workspaceChipLabel(null, 'Home')).toBe('Home')
    expect(workspaceChipLabel(undefined, 'Home')).toBe('Home')
  })

  it('prefers the named project over the cwd leaf', () => {
    $projectTree.set([treeNode({ id: 'p_web', label: 'Website', path: '/repos/website' })])

    expect(workspaceChipLabel('/repos/website/src/app', 'Home')).toBe('Website')
  })

  it('falls back to the cwd leaf outside a named project', () => {
    $projectTree.set([])

    expect(workspaceChipLabel('/Users/me/www/work4you', 'Home')).toBe('work4you')
  })
})

describe('emptyWorkspaceChipLabel', () => {
  afterEach(() => {
    $projectTree.set([])
  })

  it('keeps the Select project CTA when there is no cwd', () => {
    expect(emptyWorkspaceChipLabel('', 'Select project')).toBe('Select project')
    expect(emptyWorkspaceChipLabel(null, 'Select project')).toBe('Select project')
  })

  it('keeps the CTA for a cwd that is not a named project', () => {
    $projectTree.set([])

    expect(emptyWorkspaceChipLabel('/Users/leona', 'Select project')).toBe('Select project')
  })

  it('names the explicit project that owns the cwd', () => {
    $projectTree.set([treeNode({ id: 'p_cars', label: 'Carros Eduardo', path: '/Users/leona/Aplicativos' })])

    expect(emptyWorkspaceChipLabel('/Users/leona/Aplicativos', 'Select project')).toBe('Carros Eduardo')
  })

  it('prefers the entered project label over the cwd name', () => {
    $projectTree.set([treeNode({ id: 'p_cars', label: 'Carros Eduardo', path: '/Users/leona/Aplicativos' })])

    expect(emptyWorkspaceChipLabel('/Users/leona/Aplicativos', 'Select project', 'Used repo')).toBe('Used repo')
  })
})
