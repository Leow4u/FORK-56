import { describe, expect, it } from 'vitest'

import { composerDockWidthRem, composerSurfaceMinHeightPx, dockedComposerAnchor } from './composer-placement'

describe('dockedComposerAnchor', () => {
  it('parks the composer at the pane midline on the empty intro', () => {
    expect(dockedComposerAnchor(true)).toBe('midline')
  })

  it('docks the composer at the bottom once a thread exists', () => {
    expect(dockedComposerAnchor(false)).toBe('bottom')
  })
})

describe('composer dock box', () => {
  it('keeps the occupied thread on the reading-column width', () => {
    expect(composerDockWidthRem(false)).toBe(48)
    expect(composerSurfaceMinHeightPx(false)).toBeUndefined()
  })

  it('narrows and tallens only the empty new-chat box', () => {
    expect(composerDockWidthRem(true)).toBe(40)
    expect(composerSurfaceMinHeightPx(true)).toBe(100)
  })

  it('does not let the empty box share the thread width', () => {
    expect(composerDockWidthRem(true)).toBeLessThan(composerDockWidthRem(false))
  })
})
