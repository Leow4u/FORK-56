/**
 * Text-selection washes. Conversation / sent copy tints the brand accent
 * (olive on Work4You). The composer draft keeps the lighter GitHub editor wash.
 */

export const CHAT_SELECTION_ACCENT_MIX = {
  light: 58,
  dark: 46
} as const

export const COMPOSER_SELECTION_BACKGROUND = {
  light: 'rgba(84,174,255,0.28)',
  dark: 'rgba(56,139,253,0.25)'
} as const

export function chatSelectionBackground(accent: string, mode: 'light' | 'dark'): string {
  return `color-mix(in srgb, ${accent} ${CHAT_SELECTION_ACCENT_MIX[mode]}%, transparent)`
}
