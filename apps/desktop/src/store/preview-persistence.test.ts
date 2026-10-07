import { afterEach, describe, expect, it, vi } from 'vitest'

import { decodePreviewTabs } from './preview'

const TABS_KEY = 'work4you.desktop.previewTabs.v4'
const STATE_KEY = 'work4you.desktop.previewTabState.v1'

describe('restored tabs', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  const page = 'https://example.com'
  const file = '/work/notes.md'
  const kept = { profile: 'default', session: 'kept' }
  const browserRow = { id: 'url:browser', owner: kept, target: { kind: 'url', label: page, source: page, url: page } }

  // The restore runs while the module loads. A Browser tab among the rows must
  // come back, and must not take the tabs beside it down with it.
  it('restores the Browser tab and the tabs beside it', async () => {
    window.localStorage.setItem(
      TABS_KEY,
      JSON.stringify([
        {
          id: `file:file://${file}`,
          owner: kept,
          target: { kind: 'file', label: 'notes.md', path: file, source: file, url: `file://${file}` }
        },
        browserRow
      ])
    )

    vi.resetModules()
    const store = await import('./preview')

    expect(store.$allPreviewTabs.get().map(tab => tab.id)).toEqual([`file:file://${file}`, 'url:browser'])
  })

  it('reopens a conversation where it was, and drops what nothing is left to use', async () => {
    window.localStorage.setItem(TABS_KEY, JSON.stringify([browserRow]))
    // `gone` only ever had an artifact tab, and artifacts are never kept.
    window.localStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        default: {
          gone: { active: 'artifact:report' },
          kept: { active: 'url:browser', urls: { 'url:browser': `${page}/docs` } }
        }
      })
    )

    vi.resetModules()
    const store = await import('./preview')

    expect(store.previewResumeUrl('url:browser', kept)).toBe(`${page}/docs`)

    const stored = JSON.parse(window.localStorage.getItem(STATE_KEY) ?? '{}') as Record<string, Record<string, unknown>>

    expect(stored.default?.kept).toBeDefined()
    expect(stored.default?.gone).toBeUndefined()
  })

  // A restored web tab is named before its page loads again; a conversation
  // remembered only by a page's name is still remembered.
  it('names a restored web tab after its page', async () => {
    window.localStorage.setItem(TABS_KEY, JSON.stringify([browserRow]))
    window.localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ default: { kept: { titles: { 'url:browser': 'Example Domain', 'url:stale': 42 } } } })
    )

    vi.resetModules()
    const store = await import('./preview')
    const session = await import('./session')

    session.$selectedStoredSessionId.set('kept')

    expect(store.$previewPages.get()['url:browser']).toEqual({ title: 'Example Domain', url: page })

    const stored = JSON.parse(window.localStorage.getItem(STATE_KEY) ?? '{}') as Record<string, Record<string, unknown>>

    expect(stored.default?.kept).toBeDefined()
  })
})

describe('persisted preview migration', () => {
  it('upgrades a pre-PDF remote tab from binary to pdf', () => {
    const source = '/remote/.work4you/desktop-attachments/spec.pdf'

    const [restored] = decodePreviewTabs(
      JSON.stringify([
        {
          id: `file:file://${source}`,
          owner: { profile: 'default', session: 'session-a' },
          target: {
            binary: true,
            kind: 'file',
            label: 'spec.pdf',
            large: true,
            path: source,
            previewKind: 'binary',
            source,
            url: `file://${source}`
          }
        }
      ])
    )

    expect(restored?.target.previewKind).toBe('pdf')
  })

  it('leaves a persisted non-PDF binary tab unchanged', () => {
    const source = '/work/archive.zip'

    const [restored] = decodePreviewTabs(
      JSON.stringify([
        {
          id: `file:file://${source}`,
          owner: { profile: 'default', session: 'session-a' },
          target: {
            binary: true,
            kind: 'file',
            label: 'archive.zip',
            path: source,
            previewKind: 'binary',
            source,
            url: `file://${source}`
          }
        }
      ])
    )

    expect(restored?.target.previewKind).toBe('binary')
  })

  it.each(['report.pdf#notes', 'report.pdf?draft'])('treats %s as a literal filesystem path', sourceName => {
    const source = `/work/${sourceName}`

    const [restored] = decodePreviewTabs(
      JSON.stringify([
        {
          id: `file:file://${encodeURI(source)}`,
          owner: { profile: 'default', session: 'session-a' },
          target: {
            binary: true,
            kind: 'file',
            label: sourceName,
            path: source,
            previewKind: 'binary',
            source,
            url: `file:///work/${encodeURIComponent(sourceName)}`
          }
        }
      ])
    )

    expect(restored?.target.previewKind).toBe('binary')
  })

  it('does not overwrite a non-binary PDF preview kind', () => {
    const source = '/work/spec.pdf'

    const [restored] = decodePreviewTabs(
      JSON.stringify([
        {
          id: `file:file://${source}`,
          owner: { profile: 'default', session: 'session-a' },
          target: {
            kind: 'file',
            label: 'spec.pdf',
            path: source,
            previewKind: 'text',
            source,
            url: `file://${source}`
          }
        }
      ])
    )

    expect(restored?.target.previewKind).toBe('text')
  })

  // Rows written before tabs had an owner can't be placed in a conversation.
  it('drops rows that carry no conversation', () => {
    const source = '/work/notes.md'

    expect(
      decodePreviewTabs(
        JSON.stringify([
          {
            id: `file:file://${source}`,
            target: { kind: 'file', label: 'notes.md', path: source, source, url: `file://${source}` }
          }
        ])
      )
    ).toEqual([])
  })

  it("keeps each conversation's last Browser page", () => {
    const browser = (session: string, url: string) => ({
      id: 'url:browser',
      owner: { profile: 'default', session },
      target: { kind: 'url', label: url, source: url, url }
    })

    const restored = decodePreviewTabs(
      JSON.stringify([
        browser('a', 'https://a-old.example'),
        browser('b', 'https://b.example'),
        browser('a', 'https://a-new.example')
      ])
    )

    expect(restored.map(tab => [tab.owner.session, tab.target.url])).toEqual([
      ['b', 'https://b.example'],
      ['a', 'https://a-new.example']
    ])
  })
})
