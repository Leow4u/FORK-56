import { afterEach, describe, expect, it, vi } from 'vitest'

import { openFolderAsProject, openProjectCreate } from '@/store/projects'

import {
  buildWorkspacePaletteGroups,
  createWorkspacePaletteHandlers,
  WORKSPACE_NEW_PROJECT_ID,
  WORKSPACE_OPEN_FOLDER_ID
} from './workspace-palette'

vi.mock('@/store/projects', () => ({
  openFolderAsProject: vi.fn(async () => undefined),
  openProjectCreate: vi.fn()
}))

afterEach(() => {
  vi.mocked(openFolderAsProject).mockClear()
  vi.mocked(openProjectCreate).mockClear()
})

const copy = {
  newProject: 'New project',
  openFolder: 'Open folder as project…'
}

function handlers() {
  return {
    newProject: vi.fn(),
    openFolder: vi.fn()
  }
}

describe('buildWorkspacePaletteGroups', () => {
  it('pins Open folder and New project without a Remote row or a second project tree', () => {
    const groups = buildWorkspacePaletteGroups(copy, handlers())

    expect(groups).toHaveLength(1)
    expect(groups[0]?.heading).toBeUndefined()
    expect(groups[0]?.items.map(item => item.id)).toEqual([WORKSPACE_OPEN_FOLDER_ID, WORKSPACE_NEW_PROJECT_ID])
    expect(groups[0]?.items.map(item => item.kind)).toEqual(['open-folder', 'new-project'])
    expect(groups[0]?.items.some(item => item.id === 'project-remote')).toBe(false)
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
})

describe('createWorkspacePaletteHandlers', () => {
  it('reuses Open folder and New project store actions', () => {
    const handlers = createWorkspacePaletteHandlers()

    handlers.openFolder()
    handlers.newProject()

    expect(openFolderAsProject).toHaveBeenCalledOnce()
    expect(openProjectCreate).toHaveBeenCalledOnce()
  })
})
