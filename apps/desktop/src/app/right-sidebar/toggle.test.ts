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
    const { bindContentTools, contentToolData } = await import('./content-tools')
    const toggle = await import('./toggle')

    registry.register({
      id: 'workspace',
      area: 'panes',
      title: 'chat',
      data: { placement: 'main', uncloseable: true },
      render: () => null
    })

    for (const id of ['files', 'review', 'terminal'] as const) {
      registry.register({ id, area: 'panes', title: id, data: contentToolData(id), render: () => null })
    }

    tree.declareDefaultTree(
      model.split('row', [
        model.group(['workspace'], { id: 'grp-main' }),
        model.group(['files', 'review', 'terminal'], { id: 'grp-files' })
      ])
    )
    tree.watchContributedPanes()
    tree.bindTreeSideVisibility('right', layout.$rightSidebarOpen, layout.setRightSidebarOpen)
    layout.setRightSidebarOpen(true)
    bindContentTools()
    watchPreviewTiles()

    const open = (path: string) => preview.openPreview(fileTarget(path), 'file-browser')
    const zoneOf = (paneId: string) => model.findGroupOfPane(tree.$layoutTree.get()!, paneId)
    const folded = () => tree.$collapsedTreeSides.get().has('right')

    return { folded, layout, model, open, preview, registry, session, toggle, tree, zoneOf }
  }

  it('opens tools and previews in one group through their existing openers', async () => {
    const { layout, open, session, tree, zoneOf, toggle } = await setup()
    session.setCurrentCwd('/work')
    open('/work/a.html')
    const area = zoneOf(paneOf('/work/a.html'))!.id

    for (const pane of ['files', 'review', 'terminal']) {
      tree.restoreTreePane(pane)
      expect(zoneOf(pane)!.id).toBe(area)
      expect(zoneOf(pane)!.active).toBe(pane)
      expect(tree.isPaneVisible(pane)).toBe(true)
      expect(tree.isPaneVisible(paneOf('/work/a.html'))).toBe(false)
      expect(toggle.$contentAreaShowing.get()).toBe(true)
      toggle.toggleRightSidebar()
      expect(layout.$rightSidebarOpen.get()).toBe(false)
      expect(tree.isPaneVisible(pane)).toBe(false)
      tree.togglePaneVisible(pane)
      expect(layout.$rightSidebarOpen.get()).toBe(true)
      expect(tree.isPaneVisible(pane)).toBe(true)
      toggle.toggleRightSidebar()
      toggle.toggleRightSidebar()
      expect(zoneOf(pane)!.active).toBe(pane)
      tree.closeTreePane(pane)
      expect(tree.$hiddenTreePanes.get().has(pane)).toBe(true)
    }
  })

  it('revealing a file fronts Files even when its tab was already open', async () => {
    const { layout, open, session, tree, zoneOf } = await setup()
    session.setCurrentCwd('/work')
    tree.restoreTreePane('files')
    open('/work/a.html')
    layout.setRightSidebarOpen(false)
    layout.revealFileInTree('/work/README.md')
    expect(zoneOf('files')!.active).toBe('files')
    expect(tree.isPaneVisible('files')).toBe(true)
  })

  it('adopts installed separate tool columns into the existing preview area', async () => {
    const tree = await import('@/components/pane-shell/tree/store')
    const model = await import('@/components/pane-shell/tree/model')
    const { registry } = await import('@/contrib/registry')
    const { contentToolData } = await import('./content-tools')
    const previewId = paneOf('/work/saved.html')
    tree.$layoutTree.set(
      model.split('row', [
        model.group(['workspace'], { id: 'main' }),
        model.group([previewId], { id: 'saved-area' }),
        model.group(['review']),
        model.group(['files']),
        model.group(['terminal'])
      ])
    )
    registry.register({ id: 'workspace', area: 'panes', data: { placement: 'main' }, render: () => null })
    registry.register({ id: previewId, area: 'panes', data: { placement: 'main' }, render: () => null })

    for (const id of ['files', 'review', 'terminal'] as const) {
      registry.register({ id, area: 'panes', data: contentToolData(id), render: () => null })
    }

    tree.watchContributedPanes()

    for (const pane of ['files', 'review', 'terminal', previewId]) {
      expect(model.findGroupOfPane(tree.$layoutTree.get()!, pane)?.id).toBe('saved-area')
    }

    expect(model.findGroupOfPane(tree.$layoutTree.get()!, 'workspace')?.id).toBe('main')
    expect(model.findGroupOfPane(tree.$layoutTree.get()!, previewId)?.active).toBe(previewId)
  })

  it('selecting a project in a fresh draft leaves Files closed and the preview in front', async () => {
    const { layout, open, session, tree, zoneOf } = await setup()
    const projects = await import('@/store/projects')
    session.setCurrentCwd('/previous')
    tree.restoreTreePane('files')
    session.setCurrentCwd('')
    open('/work/a.html')
    projects.retargetDraftWorkspace('/dutelog')

    expect(session.$currentCwd.get()).toBe('/dutelog')
    expect(layout.$fileBrowserOpen.get()).toBe(false)
    expect(tree.$hiddenTreePanes.get().has('files')).toBe(true)
    expect(zoneOf(paneOf('/work/a.html'))!.active).toBe(paneOf('/work/a.html'))

    layout.setRightSidebarOpen(false)
    projects.retargetDraftWorkspace('/other')
    expect(layout.$rightSidebarOpen.get()).toBe(false)
    expect(layout.$fileBrowserOpen.get()).toBe(false)
  })

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

  it('reveals the first requested preview after switching between empty conversations', async () => {
    const { folded, layout, open, session, toggle } = await setup()

    layout.setRightSidebarOpen(false)
    session.$selectedStoredSessionId.set('empty-a')
    session.$selectedStoredSessionId.set('empty-b')
    open('/work/requested.html')

    expect(folded()).toBe(false)
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
