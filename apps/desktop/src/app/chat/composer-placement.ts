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

/** Preferred menu side for a docked composer. A centered empty intro has the
 *  headline above the card, so menus open into the space below it. A live
 *  thread sits on the bottom edge, so menus open upward. */
export function composerMenuSide(anchor: DockedComposerAnchor): 'bottom' | 'top' {
  return anchor === 'midline' ? 'bottom' : 'top'
}
