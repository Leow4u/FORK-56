import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as Nanostores from 'nanostores'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Work4YouGitWorktree, Work4YouRepoStatus } from '@/global'
import { $projectScope, ALL_PROJECTS } from '@/store/project-scope'
import { $projectTree } from '@/store/projects'
import { $currentCwd, $newChatWorkspaceTarget, setCurrentCwd, setNewChatWorkspaceTarget } from '@/store/session'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

const { $status, $worktrees, openWorktreeDialog, switchBranchInRepo } = vi.hoisted(() => {
  const { atom: hoistedAtom } = require('nanostores') as typeof Nanostores

  return {
    $status: hoistedAtom<null | Work4YouRepoStatus>(null),
    $worktrees: hoistedAtom<Work4YouGitWorktree[]>([]),
    openWorktreeDialog: vi.fn(async () => undefined),
    switchBranchInRepo: vi.fn(async () => undefined)
  }
})

vi.mock('@/store/coding-status', () => ({
  openWorktreeDialog,
  refreshRepoStatus: async () => undefined,
  registerRepoStatusCwd: () => undefined,
  repoStatusForCwd: () => $status,
  repoWorktreesForCwd: () => $worktrees
}))

vi.mock('@/store/projects', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return { ...actual, switchBranchInRepo }
})

const { WorkspaceBranchChip } = await import('./workspace-branch-chip')
const { WorkspaceChipRow } = await import('./workspace-chip')

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

afterEach(() => {
  cleanup()
  $status.set(null)
  $worktrees.set([])
  $projectTree.set([])
  $projectScope.set(ALL_PROJECTS)
  setCurrentCwd('')
  setNewChatWorkspaceTarget(undefined)
  openWorktreeDialog.mockClear()
  switchBranchInRepo.mockClear()
})

const repoStatus = (over: Partial<Work4YouRepoStatus> = {}): Work4YouRepoStatus => ({
  added: 12,
  ahead: 2,
  behind: 1,
  branch: 'feat/chip',
  changed: 3,
  conflicted: 0,
  defaultBranch: 'main',
  detached: false,
  files: [],
  removed: 3,
  staged: 0,
  unstaged: 3,
  untracked: 0,
  ...over
})

const worktree = (over: Partial<Work4YouGitWorktree> = {}): Work4YouGitWorktree => ({
  branch: 'main',
  detached: false,
  isMain: true,
  locked: false,
  path: '/repo',
  ...over
})

function renderUi(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

async function openBranchMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Branch and worktree' }), { button: 0 })

  return waitFor(() => screen.getByRole('menu'))
}

describe('WorkspaceBranchChip', () => {
  it('renders nothing without a folder or without a repo probe', () => {
    renderUi(<WorkspaceBranchChip cwd="" />)
    expect(screen.queryByRole('button', { name: 'Branch and worktree' })).toBeNull()

    renderUi(<WorkspaceBranchChip cwd="/not-a-repo" />)
    expect(screen.queryByRole('button', { name: 'Branch and worktree' })).toBeNull()
  })

  it('names the current branch and keeps review counters off the empty chat', () => {
    $status.set(repoStatus())

    renderUi(<WorkspaceBranchChip cwd="/repo" />)

    const chip = screen.getByRole('button', { name: 'Branch and worktree' })
    expect(chip.textContent).toContain('feat/chip')
    expect(chip.textContent).not.toMatch(/\+12|−3|-3|↑|↓/)
    expect(chip.hasAttribute('data-worktree')).toBe(false)
  })

  it('marks the chip as a worktree when the folder is a linked checkout', () => {
    $status.set(repoStatus({ branch: 'cursor/menu-cards' }))
    $worktrees.set([
      worktree(),
      worktree({ branch: 'cursor/menu-cards', isMain: false, path: '/repo/.worktrees/menu-cards' })
    ])

    renderUi(<WorkspaceBranchChip cwd="/repo/.worktrees/menu-cards" />)

    expect(screen.getByRole('button', { name: 'Branch and worktree' }).hasAttribute('data-worktree')).toBe(true)
  })

  it('lists branch and worktree actions and re-targets the draft at a picked worktree', async () => {
    $status.set(repoStatus({ branch: 'main' }))
    $worktrees.set([worktree(), worktree({ branch: 'cursor/menu-cards', isMain: false, path: '/repo/.worktrees/mc' })])
    setCurrentCwd('/repo')

    renderUi(<WorkspaceBranchChip cwd="/repo" />)
    await openBranchMenu()

    expect(screen.getByRole('menuitem', { name: 'main' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'New branch + worktree…' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Worktree from existing branch…' })).toBeTruthy()
    // On main there is no "Switch to main" row.
    expect(screen.queryByRole('menuitem', { name: /Switch to/ })).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: 'cursor/menu-cards' }))

    expect($newChatWorkspaceTarget.get()).toBe('/repo/.worktrees/mc')
    expect($currentCwd.get()).toBe('/repo/.worktrees/mc')
  })

  it('recognizes a Windows subfolder inside a linked worktree as the current folder', async () => {
    $status.set(repoStatus({ branch: 'feature/windows' }))
    $worktrees.set([
      worktree({ path: 'C:/Repo', branch: 'main' }),
      worktree({ branch: 'feature/windows', isMain: false, path: 'C:/Repo/.worktrees/windows' })
    ])
    renderUi(<WorkspaceBranchChip cwd={'c:\\repo\\.worktrees\\windows\\src'} />)
    expect(screen.getByRole('button', { name: 'Branch and worktree' }).hasAttribute('data-worktree')).toBe(true)
    await openBranchMenu()
    expect(screen.getAllByRole('menuitem', { name: 'feature/windows' })).toHaveLength(1)
    expect(screen.getByRole('menuitem', { name: 'main' })).toBeTruthy()
  })

  it('opens the existing-branch picker directly, preserving the target repository', async () => {
    $status.set(repoStatus())
    renderUi(<WorkspaceBranchChip cwd="/repo" />)
    await openBranchMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Worktree from existing branch…' }))
    expect(openWorktreeDialog).toHaveBeenCalledWith({ mode: 'existing', repoPath: '/repo', target: 'draft' })
  })

  it('opens the shared worktree dialog for a new branch and switches to the trunk', async () => {
    $status.set(repoStatus({ branch: 'feat/chip' }))

    renderUi(<WorkspaceBranchChip cwd="/repo" />)
    await openBranchMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'New branch + worktree…' }))

    expect(openWorktreeDialog).toHaveBeenCalledWith({ base: 'feat/chip', repoPath: '/repo', target: 'draft' })

    await openBranchMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to main' }))

    await waitFor(() => expect(switchBranchInRepo).toHaveBeenCalledWith('/repo', 'main'))
  })
})

describe('WorkspaceChipRow with a git folder', () => {
  it('shows the branch chip beside Select project only when the folder is a repo', () => {
    const { unmount } = renderUi(<WorkspaceChipRow cwd="/repo" messagesEmpty />)
    expect(screen.queryByRole('button', { name: 'Branch and worktree' })).toBeNull()
    unmount()

    $status.set(repoStatus({ branch: 'main' }))
    renderUi(<WorkspaceChipRow cwd="/repo" messagesEmpty />)

    expect(screen.getByRole('button', { name: 'Select project' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Branch and worktree' }).textContent).toContain('main')
  })

  it('stays off the composer once the transcript has messages', () => {
    $status.set(repoStatus())

    renderUi(<WorkspaceChipRow cwd="/repo" messagesEmpty={false} />)

    expect(screen.queryByRole('button', { name: 'Branch and worktree' })).toBeNull()
  })
})
