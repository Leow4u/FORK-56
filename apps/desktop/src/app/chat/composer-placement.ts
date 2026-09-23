/**
 * Where the docked composer sits in the chat pane.
 *
 * Empty intro (Cursor empty state): headline + composer as one block. The
 * prompt card is centered on the pane midline, with the headline just above
 * it. A live thread docks the same column at the bottom.
 * Pop-out / HUD keep their own positioning.
 */
export type DockedComposerAnchor = 'bottom' | 'midline'

export function dockedComposerAnchor(intro: boolean): DockedComposerAnchor {
  return intro ? 'midline' : 'bottom'
}
