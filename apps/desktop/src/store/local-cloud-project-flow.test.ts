import { beforeEach, describe, expect, it } from 'vitest'

import { liveSessionProjectId, NO_PROJECT_ID } from '@/app/chat/sidebar/projects/workspace-groups'
import { CloudFolderCopyError, resolveSessionCreateCwd } from '@/lib/desktop-fs'
import { $connection, setNewChatWorkspaceTarget } from '@/store/session'
import { makeSessionInfo } from '@/test/session-info'
import type { ProjectInfo } from '@/types/work4you'

import { $projectScope, $projectTree, assembleDesktopProjectTree, resolveCreateSessionCwd } from './projects'
import { rememberSessionProject, withStoredProjectId } from './session-projects'

const dute = {
  archived: false,
  board_slug: null,
  color: null,
  created_at: 0,
  description: null,
  folders: [{ added_at: 0, is_primary: true, label: null, path: 'C:/work/Dute-app' }],
  icon: null,
  id: 'p_dute',
  name: 'Dute-app',
  primary_path: 'C:/work/Dute-app',
  slug: 'dute-app'
} satisfies ProjectInfo

describe('local and cloud share one project', () => {
  beforeEach(() => {
    localStorage.clear()
    $connection.set(null)
    setNewChatWorkspaceTarget(null)
    $projectScope.set('p_dute')
    $projectTree.set([
      {
        id: 'p_dute',
        label: 'Dute-app',
        path: 'C:/work/Dute-app',
        repos: [],
        sessionCount: 0
      }
    ])
  })

  it('follows the video: one Dute-app, chats stay in it, Cloud does not edit the computer path', async () => {
    const home = {
      id: NO_PROJECT_ID,
      isNoProject: true,
      label: 'Home',
      path: null,
      repos: [],
      sessionCount: 0
    }

    const tree = assembleDesktopProjectTree(
      [
        { id: 'vm-dute', label: 'Dute-app', path: '/opt/work4you/attached/Dute-app', repos: [], sessionCount: 1 },
        { id: 'vm-log', label: 'Dutelogs', path: '/opt/work4you/attached/Dutelogs', repos: [], sessionCount: 1 },
        home
      ],
      [dute],
      true
    )

    expect(tree.map(row => row.label)).toEqual(['Dute-app', 'Home'])
    expect(tree[0]?.repos[0]?.path).toBe('C:/work/Dute-app')

    const born = makeSessionInfo({ connection_id: 'local', id: 'greet-1' })

    rememberSessionProject(born, 'p_dute')

    const afterRefresh = withStoredProjectId(makeSessionInfo({ connection_id: 'local', cwd: '', id: 'greet-1' }))

    expect(liveSessionProjectId(afterRefresh, [dute])).toBe('p_dute')
    expect(resolveCreateSessionCwd()).toBe('C:/work/Dute-app')

    $connection.set({ mode: 'remote', remoteKind: 'cloud' } as never)
    await expect(resolveSessionCreateCwd('C:/work/Dute-app')).rejects.toBeInstanceOf(CloudFolderCopyError)
  })
})
