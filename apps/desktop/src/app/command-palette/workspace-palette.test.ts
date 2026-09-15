import { describe, expect, it, vi } from 'vitest'

import {
  buildWorkspacePaletteGroups,
  runWorkspaceRemoteAction,
  WORKSPACE_NEW_PROJECT_ID,
  WORKSPACE_OPEN_FOLDER_ID,
  WORKSPACE_REMOTE_ID,
  workspaceRemoteTarget
} from './workspace-palette'

const copy = {
  newProject: 'New project',
  openFolder: 'Open folder as project…',
  remote: 'Remote…'
}

function handlers() {
  return {
    newProject: vi.fn(),
    openFolder: vi.fn(),
    openRemote: vi.fn()
  }
}

describe('buildWorkspacePaletteGroups', () => {
  it('pins Open folder, Remote, and New project without a second project tree', () => {
    const groups = buildWorkspacePaletteGroups(copy, handlers())

    expect(groups).toHaveLength(1)
    expect(groups[0]?.heading).toBeUndefined()
    expect(groups[0]?.items.map(item => item.id)).toEqual([
      WORKSPACE_OPEN_FOLDER_ID,
      WORKSPACE_REMOTE_ID,
      WORKSPACE_NEW_PROJECT_ID
    ])
    expect(groups[0]?.items.map(item => item.kind)).toEqual(['open-folder', 'remote', 'new-project'])
  })

  it('wires existing store actions', () => {
    const wired = handlers()
    const groups = buildWorkspacePaletteGroups(copy, wired)

    groups[0]?.items[0]?.run?.()
    groups[0]?.items[1]?.run?.()
    groups[0]?.items[2]?.run?.()

    expect(wired.openFolder).toHaveBeenCalledOnce()
    expect(wired.openRemote).toHaveBeenCalledOnce()
    expect(wired.newProject).toHaveBeenCalledOnce()
  })

  it('keeps Open folder on the existing keybind', () => {
    expect(buildWorkspacePaletteGroups(copy, handlers())[0]?.items[0]).toMatchObject({
      action: 'workspace.openFolder',
      kind: 'open-folder',
      label: copy.openFolder
    })
  })

  it('keeps a Remote row that is not a recents list', () => {
    const remote = buildWorkspacePaletteGroups(copy, handlers())[0]?.items[1]

    expect(remote).toMatchObject({
      id: WORKSPACE_REMOTE_ID,
      kind: 'remote',
      label: copy.remote
    })
    expect(remote?.keywords).toEqual(expect.arrayContaining(['remote', 'gateway', 'ssh']))
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
