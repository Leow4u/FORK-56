import { describe, expect, it } from 'vitest'

import { makeCwdSession } from '@/test/session-info'
import type { ProjectInfo, SessionInfo } from '@/types/work4you'

import {
  baseName,
  excludeProjectSessions,
  kanbanWorktreeDir,
  liveSessionProjectId,
  NO_PROJECT_ID,
  overlayLivePreviews,
  sessionProjectColor,
  type SidebarProjectTree,
  type SidebarSessionGroup
} from './workspace-groups'

// The grouping itself now lives on the backend (tui_gateway/project_tree.py,
// covered by tests/tui_gateway/test_project_tree.py). This file only covers the
// thin render helpers the desktop still owns.

const lane = (over: Partial<SidebarSessionGroup> & Pick<SidebarSessionGroup, 'id' | 'label'>): SidebarSessionGroup => ({
  path: null,
  sessions: [],
  ...over
})

describe('baseName', () => {
  it('returns the final path segment, ignoring trailing slashes and separators', () => {
    expect(baseName('/www/work4you/')).toBe('work4you')
    expect(baseName('C:\\repos\\app')).toBe('app')
    expect(baseName('')).toBeUndefined()
  })
})

describe('kanbanWorktreeDir', () => {
  it('matches a kanban task worktree (t_<hex>) and returns its .worktrees dir', () => {
    expect(kanbanWorktreeDir('/repo/.worktrees/t_aaaaaaaa')).toBe('/repo/.worktrees')
  })

  it('does NOT match a user-named "New worktree" under .worktrees/ (its own lane)', () => {
    expect(kanbanWorktreeDir('/repo/.worktrees/test-gui-stuff')).toBeNull()
  })

  it('returns null for non-kanban paths', () => {
    expect(kanbanWorktreeDir('/repo/src')).toBeNull()
    expect(kanbanWorktreeDir('/repo')).toBeNull()
  })
})

const makeProject = (id: string, folders: string[]): ProjectInfo => ({
  archived: false,
  board_slug: null,
  color: null,
  created_at: 0,
  description: null,
  folders: folders.map((path, i) => ({ added_at: 0, is_primary: i === 0, label: null, path })),
  icon: null,
  id,
  name: id,
  primary_path: folders[0] ?? null,
  slug: id
})

const projectNode = (over: Partial<SidebarProjectTree> & Pick<SidebarProjectTree, 'id'>): SidebarProjectTree => ({
  label: over.id,
  path: over.id,
  repos: [],
  sessionCount: 0,
  ...over
})

// Home as the backend emits it: no path, one synthetic lane carrying the rows.
const homeNode = (sessions: SessionInfo[]): SidebarProjectTree =>
  projectNode({
    id: NO_PROJECT_ID,
    isNoProject: true,
    label: 'Home',
    path: null,
    repos: [
      {
        id: NO_PROJECT_ID,
        label: 'Home',
        path: null,
        sessionCount: sessions.length,
        groups: [lane({ id: NO_PROJECT_ID, label: 'Home', sessions })]
      }
    ],
    sessionCount: sessions.length
  })

describe('liveSessionProjectId', () => {
  it('maps a brand-new (unpersisted) session to its auto project (the repo root)', () => {
    expect(liveSessionProjectId(makeCwdSession('/www/app'), [])).toBe('/www/app')
  })

  it('routes a session under an explicit project folder to that project', () => {
    const id = liveSessionProjectId(makeCwdSession('/www/app/src', { git_repo_root: '/www/app', git_branch: 'feat' }), [
      makeProject('p_app', ['/www/app'])
    ])

    expect(id).toBe('p_app')
  })

  it('anchors a cwd-less session on its git_repo_root (backend groups it there too)', () => {
    // Older/imported rows carry only a repo root; the sidebar files them under
    // the repo's project, so membership (and color) must resolve from the root.
    expect(liveSessionProjectId(makeCwdSession(null, { git_repo_root: '/www/app' }), [])).toBe('/www/app')
    expect(
      liveSessionProjectId(makeCwdSession(null, { git_repo_root: '/www/app' }), [makeProject('p_app', ['/www/app'])])
    ).toBe('p_app')
  })

  it('skips cwd-less, kanban-task, and out-of-tree (sibling) worktree sessions', () => {
    expect(liveSessionProjectId(makeCwdSession(null), [])).toBeNull()
    // Kanban task worktree → folds into the kanban bucket, not a project preview.
    expect(liveSessionProjectId(makeCwdSession('/repo/.worktrees/t_aaaaaaaa'), [])).toBeNull()
    // Sibling worktree OUTSIDE the repo root → project can't be derived from the row.
    expect(liveSessionProjectId(makeCwdSession('/elsewhere/wt', { git_repo_root: '/repo' }), [])).toBeNull()
  })

  it('places an in-tree worktree session under its repo project (the root is in the path)', () => {
    // "Convert a branch" / "new worktree" land at `<repoRoot>/.worktrees/<slug>`,
    // so they belong to the same auto project as the repo root and must show in
    // the overview at once, not wait for the next backend refresh.
    expect(liveSessionProjectId(makeCwdSession('/www/app/.worktrees/test1', { git_repo_root: '/www/app' }), [])).toBe(
      '/www/app'
    )
  })

  it('routes an in-tree worktree session to the owning explicit project', () => {
    const id = liveSessionProjectId(makeCwdSession('/www/app/.worktrees/test1', { git_repo_root: '/www/app' }), [
      makeProject('p_app', ['/www/app'])
    ])

    expect(id).toBe('p_app')
  })

  it('places a cwd-outside-root session under an explicit project matching either path', () => {
    // A mid-session relocation (or a sibling worktree) leaves cwd outside the
    // recorded repo root. An explicit folder match is still authoritative —
    // only the auto-project (repo root) fallback needs cwd-under-root
    // confidence. Match via the repo root...
    expect(
      liveSessionProjectId(makeCwdSession('/www/elsewhere', { git_repo_root: '/home/u/proj' }), [
        makeProject('p_proj', ['/home/u/proj'])
      ])
    ).toBe('p_proj')
    // ...and via the cwd.
    expect(
      liveSessionProjectId(makeCwdSession('/www/elsewhere/sub', { git_repo_root: '/home/u/proj' }), [
        makeProject('p_www', ['/www/elsewhere'])
      ])
    ).toBe('p_www')
  })

  it('matches a mixed-case/separator Windows cwd to its explicit project in the live overlay', () => {
    // The bug: a fresh Windows session drops into the overlay before the next
    // backend refresh; case-sensitive matching missed its project until then.
    const id = liveSessionProjectId(makeCwdSession('c:/work/notes/SUB'), [makeProject('p_notes', ['C:\\Work\\Notes'])])

    expect(id).toBe('p_notes')
  })

  it('matches a root-relative WSL cwd (single backslash) case-insensitively', () => {
    const id = liveSessionProjectId(makeCwdSession('//wsl.localhost/Ubuntu/home/alice/PROJ'), [
      makeProject('p_proj', ['\\wsl.localhost\\Ubuntu\\home\\alice\\proj'])
    ])

    expect(id).toBe('p_proj')
  })

  it('keeps POSIX cwd matching case-sensitive (no false project match)', () => {
    // Distinct case on POSIX is a distinct path → falls back to its own auto id.
    expect(liveSessionProjectId(makeCwdSession('/work/notes'), [makeProject('p_notes', ['/Work/Notes'])])).toBe(
      '/work/notes'
    )
  })

  it('keeps a worktree session in its own project when the git root belongs to a longer path', () => {
    const id = liveSessionProjectId(
      makeCwdSession('/work/Dute-app', { git_repo_root: '/Users/leo/Documents/GitHub/Dutelog' }),
      [makeProject('p_app', ['/work/Dute-app']), makeProject('p_log', ['/Users/leo/Documents/GitHub/Dutelog'])]
    )

    expect(id).toBe('p_app')
  })
})

describe('sessionProjectColor', () => {
  const colored = (id: string, folders: string[], color: string): ProjectInfo => ({
    ...makeProject(id, folders),
    color
  })

  it('inherits the color of the explicit project the session belongs to', () => {
    const session = makeCwdSession('/www/app/src', { git_repo_root: '/www/app' })

    expect(sessionProjectColor(session, [colored('p_app', ['/www/app'], '#4a9eff')])).toBe('#4a9eff')
  })

  it('returns null when the owning project has no color set', () => {
    const session = makeCwdSession('/www/app/src', { git_repo_root: '/www/app' })

    expect(sessionProjectColor(session, [makeProject('p_app', ['/www/app'])])).toBeNull()
  })

  it('colors a cwd-less session by its git_repo_root project (the grouped-but-grey fix)', () => {
    const session = makeCwdSession(null, { git_repo_root: '/www/app' })

    expect(sessionProjectColor(session, [colored('p_app', ['/www/app'], '#4a9eff')])).toBe('#4a9eff')
  })

  it('colors a cwd-outside-root session when an explicit project folder matches', () => {
    // The backend tree groups such a row under the project; the client color
    // derivation must agree instead of leaving the row (and its tab) grey.
    const session = makeCwdSession('/www/elsewhere', { git_repo_root: '/home/u/proj' })

    expect(sessionProjectColor(session, [colored('p_proj', ['/home/u/proj'], '#4a9eff')])).toBe('#4a9eff')
  })

  it('returns null for a session that only maps to an auto repo root (no explicit project)', () => {
    // liveSessionProjectId falls back to the repo root id, which is not a
    // project row and therefore carries no color.
    expect(sessionProjectColor(makeCwdSession('/www/app'), [])).toBeNull()
  })

  it('returns null for an unplaceable (cwd-less) session', () => {
    expect(sessionProjectColor(makeCwdSession(null), [colored('p_app', ['/www/app'], '#4a9eff')])).toBeNull()
  })

  it('uses the longest-prefix project when nested projects both match', () => {
    const session = makeCwdSession('/www/app/packages/api/src', { git_repo_root: '/www/app' })

    const projects = [
      colored('p_root', ['/www/app'], '#111111'),
      colored('p_api', ['/www/app/packages/api'], '#222222')
    ]

    expect(sessionProjectColor(session, projects)).toBe('#222222')
  })
})

describe('overlayLivePreviews', () => {
  it('merges live sessions into a project preview, live first, capped to the limit', () => {
    const project = projectNode({
      id: '/www/app',
      previewSessions: [makeCwdSession('/www/app', { id: 'old', started_at: 1, last_active: 1 })]
    })

    const live = [makeCwdSession('/www/app', { id: 'fresh', started_at: 99, last_active: 99 })]

    const previews = overlayLivePreviews([project], live, [], 3)

    expect(previews['/www/app'].map(s => s.id)).toEqual(['fresh', 'old'])
  })

  it('evicts a deleted session from a project preview (snapshot + live)', () => {
    const project = projectNode({
      id: '/www/app',
      previewSessions: [
        makeCwdSession('/www/app', { id: 'gone', started_at: 5, last_active: 5 }),
        makeCwdSession('/www/app', { id: 'old', started_at: 1, last_active: 1 })
      ]
    })

    const previews = overlayLivePreviews([project], [], [], 3, { removed: new Set(['gone']) })

    expect(previews['/www/app'].map(s => s.id)).toEqual(['old'])
  })

  it('ranks by the active sort key before trimming, so the preview is its top rows', () => {
    const project = projectNode({
      id: '/www/app',
      previewSessions: [
        makeCwdSession('/www/app', { id: 'newest', last_active: 9, started_at: 9 }),
        makeCwdSession('/www/app', { id: 'cheap', last_active: 8, started_at: 8 }),
        makeCwdSession('/www/app', { id: 'priciest', last_active: 1, started_at: 1 })
      ]
    })

    const previews = overlayLivePreviews([project], [], [], 2, { rankIds: ['priciest', 'newest', 'cheap'] })

    expect(previews['/www/app'].map(s => s.id)).toEqual(['priciest', 'newest'])
  })

  it('previews a detached session under Home, which no cwd could place', () => {
    const previews = overlayLivePreviews([homeNode([])], [makeCwdSession(null, { id: 'fresh' })], [], 3)

    expect(previews[NO_PROJECT_ID].map(s => s.id)).toEqual(['fresh'])
  })

  it('keeps a chat the backend filed under Home, even when its cwd names a folder', () => {
    const chat = makeCwdSession('/home/me', { id: 'home-folder' })
    const home = { ...homeNode([chat]), previewSessions: [chat] }

    const previews = overlayLivePreviews([home], [chat], [], 3)

    expect((previews[NO_PROJECT_ID] ?? []).map(s => s.id)).toEqual(['home-folder'])
  })

  it('keeps the full project history when the overlay limit is unbounded', () => {
    const project = projectNode({
      id: '/www/app',
      previewSessions: [
        makeCwdSession('/www/app', { id: 'a', last_active: 3, started_at: 3 }),
        makeCwdSession('/www/app', { id: 'b', last_active: 2, started_at: 2 }),
        makeCwdSession('/www/app', { id: 'c', last_active: 1, started_at: 1 })
      ]
    })

    const previews = overlayLivePreviews(
      [project],
      [makeCwdSession('/www/app', { id: 'd', last_active: 4, started_at: 4 })],
      [],
      Number.POSITIVE_INFINITY
    )

    expect(previews['/www/app'].map(s => s.id)).toEqual(['d', 'a', 'b', 'c'])
  })
})

describe('excludeProjectSessions', () => {
  it('drops matching rows from every lane and recounts the subtree', () => {
    const keep = makeCwdSession('/www/app', { id: 'keep' })
    const pinnedRow = makeCwdSession('/www/app', { id: 'pinned' })

    const project = projectNode({
      id: '/www/app',
      repos: [
        {
          id: '/www/app',
          label: 'app',
          path: '/www/app',
          sessionCount: 2,
          groups: [lane({ id: 'main', isMain: true, label: 'main', path: '/www/app', sessions: [keep, pinnedRow] })]
        }
      ],
      sessionCount: 2
    })

    const filtered = excludeProjectSessions(project, session => session.id === 'pinned')

    expect(filtered.repos[0].groups[0].sessions.map(s => s.id)).toEqual(['keep'])
    expect(filtered.repos[0].sessionCount).toBe(1)
    expect(filtered.sessionCount).toBe(1)
  })

  it('keeps a lane the filter emptied — a worktree is structure, not a row', () => {
    const pinnedRow = makeCwdSession('/www/app/wt', { id: 'pinned' })

    const project = projectNode({
      id: '/www/app',
      previewSessions: [pinnedRow],
      repos: [
        {
          id: '/www/app',
          label: 'app',
          path: '/www/app',
          sessionCount: 1,
          groups: [lane({ id: 'wt', label: 'wt', path: '/www/app/wt', sessions: [pinnedRow] })]
        }
      ],
      sessionCount: 1
    })

    const filtered = excludeProjectSessions(project, session => session.id === 'pinned')

    expect(filtered.repos[0].groups.map(g => g.id)).toEqual(['wt'])
    expect(filtered.repos[0].groups[0].sessions).toEqual([])
    expect(filtered.previewSessions).toEqual([])
    expect(filtered.sessionCount).toBe(0)
  })

  it('returns the same node when nothing matches (memo-stable)', () => {
    const project = projectNode({
      id: '/www/app',
      previewSessions: [makeCwdSession('/www/app', { id: 'keep' })],
      repos: [
        {
          id: '/www/app',
          label: 'app',
          path: '/www/app',
          sessionCount: 1,
          groups: [
            lane({ id: 'main', isMain: true, label: 'main', sessions: [makeCwdSession('/www/app', { id: 'keep' })] })
          ]
        }
      ],
      sessionCount: 1
    })

    expect(excludeProjectSessions(project, () => false)).toBe(project)
  })
})
