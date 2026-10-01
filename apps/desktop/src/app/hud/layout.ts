/** Spawn height in `electron/hud-geometry.ts` (`HUD_DEFAULT_HEIGHT`). A window
 *  this tall, give or take `HUD_REST_SLACK`, is still the resting bar — not a
 *  size the user chose — so the shell may fit it to the composer. */
export const HUD_RESTING_HEIGHT = 88
export const HUD_REST_SLACK = 16
/** How tall the smoked transcript under the bar is allowed to grow before it
 *  scrolls. The window follows the messages up to this, then stops. */
export const HUD_BAND_CAP = 240
/** Room kept under the bar while a composer menu is open. The menu is clipped
 *  by the window, so a resting bar has to lengthen for it and shorten again
 *  when it closes. */
export const HUD_MENU_ROOM = 220

export interface HudTranscriptHeightInput {
  /** Measured message rows, including the HUD sheet overhang. */
  contentHeight: number
  /** The composer's measured height. */
  barHeight: number
  /** The HUD window's current inner height. */
  viewportHeight: number
}

export type HudPlacement = 'free' | 'moved' | 'resized'

export interface HudWindowFrameInput {
  barHeight: number
  /** Measured transcript rows. Zero means the band stays rolled up. */
  contentHeight: number
  /** Extra height under the bar for an open menu. Not a transcript. */
  chromeHeight?: number
  x: number
  y: number
  width: number
  height: number
  topLimit: number
  bottomLimit: number
  placement: HudPlacement
  /** This session already fitted a resting bar, so keep owning its height. */
  owned: boolean
  restingHeight?: number
}

export interface HudWindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface HudWindowFrame {
  bounds: HudWindowBounds | null
  owned: boolean
}

/**
 * The HUD transcript owns all available space after the composer once there is
 * something to show. A resizable HUD must expose more scrollback as it grows;
 * sizing the band to its message rows instead leaves a larger empty native
 * window around the same fixed-height transcript.
 */
export function hudTranscriptHeight({ barHeight, contentHeight, viewportHeight }: HudTranscriptHeightInput): number {
  if (contentHeight < 1) {
    return 0
  }

  return Math.max(0, Math.round(viewportHeight - barHeight))
}

/**
 * The native window around the Spotlight bar.
 *
 * Empty, the window is the composer: a tall frame with a rolled-up band is
 * just empty chrome (and, when the page background wins, a white slab). With
 * a transcript, the window grows by the rows — capped — so the smoked sheet
 * under the bar has room. A corner resize opts out; a drag keeps the bar
 * where the user put it and still lets the height follow the transcript.
 * A saved window already taller than the resting bar is left alone until the
 * transcript needs more room than it has.
 */
export function hudWindowFrame(input: HudWindowFrameInput): HudWindowFrame {
  const restingHeight = input.restingHeight ?? HUD_RESTING_HEIGHT

  if (input.placement === 'resized' || input.barHeight < 32) {
    return { bounds: null, owned: input.owned }
  }

  const bar = Math.round(input.barHeight)
  const fromRest = input.owned || input.height <= restingHeight + HUD_REST_SLACK
  const room = Math.max(bar, input.bottomLimit - input.topLimit)
  const cap = Math.min(room, bar + HUD_BAND_CAP)
  const band = input.contentHeight < 1 ? 0 : Math.min(Math.round(input.contentHeight), Math.max(0, cap - bar))
  const chrome = Math.max(0, Math.round(input.chromeHeight ?? 0))
  let height = Math.min(cap, bar + Math.max(band, chrome))
  // A resting bar stays glued to the bottom edge of the spawn slot, so opening
  // a transcript lifts the bar and the sheet hangs below it. A drag, or a
  // window the user already sized, keeps the bar's top where it is and grows
  // downward.
  const pinBottom = fromRest && input.placement === 'free'
  let y = input.y

  if (pinBottom) {
    const bottom = Math.min(input.y + input.height, input.bottomLimit)
    y = bottom - height

    if (y < input.topLimit) {
      y = input.topLimit
      height = Math.min(height, Math.max(bar, input.bottomLimit - input.topLimit))
    }
  } else {
    height = Math.min(height, Math.max(bar, input.bottomLimit - input.y))
  }

  y = Math.round(y)
  height = Math.round(height)

  const bounds: HudWindowBounds = { x: input.x, y, width: input.width, height }
  const changed = Math.abs(bounds.y - input.y) > 1 || Math.abs(bounds.height - input.height) > 1

  if (!fromRest) {
    if (height > input.height + 1) {
      return { bounds, owned: false }
    }

    return { bounds: null, owned: false }
  }

  return { bounds: changed ? bounds : null, owned: true }
}
