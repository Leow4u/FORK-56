/**
 * Rail vs stage chrome — the ChatGPT-style join.
 *
 * The window well, window titlebar, and side chrome share the rail. Only the
 * conversation zone is the brighter stage. A radius on both TOP corners is
 * the curve into that rail (sidebar, titlebar well, Cronjobs / files); there
 * is no inset/gutter around the chat.
 */

/** Window titlebar — same fill as the sidebar, not the bright chat stage. */
export const WINDOW_TITLEBAR_RAIL_CLASS = 'bg-(--ui-sidebar-surface-background)'

/** Non-conversation zones (sessions, Bots, Cronjobs, files) sit on the rail. */
export const RAIL_ZONE_SURFACE_CLASS = 'bg-(--ui-sidebar-surface-background)'

/** Conversation stage — the brighter paper, not the rail. */
export const MAIN_STAGE_SURFACE_CLASS = 'bg-(--ui-chat-surface-background)'

/** Tab strip on the stage — same fill as the chat, not the sidebar rail. */
export const MAIN_STAGE_TAB_STRIP_CLASS =
  'bg-(--ui-chat-surface-background) [--pane-tab-active-bg:var(--ui-chat-surface-background)] [--pane-tab-strip-bg:var(--ui-chat-surface-background)]'

/** Top corners of the stage that meet the rail. */
export function mainStageCornerClass(): string {
  return 'rounded-tl-(--ui-stage-radius) rounded-tr-(--ui-stage-radius)'
}

/** A zone hosts the conversation stage when it stacks session/workspace tiles. */
export function isMainStageZone(paneIds: readonly string[], isStagePane: (paneId: string) => boolean): boolean {
  return paneIds.some(isStagePane)
}
