/**
 * Rail vs stage chrome — the ChatGPT-style join.
 *
 * The window well, window titlebar, and sidebar share the rail. The main
 * chat zone is the brighter stage. A radius on the rail-facing TOP corner
 * is the curve; there is no inset/gutter around the chat.
 */

/** Window titlebar — same fill as the sidebar, not the bright chat stage. */
export const WINDOW_TITLEBAR_RAIL_CLASS = 'bg-(--ui-sidebar-surface-background)'

/** Tab strip on the stage — same fill as the chat, not the sidebar rail. */
export const MAIN_STAGE_TAB_STRIP_CLASS =
  'bg-(--ui-chat-surface-background) [--pane-tab-active-bg:var(--ui-chat-surface-background)] [--pane-tab-strip-bg:var(--ui-chat-surface-background)]'

/** Top corner of the stage that meets the sidebar. */
export function mainStageCornerClass(sidebarOnLeft: boolean): string {
  return sidebarOnLeft ? 'rounded-tl-(--ui-stage-radius)' : 'rounded-tr-(--ui-stage-radius)'
}

/** A zone hosts the conversation stage when it stacks main/session tiles. */
export function isMainStageZone(paneIds: readonly string[], isStagePane: (paneId: string) => boolean): boolean {
  return paneIds.some(isStagePane)
}
