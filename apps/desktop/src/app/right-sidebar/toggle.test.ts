import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreviewTarget } from '@/store/preview'

// The titlebar's right button and ⌘J: the right side, the content area in it.
// The area showing → the whole side folds, tabs and all kept; folded → it
// comes back as it was; no tabs → the area opens on a new tab. Real tree, real
// registry, real mirror, the side bound like the controller binds it.

function fileTarget(path: string): PreviewTarget {
  return { kind: 'file', label: path, path, previewKind: 'html', source: path, url: `file://${path}` }
}

const paneOf = (path: string) => `preview-tile:file:file://${path}`

describe('the right side and its button', () => {
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
    const layout = await import('@/store/layout')
    const preview = await import('@/store/preview')
    const session = await import('@/store/session')
    const { watchPreviewTiles } = await import('@/app/chat/preview-tile')
    const toggle = await import('./toggle')

    registry.register({
      id: 'workspace',
      area: 'panes',
      title: 'chat',
      data: { placement: 'main', uncloseable: true },
      render: () => null
    })
    registry.register({ id: 'files', area: 'panes', title: 'files', data: { placement: 'right' }, render: () => null })

    tree.declareDefaultTree(
      model.split('row', [model.group(['workspace'], { id: 'grp-main' }), model.group(['files'], { id: 'grp-files' })])
    )
    tree.watchContributedPanes()
    tree.bindTreeSideVisibility('right', layout.$rightSidebarOpen, layout.setRightSidebarOpen)
    layout.setRightSidebarOpen(true)
    watchPreviewTiles()

    const open = (path: string) => preview.openPreview(fileTarget(path), 'file-browser')
    const zoneOf = (paneId: string) => model.findGroupOfPane(tree.$layoutTree.get()!, paneId)
    const folded = () => tree.$collapsedTreeSides.get().has('right')

    return { folded, layout, model, open, preview, registry, session, toggle, tree, zoneOf }
  }

  it('folds the whole right side with the area in it, and brings it back as it was', async () => {
    const { folded, layout, open, toggle, zoneOf } = await setup()

    open('/work/a.html')
    open('/work/b.html')
    expect(toggle.$contentAreaShowing.get()).toBe(true)

    toggle.toggleRightSidebar()
    expect(folded()).toBe(true)
    expect(layout.$rightSidebarOpen.get()).toBe(false)
    expect(toggle.$contentAreaShowing.get()).toBe(false)

    toggle.toggleRightSidebar()
    expect(folded()).toBe(false)
    expect(toggle.$contentAreaShowing.get()).toBe(true)
    expect(zoneOf(paneOf('/work/b.html'))!.active).toBe(paneOf('/work/b.html'))
  })

  it('opens the area on a new tab for a conversation without tabs', async () => {
    const { layout, preview, toggle } = await setup()

    layout.setRightSidebarOpen(false)
    toggle.toggleRightSidebar()

    expect(layout.$rightSidebarOpen.get()).toBe(true)
    expect(preview.$previewTabs.get().map(tab => tab.target.url)).toEqual(['about:blank'])
    expect(toggle.$contentAreaShowing.get()).toBe(true)
  })

  // A chat never folds with a side: a session tile's column stays on screen.
  it('never folds a chat column with the side', async () => {
    const { folded, open, registry, toggle, tree } = await setup()

    registry.register({
      id: 'session-tile:other',
      area: 'panes',
      title: 'other chat',
      data: { placement: 'main' },
      render: () => null
    })
    open('/work/a.html')

    toggle.toggleRightSidebar()
    expect(folded()).toBe(true)
    expect(tree.paneRootSide('session-tile:other')).toBeNull()
    expect(tree.paneRootSide(paneOf('/work/a.html'))).toBe('right')
  })

  // An area moved off the side columns can't fold with the side; stacked with
  // the chat, the chat comes to the front instead — and back again.
  it('fronts the chat over an area stacked with it', async () => {
    const { open, toggle, tree, zoneOf } = await setup()

    open('/work/a.html')
    tree.moveTreePane(paneOf('/work/a.html'), { groupId: 'grp-main', pos: 'center' })
    tree.activateTreePane('grp-main', paneOf('/work/a.html'))
    expect(toggle.$contentAreaShowing.get()).toBe(true)

    toggle.toggleRightSidebar()
    expect(zoneOf('workspace')!.active).toBe('workspace')
    expect(toggle.$contentAreaShowing.get()).toBe(false)

    toggle.toggleRightSidebar()
    expect(zoneOf('workspace')!.active).toBe(paneOf('/work/a.html'))
  })

  // Folded is the user's choice: coming back to another conversation, or a
  // close falling to the neighbour, fronts a tab but doesn't unfold the side.
  // Opening something is what shows it again.
  it('keeps a folded area folded until something is opened', async () => {
    const { folded, layout, open, preview, session, toggle, zoneOf } = await setup()

    session.$selectedStoredSessionId.set('a')
    open('/work/a.html')
    open('/work/a2.html')
    session.$selectedStoredSessionId.set('b')
    open('/work/b.html')

    toggle.toggleRightSidebar()
    expect(folded()).toBe(true)

    session.$selectedStoredSessionId.set('a')
    expect(folded()).toBe(true)
    expect(zoneOf(paneOf('/work/a2.html'))!.active).toBe(paneOf('/work/a2.html'))

    preview.closeRightRailTab(preview.previewTabId(fileTarget('/work/a2.html')))
    expect(folded()).toBe(true)
    expect(zoneOf(paneOf('/work/a.html'))!.active).toBe(paneOf('/work/a.html'))

    open('/work/a3.html')
    expect(folded()).toBe(false)
    expect(layout.$rightSidebarOpen.get()).toBe(true)
  })
})

// The side used to ride on the file tree's record; on the first run with its
// own, it starts where that record left the side.
describe('the right side after the update', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  const paneStates = (states: Record<string, { open: boolean }>) =>
    window.localStorage.setItem('work4you.desktop.paneStates.v1', JSON.stringify(states))

  it('starts open or folded as the file tree had it', async () => {
    paneStates({ 'file-browser': { open: true } })
    expect((await import('@/store/layout')).$rightSidebarOpen.get()).toBe(true)

    vi.resetModules()
    paneStates({ 'file-browser': { open: false } })
    expect((await import('@/store/layout')).$rightSidebarOpen.get()).toBe(false)
  })

  it('keeps its own record once it has one', async () => {
    paneStates({ 'file-browser': { open: true }, 'right-sidebar': { open: false } })

    expect((await import('@/store/layout')).$rightSidebarOpen.get()).toBe(false)
  })
})
