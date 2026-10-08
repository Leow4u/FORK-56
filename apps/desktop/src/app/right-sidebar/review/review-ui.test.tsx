import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Work4YouReviewFile } from '@/global'
import { I18nProvider } from '@/i18n'
import {
  $reviewCommitDefault,
  $reviewCommitSummary,
  $reviewDiff,
  $reviewDiffError,
  $reviewDiffLoading,
  $reviewDiffPart,
  $reviewError,
  $reviewFiles,
  $reviewIsRepo,
  $reviewLoading,
  $reviewScope,
  $reviewScopesSupported,
  $reviewSelectedPath,
  $reviewShipBusy,
  $reviewTreeVisible
} from '@/store/review'

import { ReviewFilePanel } from './file-panel'
import { ReviewShipBar } from './ship-bar'

import { ReviewPane } from './index'

vi.mock('@/components/chat/diff-lines', () => ({
  FileDiffPanel: ({ diff }: { diff: string }) => <pre data-testid="rendered-diff">{diff}</pre>
}))

// The store tests exercise the real bridge and ordering. These tests verify that
// a visible count/label describes that state, independently of the render engine.
vi.mock('./file-actions', () => ({ openReviewFile: vi.fn(), reviewAbsolutePath: (path: string) => `/repo/${path}` }))

const partial: Work4YouReviewFile = {
  path: 'example.ts',
  status: 'M',
  added: 8,
  removed: 2,
  staged: true,
  unstaged: true,
  stagedAdded: 3,
  stagedRemoved: 1,
  unstagedAdded: 5,
  unstagedRemoved: 1
}

function renderUi(children: ReactNode) {
  return render(
    <I18nProvider configClient={null} initialLocale="en">
      {children}
    </I18nProvider>
  )
}

describe('review scope presentation', () => {
  beforeEach(() => {
    $reviewScope.set('uncommitted')
    $reviewScopesSupported.set(true)
    $reviewDiffPart.set('unstaged')
    $reviewDiff.set('@@ -1 +1 @@\n-before\n+after')
    $reviewFiles.set([partial])
    $reviewSelectedPath.set(null)
    $reviewLoading.set(false)
    $reviewDiffLoading.set(false)
    $reviewDiffError.set(null)
    $reviewError.set(null)
    $reviewShipBusy.set(false)
    $reviewIsRepo.set(true)
    $reviewTreeVisible.set(true)
    $reviewCommitDefault.set('commit')
    $reviewCommitSummary.set({
      hasStaged: true,
      stagedCount: 1,
      totalCount: 3,
      includesDirectories: false,
      truncated: false
    })
  })

  afterEach(() => {
    cleanup()
    $reviewFiles.set([])
    $reviewCommitSummary.set({
      hasStaged: false,
      stagedCount: 0,
      totalCount: 0,
      includesDirectories: false,
      truncated: false
    })
  })

  it('separates both parts of a partially staged file and shows the selected part count', () => {
    const { container } = renderUi(<ReviewFilePanel file={partial} />)
    expect(screen.getByRole('button', { name: 'Unstaged +5 −1' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Staged +3 −1' }).getAttribute('aria-pressed')).toBe('false')
    const header = container.querySelector('[data-suppress-pane-reveal-side]') as HTMLElement
    expect(header.textContent).toContain('+5')
    expect(header.textContent).not.toContain('+8')
  })

  it('uses the scope totals for staged-only diff even if the last selected part was unstaged', () => {
    $reviewScope.set('staged')
    const { container } = renderUi(<ReviewFilePanel file={{ ...partial, added: 3, removed: 1 }} />)
    expect(screen.queryByRole('button', { name: 'Unstaged +5 −1' })).toBeNull()
    expect(container.querySelector('[data-suppress-pane-reveal-side]')?.textContent).toContain('+3')
  })

  it('never shows the commit controls for a branch comparison', () => {
    $reviewScope.set('branch')
    const { container } = renderUi(<ReviewShipBar />)
    expect(container.textContent).toBe('')
  })

  it('names the real commit scope even when the displayed files are filtered to unstaged', () => {
    $reviewScope.set('unstaged')
    renderUi(<ReviewShipBar />)
    expect(screen.getByRole('button', { name: 'Commit staged changes' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/1 staged/)
    expect(screen.getByRole('status').textContent).toMatch(/filter does not limit/i)
  })

  it('labels automatic staging explicitly when the index is empty', () => {
    $reviewCommitSummary.set({
      hasStaged: false,
      stagedCount: 0,
      totalCount: 3,
      includesDirectories: false,
      truncated: false
    })
    renderUi(<ReviewShipBar />)
    expect(screen.getByRole('button', { name: 'Stage all and commit' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('3 changed')
  })

  it('distinguishes a binary file and a failed diff from an empty text diff', () => {
    $reviewDiff.set('')
    const { rerender } = renderUi(<ReviewFilePanel file={{ ...partial, binary: true }} />)
    expect(screen.getByText('Binary file — no text diff')).toBeTruthy()
    expect(screen.queryByTestId('rendered-diff')).toBeNull()
    act(() => $reviewDiffError.set('Permission denied'))
    rerender(
      <I18nProvider configClient={null} initialLocale="en">
        <ReviewFilePanel file={partial} />
      </I18nProvider>
    )
    expect(screen.getByText('Could not load changes')).toBeTruthy()
    expect(screen.getByText('Permission denied')).toBeTruthy()
  })

  it.each(['Binary files a/example.ts and b/example.ts differ', 'GIT binary patch\nliteral 4\nLc${NkU|;|M00aO5'])(
    'uses the selected patch to distinguish staged text from an unstaged binary: %s',
    binaryPatch => {
      const textPatch = '@@ -1 +1 @@\n-before\n+Binary files a/example.ts and b/example.ts differ'
      $reviewDiffPart.set('staged')
      $reviewDiff.set(textPatch)
      renderUi(<ReviewFilePanel file={{ ...partial, binary: true }} />)
      expect(screen.getByTestId('rendered-diff').textContent).toBe(textPatch)
      expect(screen.queryByText('Binary file — no text diff')).toBeNull()

      act(() => {
        $reviewDiffPart.set('unstaged')
        $reviewDiff.set(`diff --git a/example.ts b/example.ts\n${binaryPatch}\n`)
      })
      expect(screen.getByText('Binary file — no text diff')).toBeTruthy()
      expect(screen.queryByTestId('rendered-diff')).toBeNull()

      act(() => {
        $reviewDiffPart.set('staged')
        $reviewDiff.set(textPatch)
      })
      expect(screen.getByTestId('rendered-diff').textContent).toBe(textPatch)
      expect(screen.queryByText('Binary file — no text diff')).toBeNull()
    }
  )

  it('keeps the file menu available when its diff is collapsed', () => {
    renderUi(<ReviewFilePanel file={partial} />)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'File actions' }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse'
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Collapse file' }))
    expect(screen.queryByTestId('rendered-diff')).toBeNull()
    expect(screen.getByRole('button', { name: 'File actions' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Expand file' }))
    expect(screen.getByTestId('rendered-diff')).toBeTruthy()
  })

  it('hides and restores the right-hand tree without losing the selected diff', () => {
    $reviewSelectedPath.set(partial.path)
    const { container } = renderUi(<ReviewPane />)
    const reader = container.querySelector('[data-review-reader]')
    const tree = reader?.nextElementSibling
    expect(tree?.tagName).toBe('ASIDE')
    expect(tree?.classList.contains('hidden')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Hide file tree' }))
    expect(tree?.classList.contains('hidden')).toBe(true)
    expect(screen.getByTestId('rendered-diff')).toBeTruthy()
    expect($reviewSelectedPath.get()).toBe(partial.path)
    fireEvent.click(screen.getByRole('button', { name: 'Show file tree' }))
    expect(tree?.classList.contains('hidden')).toBe(false)
  })

  it('never describes a repository read error or non-Git folder as a clean scope', () => {
    $reviewFiles.set([])
    $reviewCommitSummary.set({
      hasStaged: false,
      stagedCount: 0,
      totalCount: 0,
      includesDirectories: false,
      truncated: false
    })
    $reviewError.set('Permission denied')
    renderUi(<ReviewPane />)
    expect(screen.getByText('Could not read repository changes')).toBeTruthy()
    expect(screen.queryByText('No changes in this scope')).toBeNull()
    act(() => {
      $reviewError.set(null)
      $reviewIsRepo.set(false)
    })
    expect(screen.getByText('No Git repository')).toBeTruthy()
    expect(screen.queryByText('No changes in this scope')).toBeNull()
  })

  it('disables unsupported scopes and full-file context for an older runtime', () => {
    $reviewScopesSupported.set(false)
    renderUi(<ReviewPane />)
    expect((screen.getByRole('button', { name: 'Changes scope' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Changes options' }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse'
    })
    expect(screen.getByRole('menuitemcheckbox', { name: 'Load full files' }).hasAttribute('data-disabled')).toBe(true)
    expect(screen.getByRole('menuitem', { name: 'View as list' }).hasAttribute('data-disabled')).toBe(false)
  })
})
