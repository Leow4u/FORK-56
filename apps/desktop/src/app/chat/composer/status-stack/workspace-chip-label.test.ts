import { afterEach, describe, expect, it } from 'vitest'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { $projectTree } from '@/store/projects'

import { workspaceChipLabel } from './workspace-chip-label'

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
