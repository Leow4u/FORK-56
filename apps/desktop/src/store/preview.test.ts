import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { SessionInfo } from '@/types/work4you'

import { $rightRailActiveTabId } from './layout'
import {
  $allPreviewTabs,
  $previewPages,
  $previewServerRestart,
  $previewServerRestartStatus,
  $previewTabs,
  $previewTarget,
  $previewTileSession,
  agentPreviewTab,
  beginPreviewServerRestart,
  closePreviewForSource,
  closePreviewMatching,
  closePreviewMatchingIn,
  closeRightRail,
  closeRightRailTab,
  followPreviewTile,
  forgetPreviewSessions,
  openBrowserTab,
  openNewBrowserTab,
  openPreview,
  previewOwnerFor,
  previewResumeUrl,
  previewTabId,
  previewTabsOf,
  type PreviewTarget,
  progressPreviewServerRestart,
  rememberPreviewIcon,
  rememberPreviewTitle,
  rememberPreviewUrl,
  selectPreviewTab
} from './preview'
import { $activeGatewayProfile } from './profile-identity'
import { $activeSessionId, $selectedStoredSessionId, $sessions } from './session'

function fileTarget(source: string): PreviewTarget {
  return { kind: 'file', label: source, path: source, previewKind: 'html', source, url: `file://${source}` }
}

function urlTarget(source: string): PreviewTarget {
  return { kind: 'url', label: source, source, url: source }
}

function artifactTarget(id: string): PreviewTarget {
  return { kind: 'artifact', label: id, source: id, url: id }
}

function resetPreviewTabs() {
  // Through the store, so what each conversation remembers goes with its tabs.
  for (const tab of $allPreviewTabs.get()) {
    closeRightRail(tab.owner)
  }

  $previewServerRestart.set(null)
  $activeSessionId.set(null)
  $selectedStoredSessionId.set(null)
  $previewTileSession.set(null)
  $sessions.set([])
  $activeGatewayProfile.set('default')
  closeRightRail()
  window.localStorage.clear()
}

describe('preview store', () => {
  beforeEach(resetPreviewTabs)
  afterEach(resetPreviewTabs)

  it('does not notify status subscribers for restart progress text', () => {
    const statuses: string[] = []
    const unsubscribe = $previewServerRestartStatus.subscribe(status => statuses.push(status))

    beginPreviewServerRestart('task-1', 'http://localhost:5174')
    progressPreviewServerRestart('task-1', 'first line')
    progressPreviewServerRestart('task-1', 'second line')
    unsubscribe()

    expect(statuses).toEqual(['idle', 'running'])
  })

  it('opens the pane and fronts the new tab', () => {
    openPreview(fileTarget('/work/demo.html'), 'tool-result')

    expect($rightRailActiveTabId.get()).toBe('file:file:///work/demo.html')
    expect($previewTarget.get()?.path).toBe('/work/demo.html')
  })

  it('gives every kind of target its own tab, side by side', () => {
    openPreview(fileTarget('/work/demo.html'), 'file-browser')
    openPreview(urlTarget('http://localhost:5174'), 'tool-result')
    openPreview(artifactTarget('session-1:dashboard'))

    expect($previewTabs.get().map(tab => tab.target.kind)).toEqual(['file', 'url', 'artifact'])
  })

  // One web tab per site: a page opens in the tab already on its site, else in
  // a blank tab, else in a tab of its own — so the agent opening docs never
  // swaps out the dev server the user works against.
  it('opens each site in its own web tab, and a page of a site in its tab', () => {
    openPreview(urlTarget('http://localhost:5173'), 'tool-result')
    openPreview(urlTarget('https://vitejs.dev/guide'), 'tool-result')

    expect($previewTabs.get().map(tab => [tab.id, tab.target.url])).toEqual([
      ['url:browser', 'http://localhost:5173'],
      ['url:browser:2', 'https://vitejs.dev/guide']
    ])
    expect($rightRailActiveTabId.get()).toBe('url:browser:2')

    openPreview(urlTarget('http://localhost:5173/about'), 'tool-result')

    expect($previewTabs.get().map(tab => tab.target.url)).toEqual([
      'http://localhost:5173/about',
      'https://vitejs.dev/guide'
    ])
    expect($rightRailActiveTabId.get()).toBe('url:browser')
  })

  // A tab's site is where it is now, not where it was opened.
  it('finds a site by the page a tab navigated to', () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')
    rememberPreviewUrl('url:browser', 'https://news.ycombinator.com/item?id=1')

    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result')
    expect($previewTabs.get().map(tab => tab.id)).toEqual(['url:browser'])

    openPreview(urlTarget('https://example.com'), 'tool-result')
    expect($previewTabs.get().map(tab => tab.id)).toEqual(['url:browser', 'url:browser:2'])
  })

  it('takes a blank web tab before opening another', () => {
    openNewBrowserTab()
    openPreview(urlTarget('https://example.com'), 'tool-result')

    expect($previewTabs.get().map(tab => [tab.id, tab.target.url])).toEqual([['url:browser', 'https://example.com']])
  })

  // The "+": always a new tab, on the new tab page; the open ones keep theirs.
  it('opens a new blank web tab every time', () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')
    openNewBrowserTab()
    openNewBrowserTab()

    expect($previewTabs.get().map(tab => [tab.id, tab.target.url])).toEqual([
      ['url:browser', 'https://example.com'],
      ['url:browser:2', 'about:blank'],
      ['url:browser:3', 'about:blank']
    ])
    expect($rightRailActiveTabId.get()).toBe('url:browser:3')
  })

  // The Browser shortcut brings back the web tab last in front, page and all.
  it('brings back the web tab last in front', () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')
    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result')
    selectPreviewTab('url:browser')
    openPreview(fileTarget('/work/notes.html'), 'file-browser')

    openBrowserTab()

    expect($rightRailActiveTabId.get()).toBe('url:browser')
    expect($previewTabs.get()).toHaveLength(3)
  })

  // The agent's page tools work on the tab in front when it shows a page, else
  // on the web tab last in front — never on a file's source in front of it.
  it("points the agent's page tools at the page in front, else the web tab last in front", () => {
    openPreview(urlTarget('https://example.com'), 'tool-result')
    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result')
    selectPreviewTab('url:browser')
    expect(agentPreviewTab()?.id).toBe('url:browser')

    openPreview(fileTarget('/work/notes.html'), 'file-browser')
    expect(agentPreviewTab()?.id).toBe('url:browser')

    openPreview(fileTarget('/work/page.html'), 'tool-result')
    expect(agentPreviewTab()?.target.path).toBe('/work/page.html')

    selectPreviewTab(previewTabId(fileTarget('/work/notes.html')))
    closeRightRailTab('url:browser')
    expect(agentPreviewTab()?.id).toBe('url:browser:2')
  })

  it("leaves the agent the tab in front when no web tab is open", () => {
    openPreview(fileTarget('/work/notes.html'), 'file-browser')

    expect(agentPreviewTab()?.target.path).toBe('/work/notes.html')
  })

  // An agent working off screen fronts tabs in its own conversation; those
  // count as in front there.
  it('remembers the web tab last in front of a conversation off screen', () => {
    $selectedStoredSessionId.set('a')

    const a = previewOwnerFor('a')

    $selectedStoredSessionId.set('b')
    openPreview(urlTarget('https://example.com'), 'tool-result', a)
    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result', a)
    openPreview(urlTarget('https://example.com/docs'), 'tool-result', a)
    openPreview(fileTarget('/work/notes.html'), 'file-browser', a)

    expect(agentPreviewTab(a)?.target.url).toBe('https://example.com/docs')
    expect($previewTabs.get()).toEqual([])
  })

  it('re-fronts an existing tab instead of duplicating it, refreshing its target', () => {
    openPreview({ ...fileTarget('/work/demo.html'), label: 'old' }, 'file-browser')
    openPreview({ ...fileTarget('/work/demo.html'), label: 'new' }, 'file-browser')

    expect($previewTabs.get()).toHaveLength(1)
    expect($previewTarget.get()?.label).toBe('new')
  })

  // Browsing to an HTML file means "let me read it"; a tool or link handing you
  // one means "run it". Same road, different render mode on the target.
  it('renders browsed html as source and handed-over html live', () => {
    openPreview(fileTarget('/work/browsed.html'), 'file-browser')
    expect($previewTarget.get()?.renderMode).toBe('source')

    openPreview(fileTarget('/work/handed.html'), 'tool-result')
    expect($previewTarget.get()?.renderMode).toBe('preview')
  })

  it('falls back to a neighbouring tab when the active one closes, and clears the selection on the last', () => {
    openPreview(fileTarget('/work/one.html'), 'file-browser')
    openPreview(fileTarget('/work/two.html'), 'file-browser')

    closeRightRailTab(previewTabId(fileTarget('/work/two.html')))

    expect($previewTarget.get()?.path).toBe('/work/one.html')

    closeRightRailTab(previewTabId(fileTarget('/work/one.html')))
    expect($previewTarget.get()).toBeNull()
    expect($rightRailActiveTabId.get()).toBeNull()
  })

  it('ignores a close for a tab that is not open, so the shortcut falls through', () => {
    closeRightRailTab('file:file:///nowhere.html')

    expect($previewTabs.get()).toHaveLength(0)
  })

  it('closes by the raw source the composer rows were handed', () => {
    openPreview(urlTarget('http://localhost:5174'), 'tool-result')

    expect(closePreviewForSource('http://localhost:5174')).toBe(true)
    expect($previewTabs.get()).toHaveLength(0)
    expect(closePreviewForSource('http://localhost:5174')).toBe(false)
  })

  it('closes a tab whose url or label matches even when source differs', () => {
    openPreview(
      { kind: 'url', label: 'HN', source: 'https://news.ycombinator.com', url: 'https://news.ycombinator.com/' },
      'tool-result'
    )

    expect(closePreviewMatching('https://news.ycombinator.com/')).toBe(true)
    expect($previewTabs.get()).toHaveLength(0)

    openPreview({ ...fileTarget('/work/demo.html'), label: 'Demo' }, 'tool-result')

    expect(closePreviewMatching('Demo')).toBe(true)
    expect($previewTabs.get()).toHaveLength(0)
  })

  it('does not wipe the rail on an empty or unknown close query', () => {
    openPreview(fileTarget('/work/keep.html'), 'file-browser')

    expect(closePreviewMatching()).toBe(false)
    expect(closePreviewMatching('   ')).toBe(false)
    expect(closePreviewMatching('https://missing.example')).toBe(false)
    expect($previewTabs.get()).toHaveLength(1)
  })

  it('persists file and url tabs but never artifacts, whose content is memory-only', () => {
    openPreview(fileTarget('/work/demo.html'), 'file-browser')
    openPreview(urlTarget('http://localhost:5174'), 'tool-result')
    openPreview(artifactTarget('session-1:dashboard'))

    const stored = window.localStorage.getItem('work4you.desktop.previewTabs.v4') ?? ''

    expect(stored).toContain('/work/demo.html')
    expect(stored).toContain('localhost:5174')
    expect(stored).not.toContain('dashboard')
  })

  it('strips inline image bytes rather than pushing megabytes into storage', () => {
    openPreview({ ...fileTarget('/work/shot.png'), dataUrl: 'data:image/png;base64,AAAA', previewKind: 'image' })

    expect(window.localStorage.getItem('work4you.desktop.previewTabs.v4') ?? '').not.toContain('base64')
  })

  it('does not persist remote HTML without its in-memory document', () => {
    openPreview({ ...fileTarget('/remote/report.html'), dataUrl: 'data:text/html;base64,PGgxPnJlbW90ZTwvaDE+' })

    expect(window.localStorage.getItem('work4you.desktop.previewTabs.v4')).toBe('[]')
  })

  it('preserves an explicit HTML source fallback', () => {
    openPreview({ ...fileTarget('/remote/report.html'), renderMode: 'source' }, 'tool-result')

    expect($previewTarget.get()?.renderMode).toBe('source')
  })

  it('does not persist transient remote HTML source fallbacks', () => {
    const target = { ...fileTarget('/remote/report.html'), renderMode: 'source' as const, transient: true }

    openPreview(target, 'tool-result')

    expect(window.localStorage.getItem('work4you.desktop.previewTabs.v4')).toBe('[]')
  })
})

function sessionRow(id: string, root: null | string = null, profile?: string): SessionInfo {
  return { _lineage_root_id: root, id, profile } as SessionInfo
}

function paths(tabs: readonly { target: PreviewTarget }[]) {
  return tabs.map(tab => tab.target.path ?? tab.target.url)
}

describe('conversation tabs', () => {
  beforeEach(resetPreviewTabs)
  afterEach(resetPreviewTabs)

  it('shows only the followed conversation and brings its tabs back, front tab included', () => {
    $selectedStoredSessionId.set('a')
    openPreview(fileTarget('/work/one.html'), 'file-browser')
    openPreview(fileTarget('/work/two.html'), 'file-browser')
    selectPreviewTab(previewTabId(fileTarget('/work/one.html')))

    $selectedStoredSessionId.set('b')
    expect($previewTabs.get()).toHaveLength(0)
    openPreview(fileTarget('/work/three.html'), 'file-browser')
    expect(paths($previewTabs.get())).toEqual(['/work/three.html'])

    $selectedStoredSessionId.set('a')
    expect(paths($previewTabs.get())).toEqual(['/work/one.html', '/work/two.html'])
    expect($previewTarget.get()?.path).toBe('/work/one.html')
  })

  it('closing in one conversation never touches another', () => {
    $selectedStoredSessionId.set('a')
    openPreview(fileTarget('/work/shared.html'), 'file-browser')
    $selectedStoredSessionId.set('b')
    openPreview(fileTarget('/work/shared.html'), 'file-browser')

    closeRightRailTab(previewTabId(fileTarget('/work/shared.html')))
    expect($previewTabs.get()).toHaveLength(0)

    $selectedStoredSessionId.set('a')
    expect(paths($previewTabs.get())).toEqual(['/work/shared.html'])
  })

  it('gives each conversation its own Browser', () => {
    $selectedStoredSessionId.set('a')
    openPreview(urlTarget('https://example.com'), 'tool-result')
    $selectedStoredSessionId.set('b')
    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result')

    expect($previewTarget.get()?.url).toBe('https://news.ycombinator.com')
    $selectedStoredSessionId.set('a')
    expect($previewTarget.get()?.url).toBe('https://example.com')
  })

  it("keeps an agent's tab in its own conversation without taking the screen", () => {
    $selectedStoredSessionId.set('a')
    openPreview(fileTarget('/work/mine.html'), 'file-browser')

    const other = previewOwnerFor('b')

    openPreview(fileTarget('/work/agent.html'), 'tool-result', other)

    expect(paths($previewTabs.get())).toEqual(['/work/mine.html'])
    expect($previewTarget.get()?.path).toBe('/work/mine.html')
    expect(previewTabsOf(other).active?.target.path).toBe('/work/agent.html')

    $selectedStoredSessionId.set('b')
    expect($previewTarget.get()?.path).toBe('/work/agent.html')
  })

  it("closes only the asking conversation's tabs", () => {
    const other = previewOwnerFor('b')

    $selectedStoredSessionId.set('a')
    openPreview(fileTarget('/work/keep.html'), 'file-browser')
    openPreview(fileTarget('/work/b-one.html'), 'tool-result', other)
    openPreview(fileTarget('/work/b-two.html'), 'tool-result', other)

    expect(closePreviewMatchingIn(other, '/work/b-one.html')).toBe(true)
    expect(paths(previewTabsOf(other).tabs)).toEqual(['/work/b-two.html'])

    closeRightRail(other)
    expect(previewTabsOf(other).tabs).toHaveLength(0)
    expect(paths($previewTabs.get())).toEqual(['/work/keep.html'])
  })

  it('keeps a conversation and its tabs together across compression', () => {
    // Opened before the session row was known: keyed on the live id.
    $selectedStoredSessionId.set('tip-1')
    openPreview(fileTarget('/work/report.html'), 'file-browser')

    $sessions.set([sessionRow('tip-1', 'root')])
    expect(paths($previewTabs.get())).toEqual(['/work/report.html'])

    // Compression rotates the live id; the lineage root holds the tabs.
    $sessions.set([sessionRow('tip-2', 'root')])
    $selectedStoredSessionId.set('tip-2')
    expect(paths($previewTabs.get())).toEqual(['/work/report.html'])
  })

  it('keeps profiles apart even when they reuse an id', () => {
    $selectedStoredSessionId.set('a')
    openPreview(fileTarget('/work/default.html'), 'file-browser')

    $activeGatewayProfile.set('work')
    expect($previewTabs.get()).toHaveLength(0)
    openPreview(fileTarget('/work/work.html'), 'file-browser')

    $activeGatewayProfile.set('default')
    expect(paths($previewTabs.get())).toEqual(['/work/default.html'])
  })

  // Each profile's backend mints its own ids, and the lists mix profiles.
  it('keeps two profiles that hold the same id apart, through list refreshes and removal', () => {
    $sessions.set([sessionRow('shared', 'default-root', 'default'), sessionRow('shared', null, 'work')])
    $activeGatewayProfile.set('work')
    $selectedStoredSessionId.set('shared')
    openPreview(fileTarget('/work/work.html'), 'file-browser')

    $activeGatewayProfile.set('default')
    expect($previewTabs.get()).toHaveLength(0)
    openPreview(fileTarget('/work/default.html'), 'file-browser')

    $sessions.set([...$sessions.get()])
    forgetPreviewSessions(['shared', 'shared', null], 'work')

    expect(paths($previewTabs.get())).toEqual(['/work/default.html'])
    $activeGatewayProfile.set('work')
    expect($previewTabs.get()).toHaveLength(0)
  })

  it('hands a live draft its tabs once its conversation exists', () => {
    $activeSessionId.set('runtime-1')
    openPreview(fileTarget('/work/draft.html'), 'file-browser')

    $selectedStoredSessionId.set('created')

    expect(paths($previewTabs.get())).toEqual(['/work/draft.html'])
    expect(previewTabsOf(previewOwnerFor(null)).tabs).toHaveLength(0)
  })

  it('keeps an idle draft its own when another conversation is opened from it', () => {
    openPreview(fileTarget('/work/draft.html'), 'file-browser')

    $selectedStoredSessionId.set('other')
    expect($previewTabs.get()).toHaveLength(0)

    $selectedStoredSessionId.set(null)
    expect(paths($previewTabs.get())).toEqual(['/work/draft.html'])
  })

  it('follows a session tile the user works in, then the primary chat again', () => {
    $selectedStoredSessionId.set('main')
    openPreview(fileTarget('/work/main.html'), 'file-browser')

    followPreviewTile('tile')
    expect($previewTabs.get()).toHaveLength(0)
    openPreview(fileTarget('/work/tile.html'), 'file-browser')

    followPreviewTile(null)
    expect(paths($previewTabs.get())).toEqual(['/work/main.html'])
    expect(paths(previewTabsOf(previewOwnerFor('tile')).tabs)).toEqual(['/work/tile.html'])
  })

  it('forgets an archived or deleted conversation in its own profile only', () => {
    $sessions.set([sessionRow('tip', 'root', 'default'), sessionRow('tip', null, 'work')])
    $selectedStoredSessionId.set('tip')
    openPreview(fileTarget('/work/gone.html'), 'file-browser')
    $activeGatewayProfile.set('work')
    openPreview(fileTarget('/work/kept.html'), 'file-browser')
    $activeGatewayProfile.set('default')
    $selectedStoredSessionId.set(null)

    forgetPreviewSessions(['tip', 'tip', 'root'], 'default')

    expect(previewTabsOf({ profile: 'default', session: 'root' }).tabs).toHaveLength(0)
    expect(paths(previewTabsOf({ profile: 'work', session: 'tip' }).tabs)).toEqual(['/work/kept.html'])
  })

  it('reopens a web tab where it had navigated, and starts over for a new page', () => {
    $selectedStoredSessionId.set('a')
    openPreview(urlTarget('https://example.com'), 'tool-result')
    rememberPreviewUrl('url:browser', 'https://example.com/docs')

    $selectedStoredSessionId.set('b')
    $selectedStoredSessionId.set('a')
    expect(previewResumeUrl('url:browser')).toBe('https://example.com/docs')

    // Back on the page it was opened with: nothing to remember.
    rememberPreviewUrl('url:browser', 'https://example.com')
    expect(previewResumeUrl('url:browser')).toBeUndefined()

    rememberPreviewUrl('url:browser', 'https://example.com/docs')
    openPreview(urlTarget('https://example.com/blog'), 'tool-result')
    expect(previewResumeUrl('url:browser')).toBeUndefined()
  })

  // The page keeps moving while the area switches to another conversation (the
  // old pane unmounts a render later): the address belongs to the page's own
  // conversation, never to the one now on screen.
  it("remembers a page's address under the conversation it belongs to", () => {
    $selectedStoredSessionId.set('a')
    openPreview(urlTarget('https://example.com'), 'tool-result')

    const a = previewOwnerFor('a')

    $selectedStoredSessionId.set('b')
    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result')
    rememberPreviewUrl('url:browser', 'https://example.com/late', a)

    expect(previewResumeUrl('url:browser')).toBeUndefined()
    expect(previewResumeUrl('url:browser', a)).toBe('https://example.com/late')
  })

  // A web tab is labelled by its page. The name is kept with the address, in
  // the conversation's own memory, so the tab is named before its page loads
  // again.
  it("names a web tab after its page, in its conversation's own memory", () => {
    $selectedStoredSessionId.set('a')
    openPreview(urlTarget('https://example.com'), 'tool-result')
    rememberPreviewTitle('url:browser', '  Example Domain ')

    expect($previewPages.get()['url:browser']).toEqual({ title: 'Example Domain', url: 'https://example.com' })

    $selectedStoredSessionId.set('b')
    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result')
    expect($previewPages.get()['url:browser']?.title).toBeUndefined()

    $selectedStoredSessionId.set('a')
    expect($previewPages.get()['url:browser']?.title).toBe('Example Domain')

    rememberPreviewTitle('url:browser', '')
    expect($previewPages.get()['url:browser']?.title).toBeUndefined()
  })

  it('says where a web tab is: where it had navigated, else where it opened', () => {
    $selectedStoredSessionId.set('a')
    openPreview(urlTarget('about:blank'), 'manual')
    expect($previewPages.get()['url:browser']?.url).toBe('about:blank')

    rememberPreviewUrl('url:browser', 'https://example.com')
    expect($previewPages.get()['url:browser']?.url).toBe('https://example.com')
  })

  it('forgets a page name with its tab, and when the tab is handed a new page', () => {
    $selectedStoredSessionId.set('a')
    openPreview(urlTarget('https://example.com'), 'tool-result')
    rememberPreviewTitle('url:browser', 'Example Domain')

    openPreview(urlTarget('https://example.com/news'), 'tool-result')
    expect($previewPages.get()['url:browser']?.title).toBeUndefined()

    rememberPreviewTitle('url:browser', 'Hacker News')
    closeRightRailTab('url:browser')
    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result')
    expect($previewPages.get()['url:browser']?.title).toBeUndefined()
  })

  // A file is named by the file, never by the page it renders.
  it('keeps no page name for a file', () => {
    $selectedStoredSessionId.set('a')
    openPreview(fileTarget('/work/page.html'), 'tool-result')
    rememberPreviewTitle(previewTabId(fileTarget('/work/page.html')), 'Rendered page')

    expect($previewPages.get()).toEqual({})
    expect(window.localStorage.getItem('work4you.desktop.previewTabState.v1')).not.toContain('Rendered page')
  })

  // Same race as the address: the page reports its name while the area is
  // switching to another conversation.
  it("remembers a page's name under the conversation it belongs to", () => {
    $selectedStoredSessionId.set('a')
    openPreview(urlTarget('https://example.com'), 'tool-result')

    const a = previewOwnerFor('a')

    $selectedStoredSessionId.set('b')
    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result')
    rememberPreviewTitle('url:browser', 'Example Domain', a)

    expect($previewPages.get()['url:browser']?.title).toBeUndefined()

    $selectedStoredSessionId.set('a')
    expect($previewPages.get()['url:browser']?.title).toBe('Example Domain')
  })

  it("hands a live draft's page names to its conversation", () => {
    $activeSessionId.set('runtime-1')
    openPreview(urlTarget('https://example.com'), 'tool-result')
    rememberPreviewTitle('url:browser', 'Example Domain')

    $selectedStoredSessionId.set('created')

    expect($previewPages.get()['url:browser']?.title).toBe('Example Domain')
  })

  // A web tab leads with the icon its page names, kept with its name. Main
  // fetches it, so only an http(s) icon is kept; a file has its file icon.
  it('keeps the http(s) icon a web tab\'s page names, never a file\'s', () => {
    $selectedStoredSessionId.set('a')
    openPreview(urlTarget('https://example.com'), 'tool-result')
    rememberPreviewIcon('url:browser', 'https://example.com/favicon.ico')

    expect($previewPages.get()['url:browser']?.icon).toBe('https://example.com/favicon.ico')

    rememberPreviewIcon('url:browser', 'data:image/png;base64,AAAA')
    expect($previewPages.get()['url:browser']?.icon).toBeUndefined()

    openPreview(fileTarget('/work/page.html'), 'tool-result')
    rememberPreviewIcon(previewTabId(fileTarget('/work/page.html')), 'https://example.com/rendered.ico')
    expect(window.localStorage.getItem('work4you.desktop.previewTabState.v1')).not.toContain('rendered.ico')
  })

  it("forgets a page's icon with its tab, and when the tab is handed a new page", () => {
    $selectedStoredSessionId.set('a')
    openPreview(urlTarget('https://example.com'), 'tool-result')
    rememberPreviewIcon('url:browser', 'https://example.com/favicon.ico')

    openPreview(urlTarget('https://example.com/news'), 'tool-result')
    expect($previewPages.get()['url:browser']?.icon).toBeUndefined()

    rememberPreviewIcon('url:browser', 'https://news.ycombinator.com/favicon.ico')
    closeRightRailTab('url:browser')
    openPreview(urlTarget('https://news.ycombinator.com'), 'tool-result')
    expect($previewPages.get()['url:browser']?.icon).toBeUndefined()
  })

  it("hands a live draft's page icons to its conversation", () => {
    $activeSessionId.set('runtime-1')
    openPreview(urlTarget('https://example.com'), 'tool-result')
    rememberPreviewIcon('url:browser', 'https://example.com/favicon.ico')

    $selectedStoredSessionId.set('created')

    expect($previewPages.get()['url:browser']?.icon).toBe('https://example.com/favicon.ico')
  })

  it('persists every conversation, each tab with its owner', () => {
    $selectedStoredSessionId.set('a')
    openPreview(fileTarget('/work/a.html'), 'file-browser')
    $selectedStoredSessionId.set('b')
    openPreview(fileTarget('/work/b.html'), 'file-browser')

    const stored = JSON.parse(window.localStorage.getItem('work4you.desktop.previewTabs.v4') ?? '[]') as {
      owner: { session: string }
      target: PreviewTarget
    }[]

    expect(stored.map(tab => [tab.owner.session, tab.target.path])).toEqual([
      ['a', '/work/a.html'],
      ['b', '/work/b.html']
    ])
  })

  it('keeps the selection within the followed conversation', () => {
    $selectedStoredSessionId.set('a')
    openPreview(fileTarget('/work/a.html'), 'file-browser')
    $selectedStoredSessionId.set('b')

    expect($rightRailActiveTabId.get()).toBeNull()
    expect($previewTarget.get()).toBeNull()
    expect(closePreviewMatching('/work/a.html')).toBe(false)
  })
})
