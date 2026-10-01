/**
 * HUD window geometry — the resting Spotlight bar, and how a saved
 * hud-state.json is read back.
 *
 * The renderer fits the live height to the composer (and to the transcript
 * under it) in `src/app/hud/layout.ts`. These numbers are the spawn size and
 * the floors main will accept. `HUD_DEFAULT_HEIGHT` must stay equal to
 * `HUD_RESTING_HEIGHT` there, and `HUD_MIN_HEIGHT` to the renderer's resize
 * handle, or a fitted bar gets clamped back into a slab.
 */

export const HUD_DEFAULT_WIDTH = 480
export const HUD_DEFAULT_HEIGHT = 88
export const HUD_MIN_WIDTH = 380
export const HUD_MIN_HEIGHT = 48
export const HUD_BOTTOM_MARGIN = 72

/** Spawn size before the bar was tightened. Geometry tracking persists it on
 *  open, so most hud-state.json files still say 620×320 even when nobody
 *  resized. */
const LEGACY_DEFAULT_WIDTH = 620
const LEGACY_DEFAULT_HEIGHT = 320
const LEGACY_ORIGIN_SLOP = 8

export interface HudBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

export function defaultHudBounds(area: WorkArea | null): HudBounds {
  if (!area) {
    return { x: 0, y: 0, width: HUD_DEFAULT_WIDTH, height: HUD_DEFAULT_HEIGHT }
  }

  const width = Math.min(HUD_DEFAULT_WIDTH, area.width)
  const height = Math.min(HUD_DEFAULT_HEIGHT, area.height)

  return {
    width,
    height,
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(Math.max(area.y, area.y + area.height - height - HUD_BOTTOM_MARGIN))
  }
}

function legacyDefaultOrigin(area: WorkArea): { x: number; y: number } {
  const width = Math.min(LEGACY_DEFAULT_WIDTH, area.width)
  const height = Math.min(LEGACY_DEFAULT_HEIGHT, area.height)

  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(Math.max(area.y, area.y + area.height - height - HUD_BOTTOM_MARGIN))
  }
}

/**
 * Saved geometry wins. A persisted copy of the old 620×320 spawn is not a
 * choice: still on that slot, it becomes the new bottom-centered bar; dragged
 * somewhere, it keeps that spot and takes the new size, anchored to the top
 * (the bar lives on the window's top edge).
 */
export function resolveHudBounds(saved: HudBounds | null, area: WorkArea | null): HudBounds {
  if (!saved) {
    return defaultHudBounds(area)
  }

  if (!area || saved.width !== LEGACY_DEFAULT_WIDTH || saved.height !== LEGACY_DEFAULT_HEIGHT) {
    return saved
  }

  const origin = legacyDefaultOrigin(area)

  if (Math.abs(saved.x - origin.x) <= LEGACY_ORIGIN_SLOP && Math.abs(saved.y - origin.y) <= LEGACY_ORIGIN_SLOP) {
    return defaultHudBounds(area)
  }

  return {
    x: saved.x,
    y: saved.y,
    width: Math.min(HUD_DEFAULT_WIDTH, area.width),
    height: Math.min(HUD_DEFAULT_HEIGHT, area.height)
  }
}
