import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as TreeStore from '@/components/pane-shell/tree/store'
import { $allPreviewTabs, $previewTabs, closeRightRailTab, openPreview } from '@/store/preview'
import { $recentPreviews } from '@/store/preview-recents'
import { $currentCwd } from '@/store/session'

import { PreviewNewTab } from './preview-new-tab'

const { restoreTreePane } = vi.hoisted(() => ({ restoreTreePane: vi.fn() }))

vi.mock('@/components/pane-shell/tree/store', async importOriginal => ({
  ...(await importOriginal<typeof TreeStore>()),
  restoreTreePane
}))

afterEach(() => {
  cleanup()
  restoreTreePane.mockReset()
  $currentCwd.set('')
  $recentPreviews.set([])
  $allPreviewTabs.set([])
})

const row = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement

// A row brings its tool up where it already lives — through the pane's own
// reveal path, which opens it the way its toggle does and never hides it.
describe('new tab tools', () => {
  it('shows honest empty states without manufactured sites or files', () => {
    render(<PreviewNewTab />)
    expect(screen.getByText('Sites opened in this conversation will appear here.')).toBeTruthy()
    expect(screen.getByText('Files and pages opened in this conversation will appear here.')).toBeTruthy()
  })

  it('reopens a closed recent file through the preview store', () => {
    openPreview({
      kind: 'file',
      path: '/work/notes.md',
      label: 'notes.md',
      source: '/work/notes.md',
      url: 'file:///work/notes.md'
    })
    closeRightRailTab($previewTabs.get()[0].id)
    render(<PreviewNewTab />)
    fireEvent.click(row(/notes.md/))
    expect($previewTabs.get()[0].target.path).toBe('/work/notes.md')
  })

  it('reveals each tool where it lives', () => {
    $currentCwd.set('/work')
    render(<PreviewNewTab />)

    fireEvent.click(row(/Files/))
    fireEvent.click(row(/Changes/))
    fireEvent.click(row(/Terminal/))

    expect(restoreTreePane.mock.calls).toEqual([['files'], ['review'], ['terminal']])
  })

  it('keeps Files and Changes to a project, and says so', () => {
    render(<PreviewNewTab />)

    expect(row(/Files/).disabled).toBe(true)
    expect(row(/Changes/).disabled).toBe(true)
    expect(screen.getByText('Files and Changes need an open project.')).toBeTruthy()

    fireEvent.click(row(/Terminal/))
    expect(restoreTreePane).toHaveBeenCalledWith('terminal')
  })
})
