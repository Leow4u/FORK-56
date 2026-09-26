import { beforeEach, describe, expect, it } from 'vitest'

import { NO_PROJECT_ID } from '@/app/chat/sidebar/projects/workspace-groups'
import { makeSessionInfo } from '@/test/session-info'
import type { ProjectInfo } from '@/types/work4you'

import { $projectScope, $projectTree, ALL_PROJECTS } from './projects'
import {
  rememberAttachedSessionProjects,
  rememberSessionProject,
  selectedProjectIdForNewChat,
  sessionProjectStorageKey,
  storedSessionProjectId,
  withStoredProjectId
} from './session-projects'

describe('session project memory', () => {
  beforeEach(() => {
    localStorage.clear()
    $projectScope.set(ALL_PROJECTS)
    $projectTree.set([])
  })

  it('keeps Local and Cloud rows of the same id apart', () => {
    expect(sessionProjectStorageKey({ connection_id: 'cloud', id: 'abc' })).toBe('cloud::abc')
    expect(sessionProjectStorageKey({ id: 'abc' })).toBe('local::abc')
  })

  it('restores the project after a refresh that dropped the field', () => {
    const born = makeSessionInfo({ connection_id: 'cloud', id: 'chat-1' })

    rememberSessionProject(born, 'p_dute')

    const refreshed = withStoredProjectId(makeSessionInfo({ connection_id: 'cloud', cwd: '/opt/work4you', id: 'chat-1' }))

    expect(refreshed.desktop_project_id).toBe('p_dute')
    expect(storedSessionProjectId(makeSessionInfo({ connection_id: 'local', id: 'chat-1' }))).toBeNull()
  })

  it('reads the entered project and skips Home and the overview', () => {
    $projectTree.set([
      {
        id: 'p_dute',
        label: 'Dute-app',
        path: 'C:/work/Dute-app',
        repos: [],
        sessionCount: 0
      }
    ])
    $projectScope.set('p_dute')
    expect(selectedProjectIdForNewChat()).toBe('p_dute')

    $projectScope.set(NO_PROJECT_ID)
    expect(selectedProjectIdForNewChat()).toBeNull()

    $projectScope.set(ALL_PROJECTS)
    expect(selectedProjectIdForNewChat()).toBeNull()
  })

  it('adopts a cloud copy into the computer project once', () => {
    const project = {
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
    const session = makeSessionInfo({
      connection_id: 'cloud',
      cwd: '/opt/work4you/.work4you/attached/Dute-app',
      id: 'old-cloud'
    })

    rememberAttachedSessionProjects([session], [project])

    expect(withStoredProjectId(session).desktop_project_id).toBe('p_dute')
  })
})
