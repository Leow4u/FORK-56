/**
 * Text-selection washes. Chat / sent copy uses the VS Code integrated-terminal
 * highlight; the composer draft uses the GitHub editor highlight — the same
 * pair the terminal pane and CodeMirror already paint.
 */

export const CHAT_SELECTION_BACKGROUND = {
  light: '#add6ff80',
  dark: '#264f7866'
} as const

export const COMPOSER_SELECTION_BACKGROUND = {
  light: 'rgba(84,174,255,0.28)',
  dark: 'rgba(56,139,253,0.25)'
} as const

export function textSelectionBackground(surface: 'chat' | 'composer', mode: 'light' | 'dark'): string {
  return (surface === 'composer' ? COMPOSER_SELECTION_BACKGROUND : CHAT_SELECTION_BACKGROUND)[mode]
}
