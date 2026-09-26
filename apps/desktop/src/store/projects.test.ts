import { atom } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NO_PROJECT_ID, type SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { $sidebarAgentsGrouped, setSidebarAgentsGrouped } from '@/store/layout'
import { $activeGatewayProfile } from '@/store/profile'
import {
  $activeSessionId,
  $currentCwd,
  $newChatWorkspaceTarget,
  $selectedStoredSessionId,
  $sessions,
  applyConfiguredDefaultProjectDir,
  setCurrentCwd,
  setNewChatWorkspaceTarget
} from '@/store/session'
import type { ProjectInfo } from '@/types/work4you'

import {
  $activeProjectId,
  $projects,
  $projectScope,
  $projectsRpcAvailable,
  $projectTree,
  $removedSessionIds,
  $sessionMutationsInFlight,
  $startWorkSessionRequest,
  $worktreeRefreshToken,
  ALL_PROJECTS,
  assembleDesktopProjectTree,
  beginSessionMutation,
  clearActiveWorkspace,
  createProject,
  deleteProject,
  endSessionMutation,
  enterProject,
  exitProjectScope,
  goToProject,
  openProjectCreate,
  pickProjectFolder,
  projectIdForCwd,
  projectNameForCwd,
  refreshProjects,
  refreshProjectTree,
  refreshWorktrees,
  resolveCreateSessionCwd,
  resolveNewSessionCwd,
  scanAndRecordRepos,
  selectWorkspaceProject,
  startWorkInRepo,
  tombstoneSessions
} from './projects'

vi.mock('@/i18n', () => ({
  translateNow: (key: string) => key
}))

vi.mock('@/store/notifications', () => ({
  notify: vi.fn()
}))

vi.mock('@/lib/desktop-fs', () => ({
  desktopDefaultCwd: vi.fn(),
  isDesktopFsRemoteMode: vi.fn(),
  selectLocalDesktopPaths: vi.fn(),
  writeDesktopFileText: vi.fn()
}))

vi.mock('@/store/gateway', () => ({
  $gateway: atom(null),
  activeGateway: vi.fn(),
  ensureActiveGatewayOpen: vi.fn()
}))

vi.mock('@/lib/desktop-git', async importOriginal => ({
  ...((await importOriginal()) as Record<string, unknown>),
  desktopGit: vi.fn()
}))

vi.mock('@/work4you', () => ({
  getWork4YouConfig: vi.fn(),
  getProfiles: vi.fn(),
  setApiRequestProfile: vi.fn(),
  STARTUP_REQUEST_TIMEOUT_MS: 1000
}))

const fs = await import('@/lib/desktop-fs')
const isDesktopFsRemoteMode = vi.mocked(fs.isDesktopFsRemoteMode)
const selectLocalDesktopPaths = vi.mocked(fs.selectLocalDesktopPaths)

const gw = await import('@/store/gateway')
const activeGateway = vi.mocked(gw.activeGateway)
const gatewayAtom = gw.$gateway

const git = await import('@/lib/desktop-git')
const desktopGit = vi.mocked(git.desktopGit)

const work4you = await import('@/work4you')
const getWork4YouConfig = vi.mocked(work4you.getWork4YouConfig)
const notifications = await import('@/store/notifications')
const notify = vi.mocked(notifications.notify)

describe('resolveCreateSessionCwd', () => {
  beforeEach(() => {
    $projectScope.set(ALL_PROJECTS)
    $projectTree.set([])
    setCurrentCwd('')
    setNewChatWorkspaceTarget(undefined)
  })

  it('uses the entered project folder when the open conversation sits somewhere else', () => {
    $projectTree.set([
      {
        id: 'p_app',
        label: 'Dute-app',
        path: '/work/Dute-app',
        repos: [
          {
            groups: [],
            id: '/work/Dutelog',
            label: 'Dutelog',
            path: '/work/Dutelog',
            sessionCount: 0
          }
        ],
        sessionCount: 0
      }
    ])
    $projectScope.set('p_app')
    setCurrentCwd('/work/Dutelog')

    expect(resolveCreateSessionCwd()).toBe('/work/Dute-app')
  })

  it('keeps a folder that already sits inside the entered project', () => {
    $projectTree.set([
      {
        id: 'p_app',
        label: 'Dute-app',
        path: '/work/Dute-app',
        repos: [],
        sessionCount: 0
      }
    ])
    $projectScope.set('p_app')
    setCurrentCwd('/work/Dute-app/src')

    expect(resolveCreateSessionCwd()).toBe('/work/Dute-app/src')
  })

  it('keeps the live cwd when no project is selected', () => {
    setCurrentCwd('/remote/worktree')

    expect(resolveCreateSessionCwd()).toBe('/remote/worktree')
  })

  it('uses the entered project folder when the one-shot target was cleared', () => {
    $projectTree.set([
      {
        id: 'p_app',
        label: 'Dute-app',
        path: '/work/Dute-app',
        repos: [],
        sessionCount: 0
      }
    ])
    $projectScope.set('p_app')
    setCurrentCwd('/opt/work4you')
    setNewChatWorkspaceTarget(null)

    expect(resolveCreateSessionCwd()).toBe('/work/Dute-app')
  })

  it('stays detached when Home is selected', () => {
    $projectScope.set(NO_PROJECT_ID)
    setCurrentCwd('/work/Dutelog')
    setNewChatWorkspaceTarget(null)

    expect(resolveCreateSessionCwd()).toBe('')
  })
})

describe('select workspace project', () => {
  beforeEach(() => {
    window.localStorage.clear()
    $projectScope.set(ALL_PROJECTS)
    $projectTree.set([])
    $selectedStoredSessionId.set(null)
    $activeSessionId.set(null)
    setCurrentCwd('')
    setNewChatWorkspaceTarget(undefined)
  })

  it('enters the project and anchors the empty chat at its folder', () => {
    $projectTree.set([
      {
        id: 'p_dute',
        label: 'DuteLog',
        path: '/repos/dute',
        repos: [],
        sessionCount: 2
      }
    ])

    selectWorkspaceProject('p_dute')

    expect($projectScope.get()).toBe('p_dute')
    expect($currentCwd.get()).toBe('/repos/dute')
    expect($newChatWorkspaceTarget.get()).toBe('/repos/dute')
  })

  it('does not retarget the cwd of an open conversation', () => {
    $projectTree.set([
      {
        id: 'p_dute',
        label: 'DuteLog',
        path: '/repos/dute',
        repos: [],
        sessionCount: 2
      }
    ])
    $selectedStoredSessionId.set('sess-1')
    setCurrentCwd('/repos/current')

    selectWorkspaceProject('p_dute')

    expect($projectScope.get()).toBe('p_dute')
    expect($currentCwd.get()).toBe('/repos/current')
    expect($newChatWorkspaceTarget.get()).toBe('/repos/dute')
    expect(resolveCreateSessionCwd()).toBe('/repos/dute')
  })

  it('ignores a project that has no folder', () => {
    $projectTree.set([
      {
        id: 'p_empty',
        label: 'Empty',
        path: null,
        repos: [],
        sessionCount: 0
      }
    ])

    selectWorkspaceProject('p_empty')

    expect($projectScope.get()).toBe(ALL_PROJECTS)
    expect($currentCwd.get()).toBe('')
  })

  it('clears the scope and detaches the draft', () => {
    $projectTree.set([
      {
        id: 'p_dute',
        label: 'DuteLog',
        path: '/repos/dute',
        repos: [],
        sessionCount: 2
      }
    ])
    selectWorkspaceProject('p_dute')

    clearActiveWorkspace()

    expect($projectScope.get()).toBe(ALL_PROJECTS)
    expect($currentCwd.get()).toBe('')
    expect($newChatWorkspaceTarget.get()).toBeNull()
  })
})

describe('deleteProject', () => {
  beforeEach(() => {
    window.localStorage.clear()
    $projectScope.set(ALL_PROJECTS)
    $projectTree.set([])
    $projects.set([])
    $activeProjectId.set(null)
    $selectedStoredSessionId.set(null)
    $activeSessionId.set(null)
    setCurrentCwd('')
    setNewChatWorkspaceTarget(undefined)
    $projectsRpcAvailable.set(true)
  })

  it('drops the saved project and detaches the empty chat that was using it', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'projects.delete') {
        return { active_id: null, projects: [] }
      }

      return {
        active_id: null,
        projects: [
          {
            id: '/repos/dute',
            isAuto: true,
            label: 'dute',
            path: '/repos/dute',
            repos: [],
            sessionCount: 2
          }
        ],
        scoped_session_ids: []
      }
    })

    activeGateway.mockReturnValue({ connectionState: 'open', request } as never)
    $projectTree.set([
      {
        id: 'p_dute',
        label: 'DuteLog',
        path: '/repos/dute',
        repos: [],
        sessionCount: 2
      }
    ])
    selectWorkspaceProject('p_dute')

    await deleteProject('p_dute')

    expect($projectTree.get().some(project => project.id === 'p_dute')).toBe(false)
    expect($projectScope.get()).toBe(ALL_PROJECTS)
    expect($currentCwd.get()).toBe('')
    expect($newChatWorkspaceTarget.get()).toBeNull()
  })
})

describe('project scope', () => {
  beforeEach(() => {
    window.localStorage.clear()
    $projectScope.set(ALL_PROJECTS)
  })

  it('defaults to ALL_PROJECTS', () => {
    expect($projectScope.get()).toBe(ALL_PROJECTS)
  })

  it('enterProject scopes the sidebar to the project id', () => {
    // setActiveProject fires best-effort (no gateway in test → it rejects and is
    // swallowed); the synchronous scope change is what matters here.
    enterProject('p_123')
    expect($projectScope.get()).toBe('p_123')
  })

  it('exitProjectScope returns to the overview', () => {
    enterProject('p_123')
    exitProjectScope()
    expect($projectScope.get()).toBe(ALL_PROJECTS)
  })

  it('entering the synthetic Home bucket still scopes (no active pin)', () => {
    enterProject(NO_PROJECT_ID)
    expect($projectScope.get()).toBe(NO_PROJECT_ID)
  })

  it('persists the scope to localStorage', () => {
    enterProject('p_abc')
    expect(window.localStorage.getItem('work4you.desktop.projectScope')).toBe('p_abc')
  })

  it('goToProject enters the project and flips the sidebar into grouped mode', () => {
    setSidebarAgentsGrouped(false)
    goToProject('p_123')
    expect($projectScope.get()).toBe('p_123')
    expect($sidebarAgentsGrouped.get()).toBe(true)
  })

  it('goToProject with newSession anchors a draft at the project root', () => {
    $startWorkSessionRequest.set(null)
    $projectTree.set([
      {
        id: 'p_demo',
        label: 'Demo',
        path: '/srv/demo',
        repos: [],
        sessionCount: 0
      }
    ])

    goToProject('p_demo', { newSession: true })

    expect($projectScope.get()).toBe('p_demo')
    expect($startWorkSessionRequest.get()?.path).toBe('/srv/demo')
    expect($startWorkSessionRequest.get()?.openTab).toBe(true)
  })
})

describe('resolveNewSessionCwd', () => {
  beforeEach(() => {
    $projectScope.set(ALL_PROJECTS)
    applyConfiguredDefaultProjectDir('/home/user/configured')
    $currentCwd.set('')
    $selectedStoredSessionId.set(null)
    $sessions.set([])
    // Reset focused-session projections by clearing the inputs they read.
    // $focusedStoredSessionId falls back to $selectedStoredSessionId.
    // $focusedSessionState needs a runtime — leave it empty via no session states.
  })

  afterEach(() => {
    applyConfiguredDefaultProjectDir(null)
    $projectScope.set(ALL_PROJECTS)
    $currentCwd.set('')
    $selectedStoredSessionId.set(null)
    $sessions.set([])
  })

  it('starts a chat detached inside Home, ignoring the configured default dir', () => {
    // Attaching the default dir here would move the new chat out of Home the
    // moment it was created — "no folder" is what the bucket means.
    enterProject(NO_PROJECT_ID)

    expect(resolveNewSessionCwd()).toBe('')
  })

  it('still falls back to the configured default outside Home', () => {
    expect(resolveNewSessionCwd()).toBe('/home/user/configured')
  })

  it('does not inherit the focused session workspace — new chat uses the configured default', () => {
    // Regression for #71873 / #80213: after a restart the focused session is
    // usually the just-resumed one, whose stored cwd can be a stale fallback
    // (e.g. the user's home dir on Windows). A new chat must NOT land there —
    // it falls through to the configured default project dir.
    $selectedStoredSessionId.set('sess-a')
    $sessions.set([
      {
        archived: false,
        cwd: 'C:\\Users\\sonny',
        ended_at: null,
        id: 'sess-a',
        input_tokens: 0,
        is_active: true,
        last_active: 0,
        message_count: 1,
        model: null,
        output_tokens: 0,
        started_at: 0,
        title: 'work'
      } as never
    ])

    expect(resolveNewSessionCwd()).toBe('/home/user/configured')
  })

  it('does not re-attach a remembered cwd when the focused session is detached', () => {
    $currentCwd.set('/Users/me/stale-remembered')
    $selectedStoredSessionId.set('sess-detached')
    $sessions.set([
      {
        archived: false,
        cwd: null,
        ended_at: null,
        id: 'sess-detached',
        input_tokens: 0,
        is_active: true,
        last_active: 0,
        message_count: 1,
        model: null,
        output_tokens: 0,
        started_at: 0,
        title: 'loose'
      } as never
    ])

    // Focused session has no workspace → fall through to configured default,
    // not the stale $currentCwd from an earlier chat.
    expect(resolveNewSessionCwd()).toBe('/home/user/configured')
  })
})

describe('projectNameForCwd', () => {
  const treeNode = (
    over: Partial<SidebarProjectTree> & Pick<SidebarProjectTree, 'id' | 'label'>
  ): SidebarProjectTree => ({
    path: null,
    repos: [],
    sessionCount: 0,
    ...over
  })

  beforeEach(() => {
    $projectTree.set([])
  })

  it('names the explicit project owning the cwd (longest path match)', () => {
    $projectTree.set([
      treeNode({ id: 'p_web', label: 'Website', path: '/repos/website' }),
      treeNode({ id: 'p_api', label: 'API', path: '/repos/api' })
    ])

    expect(projectNameForCwd('/repos/website/src/app')).toBe('Website')
  })

  it('matches nested repo and worktree paths, not just the project root', () => {
    $projectTree.set([
      treeNode({
        id: 'p_mono',
        label: 'Monorepo',
        path: '/repos/mono',
        repos: [
          {
            id: 'r1',
            label: 'mono',
            path: '/repos/mono',
            sessionCount: 0,
            groups: [{ id: 'g1', label: 'feature', path: '/elsewhere/mono-feature', sessions: [] }]
          }
        ]
      })
    ])

    // A linked worktree lives OUTSIDE the project root but still belongs to it.
    expect(projectNameForCwd('/elsewhere/mono-feature/src')).toBe('Monorepo')
  })

  it('matches nested Windows paths across separator and case differences', () => {
    $projectTree.set([treeNode({ id: 'p_win', label: 'Windows app', path: 'C:\\Repos\\App' })])

    expect(projectIdForCwd('c:/repos/app/src')).toBe('p_win')
    expect(projectNameForCwd('c:/repos/app/src')).toBe('Windows app')
  })

  it('ignores auto-projects and the No-project bucket (no named identity)', () => {
    $projectTree.set([
      treeNode({ id: '/repos/loose', label: 'loose', path: '/repos/loose', isAuto: true }),
      treeNode({ id: '__no_project__', label: 'No project', path: null, isNoProject: true })
    ])

    expect(projectNameForCwd('/repos/loose/src')).toBeNull()
  })

  it('returns null for a cwd in no project and for a blank cwd', () => {
    $projectTree.set([treeNode({ id: 'p_web', label: 'Website', path: '/repos/website' })])

    expect(projectNameForCwd('/somewhere/else')).toBeNull()
    expect(projectNameForCwd('')).toBeNull()
  })
})

describe('worktree refresh', () => {
  it('refreshWorktrees bumps the probe token so useRepoWorktreeMap refetches', () => {
    const before = $worktreeRefreshToken.get()
    refreshWorktrees()
    expect($worktreeRefreshToken.get()).toBe(before + 1)
  })
})

describe('startWorkInRepo remote capability gate (#81724)', () => {
  it('names the stale-backend remedy when a remote gateway lacks the worktree route', async () => {
    isDesktopFsRemoteMode.mockReturnValue(true)
    desktopGit.mockReturnValue({
      worktreeAdd: vi.fn(async () => {
        throw new Error(
          'Expected JSON from https://vps/api/git/worktree/add but got HTML (status 404). The endpoint is likely missing on the Work4You backend.'
        )
      })
    } as never)

    // The i18n mock echoes keys, so the surfaced error is the catalog key.
    await expect(startWorkInRepo('/srv/repo', { branch: 'x' })).rejects.toThrow('sidebar.projects.worktreeStaleBackend')
  })

  it('re-throws real git failures untouched (a remote 400 is not a capability verdict)', async () => {
    isDesktopFsRemoteMode.mockReturnValue(true)
    desktopGit.mockReturnValue({
      worktreeAdd: vi.fn(async () => {
        throw new Error("400: fatal: 'stale' is not a commit")
      })
    } as never)

    await expect(startWorkInRepo('/srv/repo', { branch: 'x' })).rejects.toThrow('not a commit')
  })
})

describe('pickProjectFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the computer directory picker locally', async () => {
    isDesktopFsRemoteMode.mockReturnValue(false)
    selectLocalDesktopPaths.mockResolvedValue(['/local/repo'])

    await expect(pickProjectFolder()).resolves.toBe('/local/repo')
    expect(selectLocalDesktopPaths).toHaveBeenCalledWith({ directories: true, multiple: false })
  })

  it('keeps the computer directory picker when the agent is in the cloud', async () => {
    isDesktopFsRemoteMode.mockReturnValue(true)
    selectLocalDesktopPaths.mockResolvedValue(['C:\\Empresas\\DUTELOG'])

    await expect(pickProjectFolder()).resolves.toBe('C:\\Empresas\\DUTELOG')
    expect(selectLocalDesktopPaths).toHaveBeenCalledWith({ directories: true, multiple: false })
  })

  it('returns null when the picker is cancelled (empty selection)', async () => {
    isDesktopFsRemoteMode.mockReturnValue(false)
    selectLocalDesktopPaths.mockResolvedValue([])

    await expect(pickProjectFolder()).resolves.toBeNull()
  })
})

describe('createProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSidebarAgentsGrouped(false)
    $activeProjectId.set(null)
    $projectScope.set(ALL_PROJECTS)
    $projectsRpcAvailable.set(null)
  })

  it('creates the project and flips into the grouped view so a blank slate shows it', async () => {
    const created = { folders: [], id: 'p_new', name: 'Demo', primary_path: '/srv/demo' }

    const request = vi.fn(async (method: string) => {
      if (method === 'projects.create') {
        return { project: created }
      }

      // Reconcile (fire-and-forget) re-reads list + tree; echo the project back
      // so the optimistic state survives instead of being wiped to empty.
      return { active_id: 'p_new', projects: [created], scoped_session_ids: [] }
    })

    activeGateway.mockReturnValue({ connectionState: 'open', request } as never)

    const result = await createProject({ folders: ['/srv/demo'], name: 'Demo', use: true })

    expect(result).toEqual(created)
    expect(request).toHaveBeenCalledWith('projects.create', expect.objectContaining({ name: 'Demo' }))
    expect($sidebarAgentsGrouped.get()).toBe(true)
    expect($activeProjectId.get()).toBe('p_new')
    expect($projectScope.get()).toBe('p_new')
  })

  it('marks the backend stale and surfaces a friendly error when projects.create is missing', async () => {
    activeGateway.mockReturnValue({
      connectionState: 'open',
      request: vi.fn().mockRejectedValue(new Error('unknown method: projects.create'))
    } as never)

    await expect(createProject({ folders: ['/srv/demo'], name: 'Demo' })).rejects.toThrow(
      'sidebar.projects.staleBackend'
    )
    expect($projectsRpcAvailable.get()).toBe(false)
  })
})

describe('projects RPC capability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    $projectsRpcAvailable.set(null)
  })

  it('marks the backend stale when projects.list is missing', async () => {
    activeGateway.mockReturnValue({
      connectionState: 'open',
      request: vi.fn().mockRejectedValue(new Error('unknown method: projects.list'))
    } as never)

    await refreshProjects()

    expect($projectsRpcAvailable.get()).toBe(false)
  })

  it('does not publish a late project list from the previous source', async () => {
    let resolveA: ((value: unknown) => void) | undefined

    const responseA = new Promise(resolve => {
      resolveA = resolve
    })

    const gatewayA = { connectionState: 'open', request: vi.fn(() => responseA) }

    const gatewayB = {
      connectionState: 'open',
      request: vi.fn().mockResolvedValue({ active_id: null, projects: [{ id: 'source-b', name: 'Source B' }] })
    }

    let current = gatewayA

    activeGateway.mockImplementation(() => current as never)
    const pendingA = refreshProjects()

    current = gatewayB
    await refreshProjects()

    resolveA?.({ active_id: null, projects: [{ id: 'source-a', name: 'Source A' }] })
    await pendingA

    expect($projects.get().map(project => project.id)).toEqual(['source-b'])
  })

  it('blocks opening the create dialog once the backend is known stale', () => {
    $projectsRpcAvailable.set(false)

    openProjectCreate()

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', message: 'sidebar.projects.staleBackend' })
    )
  })
})

describe('repository discovery policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    $activeGatewayProfile.set('default')
    isDesktopFsRemoteMode.mockReturnValue(false)
  })

  function gatewayWith(request: ReturnType<typeof vi.fn>) {
    const gateway = { connectionState: 'open', request }
    activeGateway.mockReturnValue(gateway as never)
    gatewayAtom.set(gateway as never)

    return gateway
  }

  it('records disabled policy without invoking the filesystem scanner', async () => {
    const request = vi.fn(async (method: string) =>
      method === 'projects.tree'
        ? { active_id: null, projects: [], scoped_session_ids: [] }
        : { accepted: false, repos: [] }
    )

    gatewayWith(request)
    const scanRepos = vi.fn()
    desktopGit.mockReturnValue({ scanRepos } as never)
    getWork4YouConfig.mockResolvedValue({
      desktop: {
        repo_scan_enabled: false,
        repo_scan_exclude_paths: [],
        repo_scan_roots: []
      }
    })

    await scanAndRecordRepos()

    expect(scanRepos).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledWith('projects.record_repos', {
      discovery_policy: { enabled: false, exclude_paths: [], roots: [] },
      repos: []
    })
  })

  it('passes custom roots and exclusions to Electron and records on the origin gateway', async () => {
    const request = vi.fn(async (method: string) =>
      method === 'projects.tree'
        ? { active_id: null, projects: [], scoped_session_ids: [] }
        : { accepted: true, repos: [] }
    )

    gatewayWith(request)
    const scanRepos = vi.fn().mockResolvedValue([{ label: 'repo', root: '/work/repo' }])
    desktopGit.mockReturnValue({ scanRepos } as never)
    getWork4YouConfig.mockResolvedValue({
      desktop: {
        repo_scan_enabled: true,
        repo_scan_exclude_paths: ['/work/vendor'],
        repo_scan_roots: ['/work']
      }
    })

    await scanAndRecordRepos()

    expect(getWork4YouConfig).toHaveBeenCalledWith('default')
    expect(scanRepos).toHaveBeenCalledWith(['/work'], {
      enabled: true,
      excludePaths: ['/work/vendor']
    })
    expect(request).toHaveBeenCalledWith('projects.record_repos', {
      discovery_policy: {
        enabled: true,
        exclude_paths: ['/work/vendor'],
        roots: ['/work']
      },
      repos: [{ label: 'repo', root: '/work/repo' }]
    })
  })

  it('does not scan the local filesystem for remote connections', async () => {
    isDesktopFsRemoteMode.mockReturnValue(true)
    const scanRepos = vi.fn()
    desktopGit.mockReturnValue({ scanRepos } as never)

    await scanAndRecordRepos(true)

    expect(scanRepos).not.toHaveBeenCalled()
    expect(getWork4YouConfig).not.toHaveBeenCalled()
  })
})

describe('project tree profile isolation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does not publish a late response from the previous profile', async () => {
    let resolveA: ((value: unknown) => void) | undefined

    const responseA = new Promise(resolve => {
      resolveA = resolve
    })

    const gatewayA = { connectionState: 'open', request: vi.fn(() => responseA) }

    const gatewayB = {
      connectionState: 'open',
      request: vi.fn().mockResolvedValue({
        active_id: null,
        projects: [{ id: 'profile-b', label: 'Profile B', path: null, repos: [], sessionCount: 0 }],
        scoped_session_ids: []
      })
    }

    let current = gatewayA
    activeGateway.mockImplementation(() => current as never)
    gatewayAtom.set(gatewayA as never)

    const pendingA = refreshProjectTree()
    current = gatewayB
    $activeGatewayProfile.set('profile-b')
    gatewayAtom.set(gatewayB as never)
    await refreshProjectTree()
    resolveA?.({
      active_id: null,
      projects: [{ id: 'profile-a', label: 'Profile A', path: null, repos: [], sessionCount: 0 }],
      scoped_session_ids: []
    })
    await pendingA

    expect($projectTree.get().map(project => project.id)).toEqual(['profile-b'])
  })
})

describe('tombstone pruning', () => {
  const openGatewayReturning = (scopedIds: string[]) => {
    const gateway = {
      connectionState: 'open',
      request: vi.fn().mockResolvedValue({ active_id: null, projects: [], scoped_session_ids: scopedIds })
    }

    activeGateway.mockImplementation(() => gateway as never)
    gatewayAtom.set(gateway as never)

    return gateway
  }

  beforeEach(() => {
    $removedSessionIds.set(new Set())
    $sessionMutationsInFlight.set(new Set())
  })

  it('keeps an in-flight delete tombstone even when the backend snapshot omits it', async () => {
    // Optimistic delete: hide the row, mark the RPC as in flight.
    tombstoneSessions(['sess-1'])
    beginSessionMutation(['sess-1'])

    // A projects.tree refresh races the pending delete: the id is already gone
    // from scope, but the RPC hasn't landed — the tombstone must survive so the
    // row doesn't flash back.
    openGatewayReturning([])
    await refreshProjectTree()

    expect($removedSessionIds.get().has('sess-1')).toBe(true)
  })

  it('prunes the tombstone once the mutation settles and scope no longer lists it', async () => {
    tombstoneSessions(['sess-1'])
    beginSessionMutation(['sess-1'])
    openGatewayReturning([])
    await refreshProjectTree()

    // Delete RPC settled; the next refresh with the id absent from scope drops it.
    endSessionMutation(['sess-1'])
    await refreshProjectTree()

    expect($removedSessionIds.get().has('sess-1')).toBe(false)
  })
})

describe('assembleDesktopProjectTree', () => {
  const catalogProject = (id: string, path: string): ProjectInfo => ({
    archived: false,
    board_slug: null,
    color: null,
    created_at: 0,
    description: null,
    folders: [{ added_at: 0, is_primary: true, label: null, path }],
    icon: null,
    id,
    name: id,
    primary_path: path,
    slug: id
  })

  const node = (id: string, path: string | null, extra: Partial<SidebarProjectTree> = {}): SidebarProjectTree => ({
    id,
    label: id,
    path,
    repos: [],
    sessionCount: 0,
    ...extra
  })

  const home = node(NO_PROJECT_ID, null, { isNoProject: true, label: 'Home' })

  it('shows one computer project on Cloud and drops the VM copy', () => {
    const tree = assembleDesktopProjectTree(
      [node('vm-dute', '/opt/work4you/attached/Dute-app'), home],
      [catalogProject('p_dute', 'C:/work/Dute-app')],
      true
    )

    expect(tree.map(row => row.id)).toEqual(['p_dute', NO_PROJECT_ID])
  })

  it('keeps the local project row and its Home bucket', () => {
    const tree = assembleDesktopProjectTree(
      [node('p_dute', 'C:/work/Dute-app'), node('vm-log', '/opt/work4you/attached/Dutelogs'), home],
      [catalogProject('p_dute', 'C:/work/Dute-app')],
      false
    )

    expect(tree.map(row => row.id)).toEqual(['p_dute', NO_PROJECT_ID])
  })
})
