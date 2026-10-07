import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as TreeStore from '@/components/pane-shell/tree/store'
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
})

const card = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement

// A card brings its tool up where it already lives — through the pane's own
// reveal path, which opens it the way its toggle does and never hides it.
describe('new tab tools', () => {
  it('reveals each tool where it lives', () => {
    $currentCwd.set('/work')
    render(<PreviewNewTab />)

    fireEvent.click(card(/Files/))
    fireEvent.click(card(/Diff \/ Review/))
    fireEvent.click(card(/Terminal/))

    expect(restoreTreePane.mock.calls).toEqual([['files'], ['review'], ['terminal']])
  })

  it('keeps Files and Diff / Review to a project, and says so', () => {
    render(<PreviewNewTab />)

    expect(card(/Files/).disabled).toBe(true)
    expect(card(/Diff \/ Review/).disabled).toBe(true)
    expect(screen.getByText('Files and Diff / Review need an open project.')).toBeTruthy()

    fireEvent.click(card(/Terminal/))
    expect(restoreTreePane).toHaveBeenCalledWith('terminal')
  })
})
