/**
 * Text-selection washes. Chat / sent copy uses the darker VS Code navy
 * (`#264f78`). The composer draft keeps the lighter GitHub editor highlight.
 */

export const CHAT_SELECTION_BACKGROUND = {
  light: '#264f7899',
  dark: '#264f78b3'
} as const

export const COMPOSER_SELECTION_BACKGROUND = {
  light: 'rgba(84,174,255,0.28)',
  dark: 'rgba(56,139,253,0.25)'
} as const

export function textSelectionBackground(surface: 'chat' | 'composer', mode: 'light' | 'dark'): string {
  return (surface === 'composer' ? COMPOSER_SELECTION_BACKGROUND : CHAT_SELECTION_BACKGROUND)[mode]
}
