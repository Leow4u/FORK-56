import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { $dismissedAutoProjectIds } from '@/store/layout'
import { clearActiveWorkspace, openFolderAsProject, openProjectCreate, selectWorkspaceProject } from '@/store/projects'

import {
  activeWorkspaceProjectId,
  buildWorkspacePaletteGroups,
  createWorkspacePaletteHandlers,
  WORKSPACE_CLEAR_ACTIVE_ID,
  WORKSPACE_NEW_PROJECT_ID,
  WORKSPACE_OPEN_FOLDER_ID,
  workspacePickerProjects,
  type WorkspacePickerSource
} from './workspace-palette'

vi.mock('@/store/projects', async importOriginal => {
  const actual = await importOriginal()

  return {
    ...(actual as Record<string, unknown>),
    clearActiveWorkspace: vi.fn(),
    openFolderAsProject: vi.fn(async () => undefined),
    openProjectCreate: vi.fn(),
    selectWorkspaceProject: vi.fn()
  }
})

afterEach(() => {
  vi.mocked(openFolderAsProject).mockClear()
  vi.mocked(openProjectCreate).mockClear()
  vi.mocked(selectWorkspaceProject).mockClear()
  vi.mocked(clearActiveWorkspace).mockClear()
  $dismissedAutoProjectIds.set([])
})

const copy = {
  clearActive: 'Clear active',
  newProject: 'New project',
  openFolder: 'Open folder as project…'
}

function handlers() {
  return {
    clearActive: vi.fn(),
    newProject: vi.fn(),
    openFolder: vi.fn(),
    selectProject: vi.fn()
  }
}

function project(over: Partial<SidebarProjectTree> & Pick<SidebarProjectTree, 'id' | 'label'>): SidebarProjectTree {
  return {
    path: `/repos/${over.id}`,
    repos: [],
    sessionCount: 1,
    ...over
  }
}

const home = project({
  id: '__no_project__',
  isNoProject: true,
  label: 'Home',
  path: null,
  sessionCount: 3
})

describe('buildWorkspacePaletteGroups', () => {
  it('pins Open folder and New project without a Remote row when nothing is selected', () => {
    const groups = buildWorkspacePaletteGroups(copy, handlers())

    expect(groups).toHaveLength(1)
    expect(groups[0]?.heading).toBeUndefined()
    expect(groups[0]?.items.map(item => item.id)).toEqual([WORKSPACE_OPEN_FOLDER_ID, WORKSPACE_NEW_PROJECT_ID])
    expect(groups[0]?.items.map(item => item.kind)).toEqual(['open-folder', 'new-project'])
    expect(groups[0]?.items.some(item => item.id === 'project-remote')).toBe(false)
    expect(groups[0]?.items.some(item => item.kind === 'clear-active')).toBe(false)
  })

  it('wires existing store actions', () => {
    const wired = handlers()
    const groups = buildWorkspacePaletteGroups(copy, wired)

    groups[0]?.items[0]?.run?.()
    groups[0]?.items[1]?.run?.()

    expect(wired.openFolder).toHaveBeenCalledOnce()
    expect(wired.newProject).toHaveBeenCalledOnce()
  })

  it('keeps Open folder on the existing keybind', () => {
    expect(buildWorkspacePaletteGroups(copy, handlers())[0]?.items[0]).toMatchObject({
      action: 'workspace.openFolder',
      kind: 'open-folder',
      label: copy.openFolder
    })
  })

  it('lists used projects ahead of the actions and offers clear when one is active', () => {
    const wired = handlers()

    const source: WorkspacePickerSource = {
      activeProjectId: 'p_tax',
      cwd: '/repos/p_tax',
      projects: [
        project({ id: 'p_tax', label: 'TAXCO', sessionCount: 4 }),
        project({ id: 'p_arm', label: 'Armazenamento', sessionCount: 1 }),
        home,
        project({ id: '/scan', isAuto: true, label: 'scan', path: '/scan', sessionCount: 0 })
      ],
      scope: 'p_tax'
    }

    const groups = buildWorkspacePaletteGroups(copy, wired, source)
    const ids = groups.flatMap(group => group.items.map(item => item.id))

    expect(ids).toEqual([
      'project:p_tax',
      'project:p_arm',
      WORKSPACE_OPEN_FOLDER_ID,
      WORKSPACE_NEW_PROJECT_ID,
      WORKSPACE_CLEAR_ACTIVE_ID
    ])
    expect(groups[0]?.items[0]).toMatchObject({ active: true, kind: 'project', label: 'TAXCO' })
    expect(groups.flatMap(group => group.items).some(item => item.label === 'Home' || item.label === 'scan')).toBe(
      false
    )

    groups[0]?.items[1]?.run?.()
    groups.at(-1)?.items[0]?.run?.()

    expect(wired.selectProject).toHaveBeenCalledWith('p_arm')
    expect(wired.clearActive).toHaveBeenCalledOnce()
  })
})

describe('workspacePickerProjects', () => {
  it('hides home, archived rows, and unused auto repos', () => {
    const projects = workspacePickerProjects({
      projects: [
        project({ id: 'p_named', label: 'Named', sessionCount: 0 }),
        project({ id: '/used', isAuto: true, label: 'Used repo', path: '/used', sessionCount: 2 }),
        project({ archived: true, id: 'p_old', label: 'Old', sessionCount: 5 }),
        project({ id: '/scan', isAuto: true, label: 'scan', path: '/scan', sessionCount: 0 }),
        home
      ]
    })

    expect(projects.map(row => row.id)).toEqual(['p_named', '/used'])
  })

  it('keeps a dismissed auto project out', () => {
    const projects = workspacePickerProjects({
      dismissedIds: ['/used'],
      projects: [project({ id: '/used', isAuto: true, label: 'Used repo', path: '/used', sessionCount: 2 })]
    })

    expect(projects).toEqual([])
  })

  it('filters by name or path', () => {
    const projects = [
      project({ id: 'p_tax', label: 'TAXCO', path: '/work/taxco' }),
      project({ id: 'p_w4y', label: 'work4you', path: '/work/work4you' })
    ]

    expect(workspacePickerProjects({ projects, query: 'tax' }).map(row => row.id)).toEqual(['p_tax'])
    expect(workspacePickerProjects({ projects, query: 'work4you' }).map(row => row.id)).toEqual(['p_w4y'])
  })

  it('follows the sidebar order', () => {
    const projects = workspacePickerProjects({
      orderIds: ['p_b', 'p_a'],
      projects: [
        project({ id: 'p_a', label: 'A', sessionCount: 1 }),
        project({ id: 'p_b', label: 'B', sessionCount: 1 })
      ]
    })

    expect(projects.map(row => row.id)).toEqual(['p_b', 'p_a'])
  })
})

describe('activeWorkspaceProjectId', () => {
  it('prefers the entered project over the cwd name', () => {
    const projects = [
      project({ id: 'p_a', label: 'A', path: '/a' }),
      project({ id: '/auto', isAuto: true, label: 'Auto', path: '/auto' })
    ]

    expect(activeWorkspaceProjectId({ cwd: '/a', projects, scope: '/auto' })).toBe('/auto')
    expect(activeWorkspaceProjectId({ cwd: '/a/src', projects, scope: '__all_projects__' })).toBe('p_a')
  })
})

describe('createWorkspacePaletteHandlers', () => {
  it('reuses Open folder, New project, select, and clear store actions', () => {
    const wired = createWorkspacePaletteHandlers()

    wired.openFolder()
    wired.newProject()
    wired.selectProject('p_tax')
    wired.clearActive()

    expect(openFolderAsProject).toHaveBeenCalledOnce()
    expect(openProjectCreate).toHaveBeenCalledOnce()
    expect(selectWorkspaceProject).toHaveBeenCalledWith('p_tax')
    expect(clearActiveWorkspace).toHaveBeenCalledOnce()
  })
})
