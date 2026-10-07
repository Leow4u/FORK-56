/**
 * PREVIEW TILES — every open preview (a file, a URL, an artifact) rendered as a
 * layout-tree pane, the preview analog of session and route tiles.
 *
 * The rail used to bring its OWN tab strip: a second bar beside the zone's own,
 * at a different height, with its own close menu and its own label casing. It
 * predated the layout tree. Now `$previewTabs` mirrors into pane contributions
 * through the same `paneMirror` the other tiles use, so a preview tab IS a zone
 * tab — same strip, same drag/stack/split, same ⌘W, same right-click verbs, and
 * one bar instead of two.
 *
 * Tabs belong to conversations (see store/preview), and the strip shows the
 * conversation the user is working in. Another conversation's tabs are out of
 * view, not closed: their panes keep their place in the layout and come back
 * to it when the user returns to that conversation.
 *
 * All of them share one content area: the first tab opens it as a zone beside
 * main, and every tab after it stacks into that zone instead of opening one
 * more column.
 */

import { useStore } from '@nanostores/react'

import { allPaneIds, findGroup, type LayoutNode } from '@/components/pane-shell/tree/model'
import {
  $activeTreeGroup,
  $layoutTree,
  $newContentTabAction,
  isSessionStripPane,
  revealTreePane
} from '@/components/pane-shell/tree/store'
import { FileTypeIcon } from '@/components/ui/file-type-icon'
import { ToolIcon } from '@/components/ui/tool-icon'
import { translateNow, useI18n } from '@/i18n'
import { isBlankPageUrl } from '@/lib/local-preview'
import { $rightRailActiveTabId, type RightRailTabId } from '@/store/layout'
import {
  $allPreviewTabIds,
  $previewPages,
  $previewTabs,
  $previewTileSession,
  closeRightRailTab,
  followPreviewTile,
  openBrowserTab,
  previewOwnerFor,
  type PreviewPage,
  type PreviewTarget,
  selectPreviewTab
} from '@/store/preview'
import { $selectedStoredSessionId, $sessions, idsShareLineage } from '@/store/session'
import { $focusedStoredSessionId, $sessionTiles } from '@/store/session-states'

import { paneMirror } from './pane-mirror'
import { PreviewTilePane } from './right-rail/preview'
import { forgetPreviewConsole } from './right-rail/preview-console-store'

/** The target behind a tile id, or null once its tab is gone. */
function targetFor(tabId: string): PreviewTarget | null {
  return $previewTabs.get().find(tab => tab.id === tabId)?.target ?? null
}

/** The two names a preview tab can fall back on, from whichever catalog read
 *  is at hand (the live `t` while rendering, `translateNow` while syncing). */
interface PreviewTitleCopy {
  browser: string
  preview: string
}

/** The tab's registered name. A URL is a BROWSER here — the surface, not the
 *  page: a page renames itself as it moves, and re-registering would remount
 *  the pane, reloading the page. The strip shows the page's own name live
 *  (`PreviewTabTitle`). A file names the file; an artifact is titled rather
 *  than located, so its label is the whole name. */
function previewTitle(tabId: string, copy: PreviewTitleCopy): string {
  const target = targetFor(tabId)

  if (!target) {
    return copy.preview
  }

  if (target.kind === 'url') {
    return copy.browser
  }

  if (target.kind === 'artifact') {
    return target.label || copy.preview
  }

  const value = target.label || target.path || target.source || target.url
  const tail = value.split(/[\\/]/).filter(Boolean).at(-1)

  return tail || value || copy.preview
}

/** The registered name, resolved when the tile syncs — outside React, and at
 *  boot possibly before the display language is applied. */
const registeredPreviewTitle = (tabId: string): string =>
  previewTitle(tabId, { browser: translateNow('shell.panes.browser'), preview: translateNow('preview.tab') })

/** What a web tab is labelled with: the new tab page by name, else what its
 *  page is called, else the surface. */
export function webTabTitle(page: PreviewPage, copy: { browser: string; newTab: string }): string {
  if (isBlankPageUrl(page.url)) {
    return copy.newTab
  }

  return page.title || copy.browser
}

/** The tab's label from the live `t`, so the strip follows the language — and
 *  a web tab's from its page, live, so it follows the page without
 *  re-registering. */
export function PreviewTabTitle({ tabId }: { tabId: string }) {
  const { t } = useI18n()
  const page = useStore($previewPages)[tabId as RightRailTabId]

  if (page) {
    return webTabTitle(page, { browser: t.shell.panes.browser, newTab: t.zones.newTab })
  }

  return previewTitle(tabId, { browser: t.shell.panes.browser, preview: t.preview.tab })
}

/** The tab's lead glyph — the same file/tool icon family the file tree and code
 *  fences resolve through, so a `.tsx` peek and its sidebar row agree. */
function PreviewTabLead({ tabId }: { tabId: string }) {
  const target = targetFor(tabId)

  if (!target) {
    return null
  }

  if (target.kind === 'artifact') {
    return <ToolIcon className="opacity-70" name="sparkle" size="0.6875rem" />
  }

  if (target.kind === 'url') {
    return <ToolIcon className="opacity-70" name="globe" size="0.6875rem" />
  }

  return <FileTypeIcon className="opacity-70" path={target.path || target.url} size="0.6875rem" />
}

const PREVIEW_TILE_PREFIX = 'preview-tile'

const previewPaneId = (tabId: string) => `${PREVIEW_TILE_PREFIX}:${tabId}`

/** Where a preview tab entering the layout lands: stacked into the content
 *  area — the zone of the tab in front, else of another of the followed
 *  conversation's tabs, else of any preview still in the layout (another
 *  conversation's, out of view: it is the same area). Undefined when there is
 *  no area yet, so the first tab opens it beside main. Only a tab ENTERING the
 *  layout is placed: panes already in it stay where the user put them. */
export function previewAreaAnchor(
  tabId: string,
  tree: LayoutNode | null,
  frontTabId: null | string,
  followedTabIds: readonly string[]
): string | undefined {
  if (!tree) {
    return undefined
  }

  const own = previewPaneId(tabId)
  const previews = allPaneIds(tree).filter(id => id.startsWith(`${PREVIEW_TILE_PREFIX}:`) && id !== own)
  const preferred = [frontTabId, ...followedTabIds].flatMap(id => (id ? [previewPaneId(id)] : []))

  return preferred.find(id => previews.includes(id)) ?? previews[0]
}

const areaAnchorFor = (tabId: string) =>
  previewAreaAnchor(
    tabId,
    $layoutTree.get(),
    $rightRailActiveTabId.get(),
    $previewTabs.get().map(tab => tab.id)
  )

/** Keep pane contributions mirroring `$previewTabs`, keep the store's selection
 *  and the tree's active pane agreeing, and front a tile when its tab is
 *  selected. Call once from the root. */
export function watchPreviewTiles(): void {
  watchPreviewTileMirror()

  // The area strip's "+" opens the Browser — a blank one when the
  // conversation has none yet.
  $newContentTabAction.set(openBrowserTab)

  // The reveal analog of session tiles (session-states calls revealTreePane on
  // open): `openPreview` selects the tab, and the TREE must front its pane —
  // un-minimize, un-hide, activate in its zone. Both stores, because re-opening
  // the already-active tab changes only `$previewTabs` (fresh tab object), while
  // switching tabs changes only the active id.
  const reveal = () => {
    const tabId = $rightRailActiveTabId.get()

    if (tabId && targetFor(tabId)) {
      revealTreePane(`${PREVIEW_TILE_PREFIX}:${tabId}`)
    }
  }

  $rightRailActiveTabId.listen(reveal)
  $previewTabs.listen(reveal)

  // And the reverse: clicking a preview TAB activates its pane in the TREE
  // only, so the store's selection must follow or `$previewTarget` (⌘L quote
  // labels, the titlebar's has-preview state) keeps reporting the previous
  // tab. Same derivation `$focusedStoredSessionId` uses: the interacted zone's
  // active pane names the tab. Converges with `reveal` — re-selecting the id
  // the tree already fronts is a no-op in both directions.
  const follow = () => {
    const tree = $layoutTree.get()
    const groupId = $activeTreeGroup.get()
    const active = groupId && tree ? findGroup(tree, groupId)?.active : undefined

    if (!active?.startsWith(`${PREVIEW_TILE_PREFIX}:`)) {
      return
    }

    const tabId = active.slice(PREVIEW_TILE_PREFIX.length + 1) as RightRailTabId

    if (targetFor(tabId) && $rightRailActiveTabId.get() !== tabId) {
      selectPreviewTab(tabId)
    }
  }

  $layoutTree.listen(follow)
  $activeTreeGroup.listen(follow)

  watchFollowedChat()
}

/** The chat the interacted zone shows: the primary chat (`null`), a session
 *  tile (its stored id), or no chat at all (`undefined` — this area, a tool,
 *  the sidebar). */
export function interactedChat(
  tree: LayoutNode | null,
  groupId: null | string,
  focusedSessionId: null | string,
  selectedSessionId: null | string
): null | string | undefined {
  const active = groupId && tree ? findGroup(tree, groupId)?.active : undefined

  if (!active || !isSessionStripPane(active)) {
    return undefined
  }

  return focusedSessionId && focusedSessionId !== selectedSessionId ? focusedSessionId : null
}

// The area shows the tabs of the conversation the user is working in: the
// primary chat, or the session tile they last clicked into. Clicking anything
// that isn't a chat — this area itself, a tool, the sidebar — keeps the
// conversation it has. That's why this can't read $focusedStoredSessionId
// directly: it falls back to the primary the moment the interacted zone isn't
// a session tile.
function watchFollowedChat() {
  const followChat = () => {
    const chat = interactedChat(
      $layoutTree.get(),
      $activeTreeGroup.get(),
      $focusedStoredSessionId.get(),
      $selectedStoredSessionId.get()
    )

    if (chat !== undefined) {
      // Keyed on the lineage root when the row is known, so a compression in
      // the tile doesn't lose it.
      followPreviewTile(chat && previewOwnerFor(chat).session)
    }
  }

  $layoutTree.listen(followChat)
  $activeTreeGroup.listen(followChat)

  // Opening a different conversation in the primary chat is working in it. A
  // compression rotation (same conversation, next tip) is not.
  let lastSelected = $selectedStoredSessionId.get()

  $selectedStoredSessionId.listen(selected => {
    const previous = lastSelected

    lastSelected = selected

    if (!previous || !selected || !idsShareLineage(previous, selected, $sessions.get())) {
      followPreviewTile(null)
    }
  })

  // A closed tile can't be followed; the area goes back to the primary chat.
  $sessionTiles.listen(tiles => {
    const tile = $previewTileSession.get()

    if (tile && !tiles.some(item => idsShareLineage(item.storedSessionId, tile, $sessions.get()))) {
      followPreviewTile(null)
    }
  })
}

const watchPreviewTileMirror = paneMirror<{ id: string }>({
  source: $previewTabs,
  // Another conversation's tab is out of view, not closed: its pane keeps its
  // place in the layout until the tab itself closes.
  retain: $allPreviewTabIds,
  key: tab => tab.id,
  prefix: PREVIEW_TILE_PREFIX,
  // The content area: a tab entering the layout stacks into the zone that
  // already shows previews, so new content never opens one more column. The
  // first tab opens the area as its own zone docked beside main, sized by the
  // split weights — NOT anchored to the file tree: the old rail was a
  // files-adjacent strip, and carrying that over welded preview into the file
  // browser's zone, so ⌘J (toggle file browser) took the preview with it.
  anchor: tab => areaAnchorFor(tab.id),
  dir: tab => (areaAnchorFor(tab.id) ? 'center' : 'right'),
  minWidth: '22rem',
  title: registeredPreviewTitle,
  tabTitle: tabId => <PreviewTabTitle tabId={tabId} />,
  tabLead: tabId => <PreviewTabLead tabId={tabId} />,
  render: tabId => <PreviewTilePane tabId={tabId} />,
  close: tabId => {
    forgetPreviewConsole(tabId)
    closeRightRailTab(tabId)
  }
})
