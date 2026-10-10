/**
 * Whether the empty-chat intro splash renders.
 *
 * The splash is the full-height empty state of the primary chat: it belongs to
 * a fresh draft in the main window and nothing else. Auxiliary and non-primary
 * windows are scratch surfaces, a routed or active session already owns the
 * view, and any transcript at all means the conversation started.
 *
 * During boot the fresh draft does not exist yet (it starts once the gateway
 * opens), so `bootInProgress` stands in for it: the empty chat is born on the
 * intro layout instead of docking the composer at the bottom and moving it to
 * the midline seconds later. `restorePending` is the one thing that overrides
 * that: a remembered chat is about to load, so the view keeps the live-thread
 * layout and never climbs to the midline on its way there.
 *
 * `enabled` is the user's Appearance toggle and outranks every other clause:
 * turning the splash off never depends on which window asks.
 */
export function shouldShowIntro(input: {
  activeSessionId: null | string
  auxiliaryWindow: boolean
  bootInProgress: boolean
  enabled: boolean
  freshDraftReady: boolean
  messagesEmpty: boolean
  primary: boolean
  restorePending: boolean
  routedSessionView: boolean
  selectedSessionId: null | string
}): boolean {
  return (
    input.enabled &&
    input.primary &&
    !input.auxiliaryWindow &&
    !input.restorePending &&
    (input.freshDraftReady || input.bootInProgress) &&
    !input.routedSessionView &&
    !input.selectedSessionId &&
    !input.activeSessionId &&
    input.messagesEmpty
  )
}
