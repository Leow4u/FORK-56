import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as Nanostores from 'nanostores'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { $composerAttachments, $composerDraft } from '@/store/composer'
import { $activeSessionId, $currentCwd, $selectedStoredSessionId, setCurrentCwd } from '@/store/session'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

const { $worktreeDialog, listRepoBranches, startWorkInRepo, requestStartWorkSession } = vi.hoisted(() => {
  const { atom } = require('nanostores') as typeof Nanostores

  return {
    $worktreeDialog: atom<null | {
      repoPath: string
      base?: string
      mode?: 'existing' | 'create'
      target?: 'draft' | 'session'
    }>(null),
    listRepoBranches: vi.fn(),
    startWorkInRepo: vi.fn(),
    requestStartWorkSession: vi.fn()
  }
})

vi.mock('@/store/projects', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()
  const { atom } = await import('nanostores')

  return {
    ...actual,
    $projectTree: atom([]),
    $worktreeDialog,
    closeWorktreeDialog: () => $worktreeDialog.set(null),
    listRepoBranches,
    projectIdForCwd: () => null,
    projectRootCwd: () => '',
    requestStartWorkSession,
    startWorkInRepo,
    switchBranchInRepo: vi.fn()
  }
})
vi.mock('./base-branch-picker', () => ({
  BaseBranchPicker: ({ value }: { value: string }) => <span data-testid="chosen-base">{value}</span>
}))
const { WorktreeDialog } = await import('./worktree-dialog')
beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})
afterEach(() => {
  cleanup()
  $worktreeDialog.set(null)
  $composerAttachments.set([])
  $composerDraft.set('')
  setCurrentCwd('')
  vi.clearAllMocks()
})

describe('worktree dialog intent', () => {
  it('opens the existing-branch list directly and opens an already checked-out folder', async () => {
    listRepoBranches.mockResolvedValue([
      { name: 'feature/existing', checkedOut: true, worktreePath: '/trees/existing' }
    ])
    $worktreeDialog.set({ mode: 'existing', repoPath: '/repo' })
    render(<WorktreeDialog />)
    expect(screen.getByRole('heading', { name: 'Worktree from existing branch' })).toBeTruthy()
    fireEvent.click(await screen.findByText('feature/existing'))
    await waitFor(() => expect(requestStartWorkSession).toHaveBeenCalledWith('/trees/existing'))
    expect(startWorkInRepo).not.toHaveBeenCalled()
  })

  it('submits the selected base unchanged to the real shared creation action', async () => {
    $worktreeDialog.set({ base: 'release/approved', repoPath: '/repo' })
    startWorkInRepo.mockResolvedValue({ branch: 'feature/new', path: '/trees/new' })
    render(<WorktreeDialog />)
    fireEvent.change(screen.getByPlaceholderText('e.g. my-feature'), { target: { value: 'feature/new' } })
    expect(screen.getByTestId('chosen-base').textContent).toBe('release/approved')
    fireEvent.click(screen.getByRole('button', { name: 'Create and open session' }))
    await waitFor(() =>
      expect(startWorkInRepo).toHaveBeenCalledWith('/repo', {
        base: 'release/approved',
        branch: 'feature/new',
        name: 'feature/new'
      })
    )
    expect(requestStartWorkSession).toHaveBeenCalledWith('/trees/new')
  })
  it('creates a worktree for a fresh draft without clearing its text or attachments', async () => {
    $activeSessionId.set(null)
    $selectedStoredSessionId.set(null)
    setCurrentCwd('/repo')
    $composerDraft.set('Keep this task and its source document')
    const attachments = [{ id: 'file-1', kind: 'file' as const, label: 'notes.md', path: '/repo/notes.md' }]
    $composerAttachments.set(attachments)
    $worktreeDialog.set({ base: 'main', repoPath: '/repo', target: 'draft' })
    startWorkInRepo.mockResolvedValue({ branch: 'feature/draft', path: '/trees/draft' })
    render(<WorktreeDialog />)
    fireEvent.change(screen.getByPlaceholderText('e.g. my-feature'), { target: { value: 'feature/draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create and use in this session' }))
    await waitFor(() => expect($currentCwd.get()).toBe('/trees/draft'))
    expect($composerDraft.get()).toBe('Keep this task and its source document')
    expect($composerAttachments.get()).toEqual(attachments)
    expect(requestStartWorkSession).not.toHaveBeenCalled()
    expect($worktreeDialog.get()).toBeNull()
  })
})
