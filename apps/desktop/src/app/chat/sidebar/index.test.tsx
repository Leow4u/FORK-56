import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { $cronJobs } from '@/store/cron'
import {
  $sidebarAgentsGrouped,
  resetSidebarView,
  setSidebarAgentsGrouped,
  setSidebarShowArchived
} from '@/store/layout'
import { $projectDialog, $projectScope, $projectTree, ALL_PROJECTS } from '@/store/projects'
import { $messagingSessions, $sessions, $sessionsLoading } from '@/store/session'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'
import { makeSessionInfo } from '@/test/session-info'
import type { CronJob } from '@/types/work4you'

import type { SidebarProjectTree } from './projects'

import { ChatSidebar } from './index'

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

vi.mock('./account-footer', () => ({ AccountFooter: () => null }))
vi.mock('./profile-switcher', () => ({ ProfileRail: () => null }))
vi.mock('./project-dialog', () => ({ ProjectDialog: () => null }))
vi.mock('./projects/worktree-dialog', () => ({ WorktreeDialog: () => null }))
vi.mock('./filter-menu', () => ({ SidebarFilterMenu: () => null }))
vi.mock('./cron-jobs-section', () => ({
  SidebarCronJobsSection: ({ label }: { label: string }) => <section data-testid={`section-${label}`}>{label}</section>
}))

vi.mock('./sessions-section', () => ({
  VIRTUALIZE_THRESHOLD: 25,
  SidebarSessionsSection: (props: {
    headerAction?: ReactNode
    label: string
    onEnterProject?: (id: string) => void
    projectContent?: { id: string } | null
    projectOverview?: Array<{ id: string; label: string }>
  }) => (
    <section
      data-content={props.projectContent ? 'entered' : props.projectOverview?.length ? 'overview' : 'sessions'}
      data-testid={`section-${props.label}`}
    >
      <h2>{props.label}</h2>
      {props.label === 'Projects' ? props.headerAction : null}
      {props.projectOverview?.map(project => (
        <button key={project.id} onClick={() => props.onEnterProject?.(project.id)} type="button">
          {project.label}
        </button>
      ))}
    </section>
  )
}))

const treeNode = (
  over: Partial<SidebarProjectTree> & Pick<SidebarProjectTree, 'id' | 'label'>
): SidebarProjectTree => ({
  path: null,
  repos: [],
  sessionCount: 0,
  ...over
})

const sidebarProps = {
  currentView: 'chat' as const,
  onArchiveSession: () => undefined,
  onBranchSession: () => undefined,
  onDeleteSession: () => undefined,
  onLoadMoreSessions: () => undefined,
  onManageCronJob: () => undefined,
  onNavigate: () => undefined,
  onNewSessionInWorkspace: () => undefined,
  onNewSessionSplit: () => undefined,
  onResumeSession: () => undefined,
  onTriggerCronJob: async () => undefined
}

function renderSidebar() {
  return render(
    <MemoryRouter>
      <SidebarProvider>
        <ChatSidebar {...sidebarProps} />
      </SidebarProvider>
    </MemoryRouter>
  )
}

function seedHomeSidebar() {
  window.localStorage.clear()
  resetSidebarView()
  setSidebarAgentsGrouped(false)
  $projectScope.set(ALL_PROJECTS)
  $projectDialog.set(null)
  $sessionsLoading.set(false)
  $sessions.set([makeSessionInfo({ id: 'cli-1', last_active: 2, source: 'desktop', title: 'Recent chat' })])
  $messagingSessions.set([makeSessionInfo({ id: 'wa-1', last_active: 1, source: 'whatsapp', title: 'WhatsApp thread' })])
  $cronJobs.set([{ enabled: true, id: 'job-1', name: 'Nightly' } as CronJob])
  $projectTree.set([
    treeNode({ id: '__no_project__', isNoProject: true, label: 'No project', sessionCount: 1 }),
    treeNode({ id: 'p_demo', label: 'Demo', path: '/repos/demo', sessionCount: 1 })
  ])
}

describe('ChatSidebar date grouping keeps Projects next to Recents', () => {
  beforeEach(seedHomeSidebar)

  afterEach(() => {
    $projectTree.set([])
    $sessions.set([])
    $messagingSessions.set([])
    $cronJobs.set([])
    $projectScope.set(ALL_PROJECTS)
    $projectDialog.set(null)
    setSidebarAgentsGrouped(false)
    setSidebarShowArchived(false)
  })

  it('shows Projects, Sessions, WhatsApp, and Cron jobs together', () => {
    renderSidebar()

    expect(screen.getByTestId('section-Projects').getAttribute('data-content')).toBe('overview')
    expect(screen.getByTestId('section-Sessions').getAttribute('data-content')).toBe('sessions')
    expect(screen.getByTestId('section-WhatsApp').getAttribute('data-content')).toBe('sessions')
    expect(screen.getByTestId('section-Cron jobs')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New project' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Demo' })).toBeTruthy()
  })

  it('opens the existing create-project dialog from the Projects header', () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: 'New project' }))
    expect($projectDialog.get()).toEqual({ mode: 'create' })
  })

  it('enters a project through goToProject so the existing drill-in replaces Recents', () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: 'Demo' }))

    expect($sidebarAgentsGrouped.get()).toBe(true)
    expect($projectScope.get()).toBe('p_demo')
    expect(screen.queryByTestId('section-Projects')).toBeNull()
    expect(screen.queryByTestId('section-WhatsApp')).toBeNull()
    expect(screen.queryByTestId('section-Cron jobs')).toBeNull()
    expect(screen.getByTestId('section-Demo').getAttribute('data-content')).toBe('entered')
  })

  it('hides the always-visible Projects overview while Archived is on', () => {
    setSidebarShowArchived(true)
    renderSidebar()

    expect(screen.queryByTestId('section-Projects')).toBeNull()
    expect(screen.getByTestId('section-Sessions')).toBeTruthy()
  })
})
