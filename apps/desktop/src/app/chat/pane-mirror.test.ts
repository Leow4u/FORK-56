import { atom } from 'nanostores'
import { describe, expect, it } from 'vitest'

import { allPaneIds, findGroup, group, split } from '@/components/pane-shell/tree/model'
import { $layoutTree } from '@/components/pane-shell/tree/store'
import { registry } from '@/contrib/registry'

import { paneMirror } from './pane-mirror'

const registered = (id: string) => registry.getArea('panes').some(pane => pane.id === id)

describe('paneMirror retained tiles', () => {
  // A tile can leave the source without being closed — another conversation's
  // preview is out of view, not gone. Its contribution goes, but its slot in
  // the layout stays so it returns exactly where it was.
  it("keeps an out-of-view tile's slot, and drops it once the tile is gone for good", () => {
    const $tiles = atom<{ id: string }[]>([{ id: 'a' }, { id: 'b' }])
    const $retained = atom<string[]>(['a', 'b'])

    paneMirror<{ id: string }>({
      close: () => undefined,
      key: tile => tile.id,
      minWidth: '10rem',
      prefix: 'retain-test',
      render: () => null,
      retain: $retained,
      source: $tiles,
      title: key => key
    })()

    $layoutTree.set(
      split('row', [
        group(['workspace'], { active: 'workspace', id: 'main' }),
        group(['retain-test:a', 'retain-test:b'], { active: 'retain-test:a', id: 'area' })
      ])
    )

    $tiles.set([{ id: 'a' }])

    expect(registered('retain-test:b')).toBe(false)
    expect(allPaneIds($layoutTree.get()!)).toContain('retain-test:b')

    $tiles.set([{ id: 'a' }, { id: 'b' }])

    expect(registered('retain-test:b')).toBe(true)
    expect(findGroup($layoutTree.get()!, 'area')?.panes).toEqual(['retain-test:a', 'retain-test:b'])

    $tiles.set([{ id: 'a' }])
    $retained.set(['a'])

    expect(allPaneIds($layoutTree.get()!)).not.toContain('retain-test:b')
    expect(allPaneIds($layoutTree.get()!)).toContain('retain-test:a')
  })

  it('removes a tile that is not retained as soon as it leaves the source', () => {
    const $tiles = atom<{ id: string }[]>([{ id: 'x' }])

    paneMirror<{ id: string }>({
      close: () => undefined,
      key: tile => tile.id,
      minWidth: '10rem',
      prefix: 'plain-test',
      render: () => null,
      source: $tiles,
      title: key => key
    })()

    $layoutTree.set(
      split('row', [
        group(['workspace'], { active: 'workspace', id: 'main' }),
        group(['plain-test:x'], { active: 'plain-test:x', id: 'side' })
      ])
    )

    $tiles.set([])

    expect(registered('plain-test:x')).toBe(false)
    expect(allPaneIds($layoutTree.get()!)).not.toContain('plain-test:x')
  })
})
