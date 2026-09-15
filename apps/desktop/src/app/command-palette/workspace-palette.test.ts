import { describe, expect, it, vi } from 'vitest'

import {
  buildWorkspacePaletteGroups,
  runWorkspaceRemoteAction,
  WORKSPACE_NEW_PROJECT_ID,
  WORKSPACE_OPEN_FOLDER_ID,
  WORKSPACE_REMOTE_ID,
  workspaceProjectItemId,
  workspaceRemoteTarget
} from './workspace-palette'

const copy = {
  newProject: 'New project',
  newSessionInProject: (project: string) => `New session in ${project}`,
  openFolder: 'Open folder as project…',
  projects: 'Projects',
  remote: 'Remote…'
}

function handlers() {
  return {
    goToProject: vi.fn(),
    newProject: vi.fn(),
    openFolder: vi.fn(),
    openRemote: vi.fn()
  }
}

describe('buildWorkspacePaletteGroups', () => {
  it('pins Open folder, Remote, and New project above recents, including Home', () => {
    const groups = buildWorkspacePaletteGroups(
      [
        { id: '__none__', isNoProject: true, label: 'Home' },
        { icon: 'folder-library', id: 'p_demo', label: 'Demo', path: '/work/demo' }
      ],
      copy,
      handlers()
    )

    expect(groups.map(group => group.heading)).toEqual([undefined, 'Projects'])
    expect(groups[0]?.items.map(item => item.id)).toEqual([
      WORKSPACE_OPEN_FOLDER_ID,
      WORKSPACE_REMOTE_ID,
      WORKSPACE_NEW_PROJECT_ID
    ])
    expect(groups[1]?.items.map(item => item.id)).toEqual([
      workspaceProjectItemId('__none__'),
      workspaceProjectItemId('p_demo')
    ])
    expect(groups[0]?.items.some(item => item.isNoProject)).toBe(false)
    expect(groups[1]?.items[0]).toMatchObject({ isNoProject: true, kind: 'project', label: 'Home' })
  })

  it('omits the recents group when the tree is empty', () => {
    const groups = buildWorkspacePaletteGroups([], copy, handlers())

    expect(groups).toHaveLength(1)
    expect(groups[0]?.items.map(item => item.kind)).toEqual(['open-folder', 'remote', 'new-project'])
  })

  it('wires existing store actions without inventing a Home row', () => {
    const wired = handlers()

    const groups = buildWorkspacePaletteGroups(
      [
        { id: 'p_demo', label: 'Demo', path: '/work/demo' },
        { id: '__none__', isNoProject: true, label: 'Home' }
      ],
      copy,
      wired
    )

    groups[0]?.items[0]?.run?.()
    groups[0]?.items[1]?.run?.()
    groups[0]?.items[2]?.run?.()
    groups[1]?.items[0]?.runWithEvent?.()
    groups[1]?.items[0]?.runWithEvent?.({ metaKey: true })

    expect(wired.openFolder).toHaveBeenCalledOnce()
    expect(wired.openRemote).toHaveBeenCalledOnce()
    expect(wired.newProject).toHaveBeenCalledOnce()
    expect(wired.goToProject).toHaveBeenNthCalledWith(1, 'p_demo', { newSession: false })
    expect(wired.goToProject).toHaveBeenNthCalledWith(2, 'p_demo', { newSession: true })
    expect(groups.flatMap(group => group.items).filter(item => item.label === 'Home')).toHaveLength(1)
  })

  it('keeps Open folder on the existing keybind and project rows on ⌘-Enter', () => {
    const demo = buildWorkspacePaletteGroups([{ id: 'p_demo', label: 'Demo', path: '/work/demo' }], copy, handlers())[1]
      ?.items[0]

    expect(buildWorkspacePaletteGroups([], copy, handlers())[0]?.items[0]).toMatchObject({
      action: 'workspace.openFolder',
      kind: 'open-folder',
      label: copy.openFolder
    })
    expect(demo).toMatchObject({
      comboHint: 'mod+enter',
      kind: 'project',
      modLabel: 'New session in Demo'
    })
    expect(demo?.keywords).toEqual(expect.arrayContaining(['Demo', '/work/demo', 'workspace']))
  })

  it('keeps a Remote row that is not a second recents list', () => {
    const groups = buildWorkspacePaletteGroups([], copy, handlers())
    const remote = groups[0]?.items[1]

    expect(remote).toMatchObject({
      id: WORKSPACE_REMOTE_ID,
      kind: 'remote',
      label: copy.remote
    })
    expect(remote?.keywords).toEqual(expect.arrayContaining(['remote', 'gateway', 'ssh']))
    expect(groups[0]?.items.filter(item => item.kind === 'remote')).toHaveLength(1)
  })
})

describe('runWorkspaceRemoteAction', () => {
  it('opens the remote folder picker when the live connection is already remote', () => {
    const openGatewaySettings = vi.fn()
    const openRemoteFolder = vi.fn()

    expect(workspaceRemoteTarget(true)).toBe('open-remote-folder')
    runWorkspaceRemoteAction(true, { openGatewaySettings, openRemoteFolder })

    expect(openRemoteFolder).toHaveBeenCalledOnce()
    expect(openGatewaySettings).not.toHaveBeenCalled()
  })

  it('deep-links to Settings → Gateway when the connection is still local', () => {
    const openGatewaySettings = vi.fn()
    const openRemoteFolder = vi.fn()

    expect(workspaceRemoteTarget(false)).toBe('gateway-settings')
    runWorkspaceRemoteAction(false, { openGatewaySettings, openRemoteFolder })

    expect(openGatewaySettings).toHaveBeenCalledOnce()
    expect(openRemoteFolder).not.toHaveBeenCalled()
  })
})
