/**
 * THE RIGHT BUTTON — the titlebar's right toggle and ⌘J. It answers for the
 * right side of the main zone with the content area in it, and says what a
 * press does: hide the area (and the side with it), bring it back, or open it
 * on a new tab.
 */

import { computed, type ReadableAtom } from 'nanostores'

import { contentAreaPaneId } from '@/components/pane-shell/tree/model'
import {
  $collapsedTreeSides,
  $dismissedPanes,
  $hiddenTreePanes,
  $layoutTree,
  $newContentTabAction,
  isPaneVisible,
  revealTreePane,
  setPaneCollapsed,
  treeSideOfPane
} from '@/components/pane-shell/tree/store'
import { $registryVersion, registry } from '@/contrib/registry'
import { $rightRailActiveTabId, setRightSidebarOpen } from '@/store/layout'

/** The content area's front tab as a layout pane — null when the conversation
 *  on screen has no tabs (only the followed conversation's panes register). */
function contentAreaFront(): null | string {
  const tabId = $rightRailActiveTabId.get()
  const paneId = tabId ? contentAreaPaneId(tabId) : null

  return paneId && registry.getArea('panes').some(pane => pane.id === paneId) ? paneId : null
}

/** Ask the TREE whether the area is on screen: its front tab showing, and the
 *  side it lives on open. The stores alone can't say — a tab behind the chat
 *  in a shared zone, or a minimized zone, is open and still not seen. */
function contentAreaShowing(front: null | string): boolean {
  const side = front ? treeSideOfPane(front) : null

  return Boolean(front && isPaneVisible(front) && !(side && $collapsedTreeSides.get().has(side)))
}

/** Whether the right button would fold the content area — what it says. */
export const $contentAreaShowing: ReadableAtom<boolean> = computed(
  [$layoutTree, $collapsedTreeSides, $dismissedPanes, $hiddenTreePanes, $registryVersion, $rightRailActiveTabId],
  () => contentAreaShowing(contentAreaFront())
)

/**
 * The titlebar's right button and ⌘J: the right side, the content area in it.
 * The area showing → the whole right side folds; the tabs stay with their
 * conversation. Folded → it comes back as it was. A conversation with no tabs
 * → the area opens on a new tab. An area moved off the side columns (stacked
 * with the chat, nested elsewhere) can't fold with the side, so its zone
 * minimizes too — beside the chat, the chat comes to the front instead.
 *
 * The file tree is no longer this button: it has its own presence, which the
 * side carries along like any other pane there.
 */
export function toggleRightSidebar() {
  const front = contentAreaFront()

  if (!front) {
    setRightSidebarOpen(true)
    $newContentTabAction.get()?.()

    return
  }

  if (contentAreaShowing(front)) {
    setRightSidebarOpen(false)

    if (!treeSideOfPane(front)) {
      setPaneCollapsed(front, true)
    }

    return
  }

  setRightSidebarOpen(true)
  revealTreePane(front)
}
