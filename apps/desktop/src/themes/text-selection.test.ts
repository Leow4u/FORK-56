import { describe, expect, it } from 'vitest'

import { terminalTheme } from '@/app/right-sidebar/terminal/selection'

import {
  CHAT_SELECTION_BACKGROUND,
  COMPOSER_SELECTION_BACKGROUND,
  textSelectionBackground
} from './text-selection'

describe('text selection washes', () => {
  it('gives the conversation the VS Code terminal wash', () => {
    expect(textSelectionBackground('chat', 'light')).toBe(CHAT_SELECTION_BACKGROUND.light)
    expect(textSelectionBackground('chat', 'dark')).toBe(CHAT_SELECTION_BACKGROUND.dark)
    expect(terminalTheme('light').selectionBackground).toBe(CHAT_SELECTION_BACKGROUND.light)
    expect(terminalTheme('dark').selectionBackground).toBe(CHAT_SELECTION_BACKGROUND.dark)
  })

  it('gives the composer draft a lighter GitHub editor wash', () => {
    expect(textSelectionBackground('composer', 'light')).toBe(COMPOSER_SELECTION_BACKGROUND.light)
    expect(textSelectionBackground('composer', 'dark')).toBe(COMPOSER_SELECTION_BACKGROUND.dark)
    expect(textSelectionBackground('composer', 'light')).not.toBe(textSelectionBackground('chat', 'light'))
    expect(textSelectionBackground('composer', 'dark')).not.toBe(textSelectionBackground('chat', 'dark'))
  })
})
