/**
 * Where the docked composer sits in the chat pane.
 *
 * Empty intro (Cursor empty state): headline + composer as one block, composer
 * at the pane midline. A live thread docks the same column at the bottom.
 * Pop-out / HUD keep their own positioning.
 */
export type DockedComposerAnchor = 'bottom' | 'midline'

export function dockedComposerAnchor(intro: boolean): DockedComposerAnchor {
  return intro ? 'midline' : 'bottom'
}

/** Thread / reading-column cap. Transcript and occupied composer. */
export const COMPOSER_THREAD_WIDTH_REM = 48

/**
 * Empty new-chat composer box. Matched to the ChatGPT empty card
 * (40rem × 100px). Does not change `--composer-width` on a live thread.
 */
export const COMPOSER_EMPTY_WIDTH_REM = 40
export const COMPOSER_EMPTY_MIN_HEIGHT_PX = 100

/** Dock column width: empty new-chat is narrower than the occupied thread. */
export function composerDockWidthRem(empty: boolean): number {
  return empty ? COMPOSER_EMPTY_WIDTH_REM : COMPOSER_THREAD_WIDTH_REM
}

/** Prompt-card min-height. Only the empty box is forced taller. */
export function composerSurfaceMinHeightPx(empty: boolean): number | undefined {
  return empty ? COMPOSER_EMPTY_MIN_HEIGHT_PX : undefined
}
