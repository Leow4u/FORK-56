import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Work4YouGitBaseBranch } from '@/global'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

const { listBaseBranches } = vi.hoisted(() => ({ listBaseBranches: vi.fn() }))
vi.mock('@/store/projects', () => ({ listBaseBranches }))
vi.mock('@/store/coding-status', () => ({ repoStatusForCwd: () => atom(null) }))
const { BaseBranchPicker } = await import('./base-branch-picker')

const branches: Work4YouGitBaseBranch[] = [
  { name: 'origin/main', isDefault: true, isRemote: true },
  { name: 'feature/source', isDefault: false, isRemote: false }
]

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})
afterEach(() => {
  cleanup()
  listBaseBranches.mockReset()
})

describe('worktree base selection', () => {
  it('preserves the base explicitly chosen before branches load', async () => {
    listBaseBranches.mockResolvedValue(branches)
    const onValueChange = vi.fn()
    render(<BaseBranchPicker onValueChange={onValueChange} repoPath="/repo" value="feature/source" />)
    await waitFor(() => expect(listBaseBranches).toHaveBeenCalledWith('/repo'))
    await waitFor(() => expect(screen.getByText('feature/source')).toBeTruthy())
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('defaults only when no base was supplied', async () => {
    listBaseBranches.mockResolvedValue(branches)
    const onValueChange = vi.fn()
    render(<BaseBranchPicker onValueChange={onValueChange} repoPath="/repo" value="" />)
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('origin/main'))
    expect(listBaseBranches).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite newer intent or accept a response for the previous repository', async () => {
    let resolveOld!: (value: Work4YouGitBaseBranch[]) => void
    listBaseBranches.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveOld = resolve
        })
    )
    listBaseBranches.mockResolvedValueOnce(branches)
    const onValueChange = vi.fn()
    const { rerender } = render(<BaseBranchPicker onValueChange={onValueChange} repoPath="/old" value="" />)
    rerender(<BaseBranchPicker onValueChange={onValueChange} repoPath="/new" value="feature/source" />)
    await act(async () => {
      resolveOld([{ name: 'old-main', isDefault: true, isRemote: false }])
    })
    expect(onValueChange).not.toHaveBeenCalled()
    expect(screen.getByText('feature/source')).toBeTruthy()
  })

  it('does not continuously retry an empty or failed branch list', async () => {
    listBaseBranches.mockRejectedValue(new Error('offline'))
    render(<BaseBranchPicker onValueChange={() => undefined} repoPath="/repo" value="main" />)
    await waitFor(() => expect(screen.getByText('main')).toBeTruthy())
    expect(listBaseBranches).toHaveBeenCalledTimes(1)
  })
})
