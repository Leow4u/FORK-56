import { describe, expect, it } from 'vitest'

import { work4youOliveTheme, work4youTheme } from './presets'
import {
  CHAT_SELECTION_ACCENT_MIX,
  COMPOSER_SELECTION_BACKGROUND,
  chatSelectionBackground
} from './text-selection'

describe('text selection washes', () => {
  it('tints conversation with the brand accent, olive on Work4You', () => {
    const paper = work4youTheme.colors.midground
    const glass = work4youOliveTheme.colors.midground

    expect(paper).toBeDefined()
    expect(glass).toBeDefined()
    expect(chatSelectionBackground(paper!, 'light')).toBe(
      `color-mix(in srgb, ${paper} ${CHAT_SELECTION_ACCENT_MIX.light}%, transparent)`
    )
    expect(chatSelectionBackground(glass!, 'light')).toContain(glass!)
    expect(chatSelectionBackground(paper!, 'light')).not.toBe(COMPOSER_SELECTION_BACKGROUND.light)
  })

  it('gives the composer draft the lighter GitHub editor wash', () => {
    expect(COMPOSER_SELECTION_BACKGROUND.light).toBe('rgba(84,174,255,0.28)')
    expect(COMPOSER_SELECTION_BACKGROUND.dark).toBe('rgba(56,139,253,0.25)')
  })
})
