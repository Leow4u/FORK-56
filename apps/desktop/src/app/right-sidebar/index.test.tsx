import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Work4YouReadDirResult } from '@/global'
import { $connection, setCurrentCwd } from '@/store/session'

import { resetProjectTreeState } from './files/use-project-tree'
import { $fileViews } from './files/view-state'

import { RightSidebarPane } from './index'

const readDir = vi.fn<(path: string) => Promise<Work4YouReadDirResult>>()

function installBridge() {
  ;(window as unknown as { work4youDesktop: { readDir: typeof readDir } }).work4youDesktop = { readDir }
}

describe('RightSidebarPane', () => {
  beforeEach(() => {
    $connection.set(null)
    resetProjectTreeState()
    $fileViews.set({})
    readDir.mockReset()
    readDir.mockResolvedValue({ entries: [{ isDirectory: false, name: 'README.md', path: '/repo/README.md' }] })
    installBridge()
  })

  afterEach(() => {
    cleanup()
    $connection.set(null)
    setCurrentCwd('')
    resetProjectTreeState()
    $fileViews.set({})
    delete (window as unknown as { work4youDesktop?: unknown }).work4youDesktop
  })

  it('renders the tree whenever the session has a working dir (repo or not) — no picker', async () => {
    setCurrentCwd('/repo')

    render(<RightSidebarPane onActivateFile={vi.fn()} onActivateFolder={vi.fn()} />)

    const refresh = await screen.findByRole('button', { name: 'Refresh tree' })

    readDir.mockClear()
    fireEvent.click(refresh)
    await waitFor(() => expect(readDir).toHaveBeenCalledWith('/repo'))

    // The freeform folder picker is retired.
    expect(screen.queryByRole('button', { name: 'Open folder' })).toBeNull()
  })

  it('shows no tree for a detached chat (no working dir)', async () => {
    setCurrentCwd('')

    render(<RightSidebarPane onActivateFile={vi.fn()} onActivateFolder={vi.fn()} />)

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Refresh tree' })).toBeNull())
    expect(readDir).not.toHaveBeenCalled()
  })
  it('hides only the tree and preserves the reader and its draft', async () => {
    setCurrentCwd('/repo')
    render(
      <RightSidebarPane selectedPath="/repo/README.md">
        <textarea aria-label="Draft" defaultValue="unsaved" />
      </RightSidebarPane>
    )
    const reader = screen.getByRole('textbox', { name: 'Draft' }) as HTMLTextAreaElement
    const tree = screen.getByRole('complementary')
    expect(screen.getByLabelText('File location').textContent).toContain('README.md')
    fireEvent.click(screen.getByRole('button', { name: 'Hide file tree' }))
    expect(tree.classList.contains('hidden')).toBe(true)
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(reader)
    expect(reader.value).toBe('unsaved')
    fireEvent.click(screen.getByRole('button', { name: 'Show file tree' }))
    expect(tree.classList.contains('hidden')).toBe(false)
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(reader)
  })

  it('shows a truthful no-match state after filtering the workspace', async () => {
    setCurrentCwd('/repo')
    render(<RightSidebarPane />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter files...' }), { target: { value: 'missing-file' } })
    expect(await screen.findByText('No matching files.')).toBeTruthy()
  })

  it('shares the tree choice with file tabs but isolates another workspace', async () => {
    setCurrentCwd('/repo')
    const browser = render(<RightSidebarPane />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter files...' }), { target: { value: 'README' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hide file tree' }))
    browser.unmount()

    const document = render(
      <RightSidebarPane selectedPath="/repo/README.md">
        <p>Document content</p>
      </RightSidebarPane>
    )

    expect(screen.getByRole('button', { name: 'Show file tree' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show file tree' }))
    expect((screen.getByRole('textbox', { name: 'Filter files...' }) as HTMLInputElement).value).toBe('README')
    document.unmount()

    setCurrentCwd('/other')
    render(<RightSidebarPane />)
    expect(screen.getByRole('button', { name: 'Hide file tree' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Filter files...' }) as HTMLInputElement).value).toBe('')
  })
})
