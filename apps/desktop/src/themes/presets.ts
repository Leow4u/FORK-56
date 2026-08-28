/**
 * Built-in desktop themes. Names match the CLI skins / dashboard presets.
 * Add new themes here — no code changes needed elsewhere.
 */

import type { DesktopTheme, DesktopThemeTypography } from './types'

// Color-emoji fonts to append to every stack as a last resort. None of the UI
// text/mono fonts carry emoji glyphs, so without this emoji render as tofu
// boxes on platforms whose default text font lacks them (e.g. Linux/#40364).
// Covers macOS, Windows, Linux, plus the `emoji` generic for anything else.
export const EMOJI_FALLBACK = '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji'

const SYSTEM_SANS =
  '"Segoe WPC", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif, ' +
  EMOJI_FALLBACK

const SYSTEM_MONO = 'Menlo, Monaco, "SF Mono", "Courier Prime", monospace, ' + EMOJI_FALLBACK

export const DEFAULT_TYPOGRAPHY: DesktopThemeTypography = { fontSans: SYSTEM_SANS, fontMono: SYSTEM_MONO }

const WORK4YOU_BLUE = '#0053FD'
const PSYCHE_BLUE = '#1540B1'
const PSYCHE_WARM = '#FFE6CB'

const work4youTint = (pct: number) => `color-mix(in srgb, ${WORK4YOU_BLUE} ${pct}%, #FFFFFF)`
const work4youTintTransparent = (pct: number) => `color-mix(in srgb, ${WORK4YOU_BLUE} ${pct}%, transparent)`

// Unified Work4You brand seeds — shared with the portal/docs/dashboard
// "papel · tinta · oliva" identity (paper canvas, ink text, olive accent).
const PAPER = '#FAF9F5'
const INK = '#1A1915'
const OLIVE = '#4D5943'
const SAGE = '#C9D2BC'

/**
 * Work4You — canonical Work4You desktop identity. Unified brand look: warm
 * paper canvas, near-black ink text and primary actions, olive as the single
 * character accent (focus rings, composer outline, active states).
 */
export const work4youTheme: DesktopTheme = {
  name: 'work4you',
  label: 'Work4You',
  description: 'Warm paper and ink with olive accents',
  colors: {
    background: PAPER,
    foreground: INK,
    card: '#FFFFFF',
    cardForeground: INK,
    muted: '#F1EFE9',
    mutedForeground: '#75736C',
    popover: '#FFFFFF',
    popoverForeground: INK,
    primary: INK,
    primaryForeground: PAPER,
    secondary: '#F1EFE9',
    secondaryForeground: '#3B3A34',
    accent: '#ECEAE1',
    accentForeground: '#33322C',
    border: '#E6E4DC',
    input: '#E0DED4',
    ring: OLIVE,
    midground: OLIVE,
    composerRing: OLIVE,
    destructive: '#B3402E',
    destructiveForeground: '#FFFFFF',
    sidebarBackground: PAPER,
    sidebarBorder: '#E6E4DC',
    userBubble: '#F1EFE9',
    userBubbleBorder: '#E6E4DC'
  },
  darkColors: {
    background: '#171716',
    foreground: '#E9E7DF',
    card: '#1E1D1B',
    cardForeground: '#E9E7DF',
    muted: '#232220',
    mutedForeground: '#A5A399',
    popover: '#201F1D',
    popoverForeground: '#E9E7DF',
    primary: '#E9E7DF',
    primaryForeground: '#171716',
    secondary: '#262521',
    secondaryForeground: '#D7D5CC',
    accent: '#262B22',
    accentForeground: '#DCE3D2',
    border: '#32312C',
    input: '#232220',
    ring: SAGE,
    midground: SAGE,
    composerRing: SAGE,
    destructive: '#C0473A',
    destructiveForeground: '#FEF2F2',
    sidebarBackground: '#141412',
    sidebarBorder: '#2A2925',
    userBubble: '#22211E',
    userBubbleBorder: '#383730'
  },
  typography: {
    fontSans: `"Plus Jakarta Sans", ${SYSTEM_SANS}`,
    fontMono: SYSTEM_MONO,
    fontUrl:
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Courier+Prime:wght@400;700&display=swap'
  }
}

/**
 * Work4You Blue — the previous desktop identity (glass neutrals with Work4You
 * blue accents, psyche navy dark mode), kept selectable as its own skin.
 */
export const work4youBlueTheme: DesktopTheme = {
  name: 'work4you-blue',
  label: 'Work4You Blue',
  description: 'Glass neutrals with Work4You blue accents',
  colors: {
    background: '#F8FAFF',
    foreground: '#17171A',
    card: '#FFFFFF',
    cardForeground: '#17171A',
    muted: work4youTint(5),
    mutedForeground: '#666678',
    popover: '#FFFFFF',
    popoverForeground: '#17171A',
    primary: WORK4YOU_BLUE,
    primaryForeground: '#FCFCFC',
    secondary: work4youTint(7),
    secondaryForeground: '#242432',
    accent: work4youTint(10),
    accentForeground: '#202030',
    border: work4youTintTransparent(22),
    input: work4youTintTransparent(30),
    ring: WORK4YOU_BLUE,
    midground: WORK4YOU_BLUE,
    composerRing: WORK4YOU_BLUE,
    destructive: '#C72E4D',
    destructiveForeground: '#FFFFFF',
    sidebarBackground: '#F3F7FF',
    sidebarBorder: work4youTintTransparent(18),
    userBubble: work4youTint(6),
    userBubbleBorder: work4youTintTransparent(24)
  },
  darkColors: {
    background: '#0D2F86',
    foreground: PSYCHE_WARM,
    card: '#12378F',
    cardForeground: PSYCHE_WARM,
    muted: '#183F9A',
    mutedForeground: '#B5C7F3',
    popover: '#123A96',
    popoverForeground: PSYCHE_WARM,
    primary: PSYCHE_WARM,
    primaryForeground: '#0D2F86',
    secondary: '#1B45A4',
    secondaryForeground: '#E0E8FF',
    accent: PSYCHE_BLUE,
    accentForeground: '#F0F4FF',
    border: '#3158AD',
    input: '#0B2566',
    ring: PSYCHE_WARM,
    midground: WORK4YOU_BLUE,
    composerRing: PSYCHE_WARM,
    destructive: '#C0473A',
    destructiveForeground: '#FEF2F2',
    sidebarBackground: '#09286F',
    sidebarBorder: '#234A9C',
    userBubble: '#143B91',
    userBubbleBorder: '#3A63BD'
  },
  typography: {
    fontSans: SYSTEM_SANS,
    fontMono: SYSTEM_MONO,
    fontUrl: 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap'
  }
}

/** Deep blue-violet with cool accents. Matches the dashboard midnight theme. */
export const midnightTheme: DesktopTheme = {
  name: 'midnight',
  label: 'Midnight',
  description: 'Deep blue-violet with cool accents',
  colors: {
    background: '#08081c',
    foreground: '#ddd6ff',
    card: '#0d0d28',
    cardForeground: '#ddd6ff',
    muted: '#13133a',
    mutedForeground: '#7c7ab0',
    popover: '#0f0f2e',
    popoverForeground: '#ddd6ff',
    primary: '#ddd6ff',
    primaryForeground: '#08081c',
    secondary: '#1a1a4a',
    secondaryForeground: '#c4bff0',
    accent: '#1a1a44',
    accentForeground: '#d0c8ff',
    border: '#1e1e52',
    input: '#1e1e52',
    ring: '#8b80e8',
    midground: '#8b80e8',
    destructive: '#b03060',
    destructiveForeground: '#fef2f2',
    sidebarBackground: '#06061a',
    sidebarBorder: '#12123a',
    userBubble: '#14143a',
    userBubbleBorder: '#242466'
  },
  typography: {
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`,
    fontUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap'
  }
}

/** Warm crimson and bronze — forge vibes. Matches the CLI ares skin. */
export const emberTheme: DesktopTheme = {
  name: 'ember',
  label: 'Ember',
  description: 'Warm crimson and bronze — forge vibes',
  colors: {
    background: '#160800',
    foreground: '#ffd8b0',
    card: '#1e0e04',
    cardForeground: '#ffd8b0',
    muted: '#2a1408',
    mutedForeground: '#aa7a56',
    popover: '#221008',
    popoverForeground: '#ffd8b0',
    primary: '#ffd8b0',
    primaryForeground: '#160800',
    secondary: '#341800',
    secondaryForeground: '#f0c090',
    accent: '#301600',
    accentForeground: '#e8c080',
    border: '#3a1c08',
    input: '#3a1c08',
    ring: '#d97316',
    midground: '#d97316',
    destructive: '#c43010',
    destructiveForeground: '#fef2f2',
    sidebarBackground: '#100600',
    sidebarBorder: '#2a1004',
    userBubble: '#2a1000',
    userBubbleBorder: '#4a2010'
  },
  typography: {
    fontMono: `"IBM Plex Mono", ${SYSTEM_MONO}`,
    fontUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap'
  }
}

/** Clean grayscale. Matches the CLI mono skin and dashboard mono theme. */
export const monoTheme: DesktopTheme = {
  name: 'mono',
  label: 'Mono',
  description: 'Clean grayscale — minimal and focused',
  colors: {
    background: '#0e0e0e',
    foreground: '#eaeaea',
    card: '#141414',
    cardForeground: '#eaeaea',
    muted: '#1e1e1e',
    mutedForeground: '#808080',
    popover: '#181818',
    popoverForeground: '#eaeaea',
    primary: '#eaeaea',
    primaryForeground: '#0e0e0e',
    secondary: '#262626',
    secondaryForeground: '#c8c8c8',
    accent: '#222222',
    accentForeground: '#d8d8d8',
    border: '#2a2a2a',
    input: '#2a2a2a',
    ring: '#9a9a9a',
    midground: '#9a9a9a',
    destructive: '#a84040',
    destructiveForeground: '#fef2f2',
    sidebarBackground: '#0a0a0a',
    sidebarBorder: '#202020',
    userBubble: '#1a1a1a',
    userBubbleBorder: '#363636'
  }
}

/** Neon green on black. Matches the CLI cyberpunk skin and dashboard theme. */
export const cyberpunkTheme: DesktopTheme = {
  name: 'cyberpunk',
  label: 'Cyberpunk',
  description: 'Neon green on black — matrix terminal',
  colors: {
    background: '#000a00',
    foreground: '#00ff41',
    card: '#001200',
    cardForeground: '#00ff41',
    muted: '#001a00',
    mutedForeground: '#1a8a30',
    popover: '#001000',
    popoverForeground: '#00ff41',
    primary: '#00ff41',
    primaryForeground: '#000a00',
    secondary: '#002800',
    secondaryForeground: '#00cc34',
    accent: '#002000',
    accentForeground: '#00e038',
    border: '#003000',
    input: '#003000',
    ring: '#00ff41',
    midground: '#00ff41',
    destructive: '#ff003c',
    destructiveForeground: '#000a00',
    sidebarBackground: '#000600',
    sidebarBorder: '#001800',
    userBubble: '#001400',
    userBubbleBorder: '#004800'
  },
  typography: {
    fontMono: `"Courier New", Courier, monospace, ${EMOJI_FALLBACK}`,
    fontSans: `"Courier New", Courier, monospace, ${EMOJI_FALLBACK}`
  }
}

/** Cool slate blue for developers. Matches the CLI slate skin. */
export const slateTheme: DesktopTheme = {
  name: 'slate',
  label: 'Slate',
  description: 'Cool slate blue — focused developer theme',
  colors: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    card: '#161b22',
    cardForeground: '#c9d1d9',
    muted: '#21262d',
    mutedForeground: '#8b949e',
    popover: '#1c2128',
    popoverForeground: '#c9d1d9',
    primary: '#c9d1d9',
    primaryForeground: '#0d1117',
    secondary: '#2a3038',
    secondaryForeground: '#adb5bf',
    accent: '#1e2530',
    accentForeground: '#c0c8d0',
    border: '#30363d',
    input: '#30363d',
    ring: '#58a6ff',
    midground: '#58a6ff',
    destructive: '#cf4848',
    destructiveForeground: '#fef2f2',
    sidebarBackground: '#090d13',
    sidebarBorder: '#1c2228',
    userBubble: '#1e2a38',
    userBubbleBorder: '#2e4060'
  },
  typography: {
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`
  }
}

export const BUILTIN_THEMES: Record<string, DesktopTheme> = {
  work4you: work4youTheme,
  'work4you-blue': work4youBlueTheme,
  midnight: midnightTheme,
  ember: emberTheme,
  mono: monoTheme,
  cyberpunk: cyberpunkTheme,
  slate: slateTheme
}

export const BUILTIN_THEME_LIST = Object.values(BUILTIN_THEMES)

/** Skin used when nothing is persisted or the persisted name is retired. */
export const DEFAULT_SKIN_NAME = 'work4you'
