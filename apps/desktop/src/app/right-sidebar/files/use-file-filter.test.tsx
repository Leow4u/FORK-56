import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import type { Work4YouReadDirResult } from '@/global'
import { $connection } from '@/store/session'

import { clearProjectDirCache } from './ipc'
import { useFileFilter } from './use-file-filter'

beforeEach(() => {
  $connection.set(null)
  clearProjectDirCache()
})

afterEach(() => {
  cleanup()
  clearProjectDirCache()
  delete (window as unknown as { work4youDesktop?: unknown }).work4youDesktop
})

it('discards a delayed result after the workspace changes', async () => {
  let finishOld!: (result: Work4YouReadDirResult) => void

  const oldRead = new Promise<Work4YouReadDirResult>(resolve => {
    finishOld = resolve
  })

  const readDir = vi.fn(async (path: string) =>
    path === '/old'
      ? oldRead
      : {
          entries: [{ name: 'new.md', path: '/new/new.md', isDirectory: false }]
        }
  )

  window.work4youDesktop = { readDir, gitRoot: async () => null } as unknown as Window['work4youDesktop']
  const hook = renderHook(({ cwd }) => useFileFilter(cwd, true), { initialProps: { cwd: '/old' } })
  await waitFor(() => expect(readDir).toHaveBeenCalledWith('/old'))
  hook.rerender({ cwd: '/new' })
  await waitFor(() => expect(hook.result.current.data[0]?.name).toBe('new.md'))
  await act(async () => {
    finishOld({ entries: [{ name: 'old.md', path: '/old/old.md', isDirectory: false }] })
  })
  expect(hook.result.current.data.map(node => node.name)).toEqual(['new.md'])
})

it('cancels the pending scan when the filter is cleared or the tree is hidden', async () => {
  const readDir = vi.fn(async () => ({ entries: [] }))
  window.work4youDesktop = { readDir, gitRoot: async () => null } as unknown as Window['work4youDesktop']
  const hook = renderHook(({ enabled }) => useFileFilter('/repo', enabled), { initialProps: { enabled: true } })
  hook.rerender({ enabled: false })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 220))
  })
  expect(readDir).not.toHaveBeenCalled()
  expect(hook.result.current.loading).toBe(false)
})
