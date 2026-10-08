import { computed } from 'nanostores'

import { allPaneIds } from '@/components/pane-shell/tree/model'
import { $layoutTree, bindPaneVisibility, revealTreePane } from '@/components/pane-shell/tree/store'
import { $fileBrowserOpen, $revealInTreeRequest, setFileBrowserOpen } from '@/store/layout'
import { $reviewOpen, $reviewScopeCwd, $reviewScopeTarget, closeReview, openReview } from '@/store/review'
import { $currentCwd } from '@/store/session'

import { $terminalTakeover, setTerminalTakeover } from './store'

/** Existing tool panes share the preview strip. The dock hints also bring
 *  installed layouts forward through the tree's existing boot adoption. */
export function contentToolData(pane: 'files' | 'review' | 'terminal') {
  return {
    placement: 'right',
    minWidth: '22rem',
    lifecycleKeepAlive: pane === 'terminal',
    get dock() {
      if (pane !== 'files') {
        return { pane: 'files', pos: 'center' as const, enforce: true }
      }

      // Keep the existing preview area's position and width on upgrade.
      const tree = $layoutTree.get()
      const preview = tree && allPaneIds(tree).find(id => id.startsWith('preview-tile:'))

      return preview
        ? { pane: preview, pos: 'center' as const, enforce: true }
        : { pane: 'workspace', pos: 'right' as const }
    }
  }
}

/** Availability isn't an open request. Leaving the workspace closes its
 *  tools, so choosing a project later doesn't resurrect a hidden Files tab.
 *  Explicit opens keep using the same stores, closers and reveal primitive. */
export function bindContentTools() {
  const $hasWorkspace = computed($currentCwd, cwd => Boolean(cwd.trim()))

  $hasWorkspace.subscribe(hasWorkspace => {
    if (!hasWorkspace) {
      setFileBrowserOpen(false)
      closeReview()
    }
  })

  bindPaneVisibility(
    'files',
    computed([$hasWorkspace, $fileBrowserOpen], (workspace, open) => workspace && open),
    () => setFileBrowserOpen(false),
    () => setFileBrowserOpen(true)
  )
  bindPaneVisibility(
    'review',
    computed([$hasWorkspace, $reviewOpen], (workspace, open) => workspace && open),
    closeReview,
    () => openReview($reviewScopeCwd.get(), $reviewScopeTarget.get())
  )
  bindPaneVisibility(
    'terminal',
    $terminalTakeover,
    () => setTerminalTakeover(false),
    () => setTerminalTakeover(true)
  )

  $revealInTreeRequest.listen(path => {
    if (path) {
      revealTreePane('files')
    }
  })

  for (const [pane, $open] of [
    ['files', $fileBrowserOpen],
    ['review', $reviewOpen],
    ['terminal', $terminalTakeover]
  ] as const) {
    $open.listen(open => {
      if (open) {
        revealTreePane(pane)
      }
    })
  }
}
