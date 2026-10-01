/**
 * Resting HUD placement, and the one saved size that is not a placement:
 * the old 620×320 spawn, which geometry tracking writes on first open.
 */

import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  defaultHudBounds,
  HUD_BOTTOM_MARGIN,
  HUD_DEFAULT_HEIGHT,
  HUD_DEFAULT_WIDTH,
  resolveHudBounds
} from './hud-geometry'

const AREA = { x: 0, y: 25, width: 1440, height: 875 }

test('a fresh HUD is a short bar centered on the bottom of the work area', () => {
  const bounds = defaultHudBounds(AREA)

  assert.equal(bounds.width, Math.min(HUD_DEFAULT_WIDTH, AREA.width))
  assert.equal(bounds.height, Math.min(HUD_DEFAULT_HEIGHT, AREA.height))
  assert.equal(bounds.x, Math.round(AREA.x + (AREA.width - bounds.width) / 2))
  assert.equal(bounds.y, Math.round(AREA.y + AREA.height - bounds.height - HUD_BOTTOM_MARGIN))
})

test('no display yet still names a size', () => {
  const bounds = defaultHudBounds(null)

  assert.equal(bounds.width, HUD_DEFAULT_WIDTH)
  assert.equal(bounds.height, HUD_DEFAULT_HEIGHT)
})

test('a persisted copy of the old default slot opens as the new bar', () => {
  const legacyWidth = 620
  const legacyHeight = 320

  const saved = {
    width: legacyWidth,
    height: legacyHeight,
    x: Math.round(AREA.x + (AREA.width - legacyWidth) / 2),
    y: Math.round(AREA.y + AREA.height - legacyHeight - HUD_BOTTOM_MARGIN)
  }

  assert.deepEqual(resolveHudBounds(saved, AREA), defaultHudBounds(AREA))
})

test('the old size dragged somewhere keeps that spot and takes the new bar size', () => {
  const resolved = resolveHudBounds({ x: 12, y: 40, width: 620, height: 320 }, AREA)

  assert.equal(resolved.x, 12)
  assert.equal(resolved.y, 40)
  assert.equal(resolved.width, HUD_DEFAULT_WIDTH)
  assert.equal(resolved.height, HUD_DEFAULT_HEIGHT)
})

test('a size the user actually chose is left alone', () => {
  const saved = { x: 80, y: 120, width: 520, height: 260 }

  assert.deepEqual(resolveHudBounds(saved, AREA), saved)
})
