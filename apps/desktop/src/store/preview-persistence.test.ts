import { afterEach, describe, expect, it, vi } from 'vitest'

import { decodePreviewTabs } from './preview'

describe('restored tabs', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  // The restore runs while the module loads. A Browser tab among the rows must
  // come back, and must not take the tabs beside it down with it.
  it('restores the Browser tab and the tabs beside it', async () => {
    const page = 'https://example.com'
    const file = '/work/notes.md'

    window.localStorage.setItem(
      'work4you.desktop.previewTabs.v2',
      JSON.stringify([
        {
          id: `file:file://${file}`,
          target: { kind: 'file', label: 'notes.md', path: file, source: file, url: `file://${file}` }
        },
        { id: 'url:browser', target: { kind: 'url', label: page, source: page, url: page } }
      ])
    )

    vi.resetModules()
    const store = await import('./preview')

    expect(store.$previewTabs.get().map(tab => tab.id)).toEqual([`file:file://${file}`, 'url:browser'])
  })
})

describe('persisted preview migration', () => {
  it('upgrades a pre-PDF remote tab from binary to pdf', () => {
    const source = '/remote/.work4you/desktop-attachments/spec.pdf'

    const [restored] = decodePreviewTabs(
      JSON.stringify([
        {
          id: `file:file://${source}`,
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
})
