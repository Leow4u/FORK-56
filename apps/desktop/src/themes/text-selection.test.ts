import { describe, expect, it } from 'vitest'

import { SAGE, work4youOliveTheme, work4youTheme } from './presets'
import { chatSelectionBackground, composerSelectionBackground } from './text-selection'

describe('text selection washes', () => {
  it('tints conversation with the brand accent, olive on Work4You', () => {
    const paper = work4youTheme.colors.midground
    const glass = work4youOliveTheme.colors.midground

    expect(paper).toBeDefined()
    expect(glass).toBeDefined()
    expect(chatSelectionBackground(paper!, 'light')).toContain(paper!)
    expect(chatSelectionBackground(glass!, 'light')).toContain(glass!)
  })

  it('tints the composer draft with sage, the light olive stop', () => {
    expect(composerSelectionBackground('light')).toContain(SAGE)
    expect(composerSelectionBackground('dark')).toContain(SAGE)
    expect(composerSelectionBackground('light')).not.toBe(
      chatSelectionBackground(work4youTheme.colors.midground ?? work4youTheme.colors.ring, 'light')
    )
  })
})
