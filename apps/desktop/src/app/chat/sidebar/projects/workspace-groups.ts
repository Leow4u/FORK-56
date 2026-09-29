import type { ProjectInfo, SessionInfo } from '@/work4you'

import { rankSessions } from '../order'

// Session grouping is computed authoritatively on the backend
// (`tui_gateway/project_tree.py`, exposed via `projects.tree`). The desktop is
// a thin renderer: this module only holds the render contract (the three tree
// interfaces) plus a few pure helpers. It never decides session membership.

export interface SidebarSessionGroup {
  id: string
  label: string
  path: null | string
  sessions: SessionInfo[]
  // Profile color for the ALL-profiles view; absent for workspace groups.
  color?: null | string
  // True when this group is a repo's main checkout (vs a linked worktree).
  isMain?: boolean
  // True for the repo's primary ("home") checkout lane — the single lane that
  // collapses all main-checkout sessions, labeled by the worktree's LIVE branch
  // (defaulting to `main`). Renders a home glyph and pins to the top.
  isHome?: boolean
  // True for the synthetic lane that collapses all of a repo's kanban task
  // worktrees (`<repo>/.worktrees/t_*`) into one row, so a heavy board doesn't
  // spray hundreds of throwaway branch lanes across the sidebar.
  isKanban?: boolean
  mode?: 'profile' | 'source' | 'workspace'
  sourceId?: string
}

/** A repo node: holds its branch/worktree lanes (`repo -> lane -> sessions`). */
export interface SidebarWorkspaceTree {
  id: string
  label: string
  path: null | string
  groups: SidebarSessionGroup[]
  sessionCount: number
}

/** A project node: human-named (or repo-derived), holds its repo subtree. */
export interface SidebarProjectTree {
  id: string
  label: string
  path: null | string
  color?: null | string
  icon?: null | string
  archived?: boolean
  // A git repo root promoted automatically (not a user-created projects.db row).
  // Deletable = dismissable.
  isAuto?: boolean
  // The synthetic bucket (labeled "Home") holding every session no project
  // claimed. It has no folder, so no repo/worktree structure — its one lane
  // exists only to carry the rows.
  isNoProject?: boolean
  repos: SidebarWorkspaceTree[]
  sessionCount: number
  // Tokens and spend over the same sessions `sessionCount` counts, summed by
  // the backend — the tree only carries a preview of the rows themselves.
  totalTokens?: number
  totalCostUsd?: number
  // Max activity timestamp across the project's sessions (overview sort key).
  lastActive?: number
  // The project's sessions, newest first, up to what `projects.tree` loaded.
  previewSessions?: SessionInfo[]
}

/** Path split into segments, ignoring trailing slashes and mixed separators. */
const segments = (path: string): string[] =>
  path
    .replace(/[/\\]+$/, '')
    .split(/[/\\]/)
    .filter(Boolean)

// Windows spellings: drive-letter (`C:\…`), UNC (`\\srv`, `//srv`), or any
// backslash-rooted path (`\wsl.localhost\…`). A single leading `/` stays POSIX.
// Mirrors the backend `_is_windows_path` so the live overlay places rows into
// the same project the backend tree would.
const isWindowsPath = (path: string): boolean =>
  /^[A-Za-z]:[/\\]/.test(path) || path.startsWith('\\') || path.startsWith('//')

/**
 * Segments for identity comparison: Windows paths fold case (and separators, via
 * {@link segments}) so `C:\Work` and `c:/work` are one lane; POSIX stays
 * case-sensitive. Comparison-only — emitted ids/labels keep their spelling.
 */
const comparisonSegments = (path: string): string[] => {
  const segs = segments(path)

  return isWindowsPath(path) ? segs.map(seg => seg.toLowerCase()) : segs
}

/** Last path segment. */
export const baseName = (path: string): string | undefined => segments(path).pop()

// The `.worktrees` dir for a KANBAN-TASK worktree path, else null. Only matches
// task worktrees (`<repo>/.worktrees/t_<hex>`, the `t_…` id kanban_db mints) so
// the many ephemeral task worktrees collapse into one lane — while user-named
// "New worktree" dirs (`<repo>/.worktrees/<slug>`) stay as their own lanes.
const KANBAN_DIR_RE = /^(.*[/\\]\.worktrees)[/\\]t_[0-9a-f]+[/\\]?$/

export function kanbanWorktreeDir(path: string): null | string {
  return path.match(KANBAN_DIR_RE)?.[1] ?? null
}

/** Id of the Home bucket (must match the backend tree's `NO_PROJECT_ID`). */
export const NO_PROJECT_ID = '__no_project__'

/**
 * A session with nowhere to be placed: no cwd and no recorded repo root. These
 * are the rows the Home bucket owns, and the only ones the live overlay can
 * hand it — a row WITH a cwd that the backend still couldn't place (junk root,
 * deleted workspace) needs the backend's probes, so it waits for the snapshot.
 */
export const isDetachedSession = (session: SessionInfo): boolean =>
  !(session.cwd || '').trim() && !(session.git_repo_root || '').trim()

/** A session's recency stamp (last activity, falling back to creation). */
export const sessionRecency = (session: SessionInfo): number => session.last_active || session.started_at || 0

// ── Live session overlay ─────────────────────────────────────────────────────
// The backend tree is a snapshot (sessions with >=1 message, refreshed on a
// turn boundary). For parity with the flat Recents list — instant insertion of
// a freshly-created session and the live "working" arc — we overlay the live
// `$sessions` store onto the tree at render time. This is ADDITIVE only: the
// backend still owns membership, structure, counts, and history. The overlay
// just places rows already present in `$sessions` into the project/lane the
// backend would put them in, using the same id scheme. Worktree/kanban folding
// needs the backend common-root probe, so those rows are left for the next
// tree refresh; the common case (a new main-checkout session) overlays here.

/** True when `target` equals `folder` or is nested under it (segment-wise). */
function isPathUnder(folder: string, target: string): boolean {
  const f = comparisonSegments(folder)
  const t = comparisonSegments(target)

  if (!f.length || f.length > t.length) {
    return false
  }

  return f.every((seg, i) => seg === t[i])
}

/**
 * The project a live session belongs to (overview membership) — explicit project
 * by longest-prefix folder, else the repo root (the auto-project id). An IN-TREE
 * linked worktree (`<repoRoot>/.worktrees/<slug>`) belongs to the SAME project as
 * its repo root (the root is right there in the path), so a freshly-created
 * worktree session — e.g. from "convert a branch" / "new worktree" — surfaces in
 * the overview at once instead of waiting for the next backend refresh. Returns
 * null only for sessions we genuinely can't place from the row alone: cwd-less,
 * kanban-task worktrees (they fold into the kanban bucket), or a worktree that
 * lives OUTSIDE the repo root (a sibling dir) AND under no explicit project
 * folder. An explicit-project folder match always places the row — even when
 * the row's cwd sits outside its recorded repo root (a mid-session relocation,
 * or a sibling worktree of a project repo), the folder match is authoritative;
 * only the repo-root AUTO-project fallback needs cwd-under-root confidence.
 *
 * The session's own folder decides when it matches a project. A longer git
 * root that belongs to a different project must not steal the row — that is
 * how a chat opened in one worktree landed under the main checkout's project.
 * The git root is consulted only when the cwd itself matches no project.
 */
function explicitProjectForPath(target: string, explicitProjects: ProjectInfo[]): string {
  let projectId = ''
  let bestLen = -1

  for (const project of explicitProjects) {
    if (project.archived) {
      continue
    }

    for (const folder of project.folders) {
      if (!isPathUnder(folder.path, target)) {
        continue
      }

      const len = segments(folder.path).length

      if (len > bestLen) {
        bestLen = len
        projectId = project.id
      }
    }
  }

  return projectId
}

export function liveSessionProjectId(session: SessionInfo, explicitProjects: ProjectInfo[]): null | string {
  const cwd = (session.cwd || '').trim()
  // A session may carry only a git_repo_root and no cwd — older/imported rows,
  // or ones captured before cwd tracking. The backend still groups those by repo
  // root, so anchor on it here too; otherwise the sidebar files the row under a
  // project but the color derivation drops it (the "grouped but grey" bug).
  const repoRoot = (session.git_repo_root || '').trim() || cwd
  const anchor = cwd || repoRoot

  if (!anchor || kanbanWorktreeDir(anchor)) {
    return null
  }

  const byCwd = cwd ? explicitProjectForPath(cwd, explicitProjects) : ''

  if (byCwd) {
    return byCwd
  }

  const byRoot = repoRoot && repoRoot !== cwd ? explicitProjectForPath(repoRoot, explicitProjects) : ''

  if (byRoot) {
    return byRoot
  }

  // AUTO-project fallback (the repo root itself): with a cwd present it must
  // sit under the repo root (a sibling worktree outside the root can't be
  // placed from the row alone); a root-only session skips this — the root IS
  // the anchor.
  if (cwd && !isPathUnder(repoRoot, cwd)) {
    return null
  }

  return repoRoot
}

/**
 * The color a session inherits from its owning project — the explicit project
 * whose folder is the longest prefix of the session's cwd/repo-root, when that
 * project carries a user-set color. Auto-promoted repo projects have no color
 * unless the user set one, so a session only tints when it belongs to a colored
 * project (inheritance is opt-in by coloring the project). Reuses
 * {@link liveSessionProjectId} so the color follows the SAME membership the
 * sidebar groups by; returns null for rootless / kanban / out-of-tree rows and
 * for sessions under an uncolored (or auto) project.
 */
export function sessionProjectColor(session: SessionInfo, projects: ProjectInfo[]): null | string {
  const projectId = liveSessionProjectId(session, projects)

  if (!projectId) {
    return null
  }

  return projects.find(project => project.id === projectId)?.color ?? null
}

const NO_REMOVED: ReadonlySet<string> = new Set()

/**
 * Drop matching sessions from every lane (and the overview preview) of a
 * project subtree, recounting as lanes shrink. Used to keep pinned sessions out
 * of the project lists: a pin belongs to the Pinned section, not to both. The
 * predicate — rather than an id set — lets the caller match a pin on its
 * durable lineage-root id as well as the live one.
 *
 * Lanes SURVIVE being emptied. A worktree is structure (it exists on disk, you
 * can still start work in it); pinning its last chat must not delete the branch
 * from the tree — same reason the `git worktree list` enhancer injects lanes
 * that never had a session. Only the rows move. Memo-stable: returns the same
 * ref when nothing matched.
 */
export function excludeProjectSessions(
  project: SidebarProjectTree,
  isExcluded: (session: SessionInfo) => boolean
): SidebarProjectTree {
  let changed = false

  const repos = project.repos.map(repo => {
    let repoChanged = false

    const groups = repo.groups.map(group => {
      const sessions = group.sessions.filter(session => !isExcluded(session))

      if (sessions.length === group.sessions.length) {
        return group
      }

      repoChanged = true

      return { ...group, sessions }
    })

    if (!repoChanged) {
      return repo
    }

    changed = true

    return { ...repo, groups, sessionCount: groups.reduce((n, group) => n + group.sessions.length, 0) }
  })

  const previewSessions = project.previewSessions?.filter(session => !isExcluded(session))

  changed ||= previewSessions?.length !== project.previewSessions?.length

  if (!changed) {
    return project
  }

  return {
    ...project,
    previewSessions,
    repos,
    sessionCount: repos.reduce((n, repo) => n + repo.sessionCount, 0)
  }
}

interface PreviewOverlayOptions {
  removed?: ReadonlySet<string>
  /** The active sort key as an id order; recency when empty. */
  rankIds?: string[]
}

/** Merge live sessions into per-project overview previews, keyed by project id. */
export function overlayLivePreviews(
  projects: SidebarProjectTree[],
  live: SessionInfo[],
  explicitProjects: ProjectInfo[],
  limit: number,
  { removed = NO_REMOVED, rankIds }: PreviewOverlayOptions = {}
): Record<string, SessionInfo[]> {
  const byProject = new Map<string, SessionInfo[]>()

  for (const session of live) {
    if (removed.has(session.id)) {
      continue
    }

    const projectId =
      liveSessionProjectId(session, explicitProjects) ?? (isDetachedSession(session) ? NO_PROJECT_ID : null)

    if (!projectId) {
      continue
    }

    const arr = byProject.get(projectId) ?? []
    arr.push(session)
    byProject.set(projectId, arr)
  }

  const out: Record<string, SessionInfo[]> = {}

  for (const node of projects) {
    const liveRows = byProject.get(node.id) ?? []
    const base = (node.previewSessions ?? []).filter(session => !removed.has(session.id))

    if (!liveRows.length && !base.length) {
      continue
    }

    // Live rows take precedence (fresher title/activity/working state).
    const map = new Map<string, SessionInfo>()

    for (const session of [...liveRows, ...base]) {
      if (!map.has(session.id)) {
        map.set(session.id, session)
      }
    }

    const pool = [...map.values()].sort((a, b) => sessionRecency(b) - sessionRecency(a))

    out[node.id] = rankSessions(pool, rankIds).slice(0, limit)
  }

  return out
}
