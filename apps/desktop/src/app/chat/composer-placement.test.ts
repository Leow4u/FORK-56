import { describe, expect, it } from 'vitest'

import { composerMenuSide, dockedComposerAnchor } from './composer-placement'

describe('dockedComposerAnchor', () => {
  it('parks the composer at the pane midline on the empty intro', () => {
    expect(dockedComposerAnchor(true)).toBe('midline')
  })

  it('docks the composer at the bottom once a thread exists', () => {
    expect(dockedComposerAnchor(false)).toBe('bottom')
  })
})

describe('composerMenuSide', () => {
  it('opens menus downward while the composer is centered under the headline', () => {
    expect(composerMenuSide('midline')).toBe('bottom')
  })

  it('opens menus upward once the composer is docked at the bottom', () => {
    expect(composerMenuSide('bottom')).toBe('top')
  })
})
