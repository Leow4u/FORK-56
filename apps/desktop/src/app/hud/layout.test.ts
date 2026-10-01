import { describe, expect, it } from 'vitest'

import { HUD_BAND_CAP, HUD_MENU_ROOM, HUD_RESTING_HEIGHT, hudTranscriptHeight, hudWindowFrame } from './layout'

describe('hudTranscriptHeight', () => {
  it('uses the resized window space for a non-empty transcript', () => {
    // The transcript is intentionally not constrained to its content height:
    // resizing HUD must reveal more scrollback instead of growing an empty
    // transparent window below a fixed-height chat band.
    expect(
      hudTranscriptHeight({
        barHeight: 58,
        contentHeight: 72,
        viewportHeight: 640
      })
    ).toBe(582)
  })

  it('keeps an empty HUD collapsed', () => {
    expect(hudTranscriptHeight({ barHeight: 58, contentHeight: 0, viewportHeight: 640 })).toBe(0)
  })
})

const area = { topLimit: 25, bottomLimit: 900 }

describe('hudWindowFrame', () => {
  const resting = {
    barHeight: 64,
    contentHeight: 0,
    x: 200,
    y: 700,
    width: 480,
    height: HUD_RESTING_HEIGHT,
    ...area,
    placement: 'free' as const,
    owned: false
  }

  it('hugs an empty resting window to the composer and keeps the bottom edge', () => {
    const frame = hudWindowFrame(resting)

    expect(frame.owned).toBe(true)
    expect(frame.bounds).toEqual({
      x: 200,
      y: 700 + HUD_RESTING_HEIGHT - 64,
      width: 480,
      height: 64
    })
  })

  it('grows the window by the transcript, capped, still sitting on the same bottom edge', () => {
    const frame = hudWindowFrame({ ...resting, contentHeight: 120, owned: true, height: 64, y: 724 })

    expect(frame.bounds).toEqual({
      x: 200,
      y: 724 + 64 - (64 + 120),
      width: 480,
      height: 64 + 120
    })
  })

  it('stops growing once the band cap is reached', () => {
    const frame = hudWindowFrame({ ...resting, contentHeight: HUD_BAND_CAP + 80, owned: true })

    expect(frame.bounds?.height).toBe(64 + HUD_BAND_CAP)
  })

  it('lengthens a resting bar while a menu is open, then the band stays a transcript concern', () => {
    const frame = hudWindowFrame({ ...resting, chromeHeight: HUD_MENU_ROOM })

    expect(frame.bounds?.height).toBe(64 + HUD_MENU_ROOM)
    expect(hudTranscriptHeight({ barHeight: 64, contentHeight: 0, viewportHeight: 64 + HUD_MENU_ROOM })).toBe(0)
  })

  it('leaves a corner-resized window alone', () => {
    expect(hudWindowFrame({ ...resting, placement: 'resized', height: 420 }).bounds).toBeNull()
  })

  it('keeps a dragged bar put and extends the transcript downward', () => {
    const frame = hudWindowFrame({
      ...resting,
      placement: 'moved',
      owned: true,
      x: 40,
      y: 80,
      height: 64,
      contentHeight: 100
    })

    expect(frame.bounds).toMatchObject({ x: 40, y: 80, height: 164 })
  })

  it('collapses a tall empty save down to the composer bar', () => {
    // Pre-fix hud-state.json (and DPI-rounded cousins of 620×320) left the
    // window tall. Empty Floating Chat must still become the Spotlight bar —
    // otherwise the white slab sticks forever.
    const frame = hudWindowFrame({ ...resting, height: 360, y: 400 })

    expect(frame.owned).toBe(true)
    expect(frame.bounds).toEqual({
      x: 200,
      y: 400 + 360 - 64,
      width: 480,
      height: 64
    })
  })

  it('does not shrink a tall save that still has a transcript', () => {
    const frame = hudWindowFrame({
      ...resting,
      height: 200,
      y: 400,
      contentHeight: 80,
      owned: false
    })

    // Already taller than bar+rows and not owned: leave the user's height.
    expect(frame).toEqual({ bounds: null, owned: false })
  })

  it('still lengthens a saved window when the transcript needs more than it has', () => {
    const frame = hudWindowFrame({ ...resting, height: 200, y: 400, contentHeight: HUD_BAND_CAP })

    expect(frame.owned).toBe(false)
    expect(frame.bounds).toMatchObject({ y: 400, height: 64 + HUD_BAND_CAP })
  })
})
