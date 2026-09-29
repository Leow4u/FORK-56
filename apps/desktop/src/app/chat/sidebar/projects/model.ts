import { useStore } from '@nanostores/react'

import { $sidebarWorkspaceNodeOpen, toggleWorkspaceNodeCollapsed } from '@/store/layout'
import type { SessionInfo } from '@/work4you'

import { sessionRecency, type SidebarProjectTree } from './workspace-groups'

// Page size when revealing more already-loaded rows within a workspace group.
export const SIDEBAR_GROUP_PAGE = 5

// Recent sessions previewed under a profile group (click the label for the rest).
export const PROJECT_PREVIEW_COUNT = 3

// Every session in a project, across its repos/worktrees (order-agnostic).
const projectSessions = (project: SidebarProjectTree): SessionInfo[] =>
  project.repos.flatMap(repo => repo.groups.flatMap(group => group.sessions))

export const projectTreeCwd = (project: SidebarProjectTree): null | string =>
  project.path || project.repos.find(repo => repo.path)?.path || null

// Overview rows carry their activity stamp from the backend (lanes are empty in
// overview mode), falling back to loaded session times when present.
const projectActivityTime = (project: SidebarProjectTree): number =>
  Math.max(
    project.lastActive ?? 0,
    projectSessions(project).reduce((latest, s) => Math.max(latest, sessionRecency(s)), 0)
  )

// The project's sessions by recency — overview rows page this with Show more.
export const latestProjectSessions = (project: SidebarProjectTree, limit: number): SessionInfo[] =>
  [...projectSessions(project)].sort((a, b) => sessionRecency(b) - sessionRecency(a)).slice(0, limit)

// Home is a fixture, not a project: it always trails the overview (no-folder
// recents), below the folders and outside any hand-picked order.
const homeLast = (projects: SidebarProjectTree[]): SidebarProjectTree[] =>
  projects.at(-1)?.isNoProject || !projects.some(project => project.isNoProject)
    ? projects
    : [...projects.filter(project => !project.isNoProject), ...projects.filter(project => project.isNoProject)]

export function sortProjectsForOverview(
  projects: SidebarProjectTree[],
  activeProjectId: null | string
): SidebarProjectTree[] {
  const sorted = [...projects].sort((a, b) => {
    const aActive = Boolean(activeProjectId && a.id === activeProjectId && !a.isAuto)
    const bActive = Boolean(activeProjectId && b.id === activeProjectId && !b.isAuto)

    if (aActive !== bActive) {
      return aActive ? -1 : 1
    }

    if (!a.isAuto !== !b.isAuto) {
      return a.isAuto ? 1 : -1
    }

    const aHasSessions = a.sessionCount > 0
    const bHasSessions = b.sessionCount > 0

    if (aHasSessions !== bHasSessions) {
      return aHasSessions ? -1 : 1
    }

    return (
      projectActivityTime(b) - projectActivityTime(a) ||
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    )
  })

  return homeLast(sorted)
}

// Layer the user's manual drag-order over the deterministic sort.
//
// This can't just be `orderByIds`: that surfaces every id missing from the saved
// order at the TOP, which is right for sessions (a new chat should not sink) but
// wrong here. The overview also lists repos found by the disk scan that have
// zero Work4You sessions, and those arrive continuously — so once the user dragged
// anything, every freshly-scanned checkout jumped above the projects they
// actually work in.
//
// Fresh projects keep their place in the deterministic sort instead: ones with
// real activity go on top (a project you just started still surfaces), and
// zero-session discoveries sink below the hand-ordered list.
export function orderProjectsByIds(projects: SidebarProjectTree[], orderIds: string[]): SidebarProjectTree[] {
  if (!orderIds.length) {
    return projects
  }

  const byId = new Map(projects.map(project => [project.id, project]))
  const ordered = orderIds.map(id => byId.get(id)).filter((p): p is SidebarProjectTree => Boolean(p))
  const seen = new Set(ordered.map(project => project.id))
  const fresh = projects.filter(project => !seen.has(project.id))

  if (!fresh.length) {
    return homeLast(ordered)
  }

  return homeLast([
    ...fresh.filter(project => project.sessionCount > 0),
    ...ordered,
    ...fresh.filter(project => project.sessionCount <= 0)
  ])
}

// Persisted open/collapse for a project/profile row, surviving reloads.
//
// State is stored as the RESOLVED boolean per node (see `$sidebarWorkspaceNodeOpen`),
// so a node whose `defaultOpen` flips — an empty worktree/branch lane defaults
// collapsed, then defaults open once it holds a session — keeps whatever the
// user explicitly chose instead of having it silently reinterpreted. An absent
// id follows `defaultOpen`, so empty lanes still start collapsed until opened.
export function useWorkspaceNodeOpen(id: string, defaultOpen = true): [boolean, () => void] {
  const state = useStore($sidebarWorkspaceNodeOpen)

  return [state[id] ?? defaultOpen, () => toggleWorkspaceNodeCollapsed(id, defaultOpen)]
}
