import { describe, expect, it } from 'vitest'

import { terminalTheme } from '@/app/right-sidebar/terminal/selection'

import {
  CHAT_SELECTION_BACKGROUND,
  COMPOSER_SELECTION_BACKGROUND,
  textSelectionBackground
} from './text-selection'

describe('text selection washes', () => {
  it('keeps conversation on the darker VS Code navy, not the pale terminal wash', () => {
    expect(textSelectionBackground('chat', 'light')).toBe(CHAT_SELECTION_BACKGROUND.light)
    expect(textSelectionBackground('chat', 'dark')).toBe(CHAT_SELECTION_BACKGROUND.dark)
    expect(CHAT_SELECTION_BACKGROUND.light.toLowerCase().startsWith('#264f78')).toBe(true)
    expect(CHAT_SELECTION_BACKGROUND.dark.toLowerCase().startsWith('#264f78')).toBe(true)
    expect(textSelectionBackground('chat', 'light')).not.toBe(terminalTheme('light').selectionBackground)
  })

  it('gives the composer draft the lighter GitHub editor wash', () => {
    expect(textSelectionBackground('composer', 'light')).toBe(COMPOSER_SELECTION_BACKGROUND.light)
    expect(textSelectionBackground('composer', 'dark')).toBe(COMPOSER_SELECTION_BACKGROUND.dark)
    expect(textSelectionBackground('composer', 'light')).not.toBe(textSelectionBackground('chat', 'light'))
    expect(textSelectionBackground('composer', 'dark')).not.toBe(textSelectionBackground('chat', 'dark'))
  })
})
