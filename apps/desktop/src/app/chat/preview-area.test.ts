import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreviewTarget } from '@/store/preview'

// New previews land in the content area: the first one opens it as a zone
// beside main, every later one stacks into it — the successive columns this
// replaces each took another slice of the chat. Real tree, real registry,
// real mirror: the placement is the tree's adoption of the mirrored pane.

function fileTarget(path: string): PreviewTarget {
  return { kind: 'file', label: path, path, previewKind: 'html', source: path, url: `file://${path}` }
}

describe('preview destination — the content area', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  async function setup() {
    const tree = await import('@/components/pane-shell/tree/store')
    const model = await import('@/components/pane-shell/tree/model')
    const { registry } = await import('@/contrib/registry')
    const preview = await import('@/store/preview')
    const session = await import('@/store/session')
    const { watchPreviewTiles } = await import('./preview-tile')

    registry.register({
      id: 'workspace',
      area: 'panes',
      title: 'chat',
      data: { placement: 'main', uncloseable: true },
      render: () => null
    })

    tree.declareDefaultTree(model.group(['workspace'], { id: 'grp-main' }))
    tree.watchContributedPanes()
    watchPreviewTiles()

    const open = (path: string) => preview.openPreview(fileTarget(path), 'file-browser')
    const zoneOf = (path: string) => model.findGroupOfPane(tree.$layoutTree.get()!, `preview-tile:file:file://${path}`)
    const mainZone = () => model.findGroupOfPane(tree.$layoutTree.get()!, 'workspace')

    return { model, open, preview, session, tree, zoneOf, mainZone }
  }

  it('opens the area beside main once, then stacks every new preview into it', async () => {
    const { open, zoneOf, mainZone } = await setup()

    open('/work/a.html')

    const area = zoneOf('/work/a.html')

    expect(area).toBeTruthy()
    expect(area!.id).not.toBe(mainZone()!.id)

    open('/work/b.html')
    open('/work/c.html')

    expect(zoneOf('/work/b.html')!.id).toBe(area!.id)
    expect(zoneOf('/work/c.html')!.id).toBe(area!.id)
    expect(zoneOf('/work/c.html')!.active).toBe('preview-tile:file:file:///work/c.html')
  })

  // Positions the user chose stay theirs; new content follows the tab in front.
  it('leaves a moved tab where the user put it and stacks new content beside the tab in front', async () => {
    const { open, tree, zoneOf } = await setup()

    open('/work/a.html')
    open('/work/b.html')

    const area = zoneOf('/work/a.html')!

    tree.moveTreePane('preview-tile:file:file:///work/b.html', { groupId: area.id, pos: 'bottom' })

    const moved = zoneOf('/work/b.html')!

    expect(moved.id).not.toBe(area.id)

    open('/work/c.html')

    expect(zoneOf('/work/c.html')!.id).toBe(moved.id)
    expect(zoneOf('/work/a.html')!.id).toBe(area.id)
  })

  // Every conversation shares the one area: a conversation's first tab lands
  // where the others' tabs wait out of view, not in a column of its own.
  // The area strip's "+": a new web tab on the new tab page, every time,
  // stacked into the area in front like any other tab.
  it("opens a new web tab with the area's +, every time", async () => {
    const { model, preview, tree } = await setup()

    tree.$newContentTabAction.get()?.()
    tree.$newContentTabAction.get()?.()

    expect(preview.$previewTabs.get().map(tab => [tab.id, tab.target.url])).toEqual([
      ['url:browser', 'about:blank'],
      ['url:browser:2', 'about:blank']
    ])

    const zoneOf = (paneId: string) => model.findGroupOfPane(tree.$layoutTree.get()!, paneId)

    expect(zoneOf('preview-tile:url:browser:2')?.id).toBe(zoneOf('preview-tile:url:browser')?.id)
    expect(zoneOf('preview-tile:url:browser:2')?.active).toBe('preview-tile:url:browser:2')
  })

  it("gives another conversation's first tab the same area", async () => {
    const { open, session, zoneOf } = await setup()

    session.$selectedStoredSessionId.set('a')
    open('/work/a.html')

    const area = zoneOf('/work/a.html')!

    session.$selectedStoredSessionId.set('b')
    open('/work/b.html')

    expect(zoneOf('/work/b.html')!.id).toBe(area.id)
  })
})
