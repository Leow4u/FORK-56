/**
 * Text-selection washes. Conversation tints the brand accent (olive on
 * Work4You). The composer draft uses sage — the light olive stop — so both
 * stay in the brand family at two weights.
 */

import { SAGE } from './presets'

export const SELECTION_ACCENT_MIX = {
  chat: { light: 58, dark: 46 },
  composer: { light: 68, dark: 40 }
} as const

export function chatSelectionBackground(accent: string, mode: 'light' | 'dark'): string {
  return `color-mix(in srgb, ${accent} ${SELECTION_ACCENT_MIX.chat[mode]}%, transparent)`
}

export function composerSelectionBackground(mode: 'light' | 'dark'): string {
  return `color-mix(in srgb, ${SAGE} ${SELECTION_ACCENT_MIX.composer[mode]}%, transparent)`
}
