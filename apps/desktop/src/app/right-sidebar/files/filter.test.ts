import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $connection } from '@/store/session'

import { fileBreadcrumb, findTreeNode, hasTreeMatch, readFilterTree } from './filter'
import { clearProjectDirCache } from './ipc'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'work4you-file-filter-'))
  $connection.set(null)
  clearProjectDirCache()
  window.work4youDesktop = {
    gitRoot: async () => root,
    readDir: async (path: string) => ({
      entries: (await readdir(path, { withFileTypes: true })).map(entry => ({
        name: entry.name,
        path: join(path, entry.name),
        isDirectory: entry.isDirectory()
      }))
    }),
    readFileDataUrl: async (path: string) => `data:text/plain;base64,${(await readFile(path)).toString('base64')}`
  } as unknown as Window['work4youDesktop']
})

afterEach(async () => {
  delete (window as unknown as { work4youDesktop?: unknown }).work4youDesktop
  $connection.set(null)
  clearProjectDirCache()
  // root is the exact directory returned by mkdtemp above.
  await rm(root, { recursive: true, force: true })
})

describe('file filtering through the filesystem bridge', () => {
  it('finds a file in an unopened folder and honors the browser exclusions and gitignore', async () => {
    await mkdir(join(root, 'src'))
    await mkdir(join(root, 'node_modules'))
    await writeFile(join(root, 'src', 'REPORT.md'), 'report')
    await writeFile(join(root, 'private.txt'), 'hidden')
    await writeFile(join(root, '.gitignore'), 'private.txt\n')
    const result = await readFilterTree(root, new AbortController().signal)
    expect(result.partial).toBe(false)
    expect(hasTreeMatch(result.data, 'report')).toBe(true)
    expect(findTreeNode(result.data, join(root, 'src', 'REPORT.md'))?.name).toBe('REPORT.md')
    expect(hasTreeMatch(result.data, 'private')).toBe(false)
    expect(hasTreeMatch(result.data, 'node_modules')).toBe(false)
  })

  it('reports incomplete results when a directory cannot be read', async () => {
    await mkdir(join(root, 'denied'))
    const read = window.work4youDesktop!.readDir!
    window.work4youDesktop!.readDir = async path =>
      path.endsWith('denied') ? { entries: [], error: 'EACCES' } : read(path)
    expect((await readFilterTree(root, new AbortController().signal)).partial).toBe(true)
  })

  it('does not continue traversal after cancellation', async () => {
    const controller = new AbortController()

    const read = vi.fn(async () => {
      controller.abort()

      return { entries: [{ name: 'next', path: join(root, 'next'), isDirectory: true }] }
    })

    window.work4youDesktop!.gitRoot = async () => null
    window.work4youDesktop!.readDir = read
    await readFilterTree(root, controller.signal)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('uses the active remote profile rather than reading local paths', async () => {
    $connection.set({ mode: 'remote', profile: 'remote-files', baseUrl: 'https://example.test' } as never)
    const local = vi.spyOn(window.work4youDesktop!, 'readDir')

    const api = vi.fn(async ({ path }: { path: string }) =>
      path.startsWith('/api/fs/git-root')
        ? { root: null }
        : { entries: [{ name: 'remote.md', path: '/repo/remote.md', isDirectory: false }] }
    )

    window.work4youDesktop!.api = api as never
    const result = await readFilterTree('/repo', new AbortController().signal)
    expect(hasTreeMatch(result.data, 'remote')).toBe(true)
    expect(local).not.toHaveBeenCalled()
    expect(api.mock.calls.every(([request]) => (request as { profile?: string }).profile === 'remote-files')).toBe(true)
    $connection.set(null)
  })
})

describe('file locations', () => {
  it('compares Windows spelling but preserves the displayed name', () => {
    expect(fileBreadcrumb('C:\\DEV\\Repo', 'c:/dev/repo/docs/Readme.md')).toEqual(['Repo', 'docs', 'Readme.md'])
    expect(fileBreadcrumb('/repo', '/repo-other/file.md')).toEqual(['repo-other', 'file.md'])
    expect(fileBreadcrumb('/', '/docs/readme.md')).toEqual(['/', 'docs', 'readme.md'])
  })
})
