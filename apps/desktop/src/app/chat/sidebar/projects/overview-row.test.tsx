import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionInfo } from '@/work4you'

import { ProjectOverviewRow } from './overview-row'
import type { SidebarProjectTree } from './workspace-groups'

afterEach(cleanup)

const { nodeOpen } = vi.hoisted(() => ({ nodeOpen: { current: false } }))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      sidebar: {
        newSessionIn: (label: string) => `New session in ${label}`,
        projects: {
          enter: (label: string) => `Enter ${label}`,
          reorder: (label: string) => `Reorder ${label}`,
          toggle: (label: string, open: boolean) => `${open ? 'Show' : 'Hide'} ${label} sessions`
        },
        showMoreIn: (count: number, label: string) => `Show ${count} more in ${label}`
      }
    }
  })
}))

vi.mock('./model', () => ({
  SIDEBAR_GROUP_PAGE: 5,
  latestProjectSessions: () => [],
  useWorkspaceNodeOpen: () => [nodeOpen.current, vi.fn()]
}))

// ProjectMenu (the kebab) has its own dedicated test file — stub it here so
// this file only exercises overview-row's own Tip usage (the disclosure
// toggle) plus the WorkspaceAddButton wiring. ProjectContextMenu (the row's
// right-click wrapper) is stubbed as a pass-through so the row still renders.
vi.mock('./project-menu', () => ({
  ProjectContextMenu: ({ children }: { children: ReactNode }) => children,
  ProjectMenu: () => null
}))

const project = { id: 'p1', label: 'Test D', repos: [] } as unknown as SidebarProjectTree

const repoProject = {
  id: 'p_web',
  label: 'Website',
  repos: [{ groups: [], id: '/repos/website', label: 'website', path: '/repos/website', sessionCount: 0 }]
} as unknown as SidebarProjectTree

const tipTrigger = (el: HTMLElement) => el.closest('[data-slot="tooltip-trigger"]')

describe('ProjectOverviewRow', () => {
  beforeEach(() => {
    nodeOpen.current = false
  })
  it('wraps the "new session" add button in a Tip with the project-scoped label', () => {
    render(<ProjectOverviewRow onNewSession={vi.fn()} project={project} />)

    const button = screen.getByRole('button', { name: 'New session in Test D' })
    expect(tipTrigger(button)).toBeTruthy()
  })

  it('wraps the disclosure toggle in a Tip when there are preview sessions', () => {
    render(
      <ProjectOverviewRow
        previewSessions={[{ id: 's1' } as unknown as SessionInfo]}
        project={project}
        renderRows={() => null}
      />
    )

    // Collapsed by default, so the disclosure offers to show the sessions.
    const button = screen.getByRole('button', { name: 'Show Test D sessions' })
    expect(tipTrigger(button)).toBeTruthy()
  })

  it('does not render the disclosure toggle when there is nothing to preview', () => {
    render(<ProjectOverviewRow project={project} />)

    expect(screen.queryByRole('button', { name: 'Show Test D sessions' })).toBeNull()
  })

  it('offers the "new session" add button on Home, which starts one with no folder', () => {
    const home = {
      id: '__no_project__',
      isNoProject: true,
      label: 'Home',
      path: null
    } as unknown as SidebarProjectTree

    const onNewSession = vi.fn()

    render(<ProjectOverviewRow onNewSession={onNewSession} project={home} />)
    fireEvent.click(screen.getByRole('button', { name: 'New session in Home' }))

    expect(onNewSession).toHaveBeenCalledWith(null)
  })

  it('tags the row with data-sessions-project so a skin can target one project', () => {
    const { container } = render(<ProjectOverviewRow project={project} />)

    expect(container.querySelector('[data-sessions-project="p1"]')).toBeTruthy()
  })

  it('does not offer a disclosure when the project has repos but no session previews', () => {
    render(<ProjectOverviewRow project={repoProject} />)

    expect(screen.queryByRole('button', { name: 'Show Website sessions' })).toBeNull()
  })

  it('does not paint repo lanes on the overview', () => {
    nodeOpen.current = true
    render(<ProjectOverviewRow project={repoProject} />)

    expect(screen.queryByTestId('overview-lanes')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hide Website sessions' })).toBeNull()
  })

  it('does not paint repo lanes under Home', () => {
    nodeOpen.current = true

    const home = {
      id: '__no_project__',
      isNoProject: true,
      label: 'Home',
      path: null,
      repos: [{ groups: [], id: 'none', label: 'Home', path: null, sessionCount: 1 }]
    } as unknown as SidebarProjectTree

    render(<ProjectOverviewRow project={home} />)

    expect(screen.queryByTestId('overview-lanes')).toBeNull()
  })

  it('pages project history with Show more instead of a short teaser', () => {
    nodeOpen.current = true
    const sessions = Array.from({ length: 7 }, (_, index) => ({ id: `s${index}` }) as unknown as SessionInfo)

    render(
      <ProjectOverviewRow
        previewSessions={sessions}
        project={project}
        renderRows={rows => <div data-testid="preview-ids">{rows.map(session => session.id).join(',')}</div>}
      />
    )

    expect(screen.getByTestId('preview-ids').textContent).toBe('s0,s1,s2,s3,s4')
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more in Test D' }))
    expect(screen.getByTestId('preview-ids').textContent).toBe('s0,s1,s2,s3,s4,s5,s6')
    expect(screen.queryByRole('button', { name: /Show .* more in Test D/ })).toBeNull()
  })

  it('does not offer Show more when the project history fits one page', () => {
    nodeOpen.current = true

    render(
      <ProjectOverviewRow
        previewSessions={[{ id: 's1' } as unknown as SessionInfo, { id: 's2' } as unknown as SessionInfo]}
        project={project}
        renderRows={rows => <div data-testid="preview-ids">{rows.map(session => session.id).join(',')}</div>}
      />
    )

    expect(screen.getByTestId('preview-ids').textContent).toBe('s1,s2')
    expect(screen.queryByRole('button', { name: /Show .* more in Test D/ })).toBeNull()
  })
})
