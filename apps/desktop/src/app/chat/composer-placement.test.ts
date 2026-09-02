import { describe, expect, it } from 'vitest'

import { dockedComposerAnchor } from './composer-placement'

describe('dockedComposerAnchor', () => {
  it('parks the composer at the pane midline on the empty intro', () => {
    expect(dockedComposerAnchor(true)).toBe('midline')
  })

  it('docks the composer at the bottom once a thread exists', () => {
    expect(dockedComposerAnchor(false)).toBe('bottom')
  })
})
