import { describe, expect, it } from 'vitest'

import {
  BUILTIN_THEME_LIST,
  BUILTIN_THEMES,
  canonicalSkinName,
  DEFAULT_TYPOGRAPHY,
  EMOJI_FALLBACK,
  work4youOliveTheme,
  work4youTheme
} from './presets'
import type { DesktopTheme } from './types'

// #40364: none of the UI text/mono fonts carry emoji glyphs, so every font
// stack must end with a color-emoji fallback or emoji render as tofu on
// platforms whose default font lacks them (e.g. Linux).
describe('theme typography emoji fallback (#40364)', () => {
  const stacks: Array<[string, string]> = [
    ['DEFAULT_TYPOGRAPHY.fontSans', DEFAULT_TYPOGRAPHY.fontSans],
    ['DEFAULT_TYPOGRAPHY.fontMono', DEFAULT_TYPOGRAPHY.fontMono],
    // A theme may override only fontMono (fontSans then falls back to the
    // default, which already carries the emoji stack), so skip undefined.
    ...BUILTIN_THEME_LIST.flatMap(theme =>
      (
        [
          [`${theme.name}.fontSans`, theme.typography?.fontSans],
          [`${theme.name}.fontMono`, theme.typography?.fontMono]
        ] as Array<[string, string | undefined]>
      ).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
  ]

  it.each(stacks)('%s includes a color-emoji font', (_label, stack) => {
    expect(stack).toMatch(/Apple Color Emoji|Segoe UI Emoji|Noto Color Emoji|(^|,\s*)emoji\b/)
  })

  it('EMOJI_FALLBACK lists the major platform emoji fonts', () => {
    expect(EMOJI_FALLBACK).toContain('Apple Color Emoji')
    expect(EMOJI_FALLBACK).toContain('Segoe UI Emoji')
    expect(EMOJI_FALLBACK).toContain('Noto Color Emoji')
  })
})

const RETIRED_BLUE_FAMILY = [
  '#0053FD',
  '#1540B1',
  '#0D2F86',
  '#12378F',
  '#183F9A',
  '#123A96',
  '#1B45A4',
  '#3158AD',
  '#0B2566',
  '#09286F',
  '#234A9C',
  '#143B91',
  '#3A63BD',
  '#B5C7F3',
  '#E0E8FF',
  '#F0F4FF',
  '#F8FAFF',
  '#F3F7FF'
]

const paletteValues = (theme: DesktopTheme): string[] => [
  ...Object.values(theme.colors),
  ...Object.values(theme.darkColors ?? {})
]

const mixPercents = (values: string[]): Set<string> => {
  const pcts = new Set<string>()

  for (const value of values) {
    for (const match of value.matchAll(/ (\d+)%/g)) {
      pcts.add(match[1])
    }
  }

  return pcts
}

describe('Work4You Olive glass scale', () => {
  it('aliases the retired Blue id onto Olive and lists Olive once', () => {
    expect(canonicalSkinName('work4you-blue')).toBe('work4you-olive')
    expect(canonicalSkinName('work4you-olive')).toBe('work4you-olive')
    expect(BUILTIN_THEMES['work4you-olive']).toBe(work4youOliveTheme)
    expect(BUILTIN_THEMES['work4you-blue']).toBeUndefined()
    expect(BUILTIN_THEME_LIST.filter(theme => theme.name === 'work4you-olive')).toHaveLength(1)
    expect(BUILTIN_THEME_LIST.some(theme => theme.name === 'work4you-blue')).toBe(false)
  })

  it('keeps the paper Work4You skin as its own identity', () => {
    expect(work4youTheme.name).toBe('work4you')
    expect(work4youTheme.colors.background).not.toBe(work4youOliveTheme.colors.background)
    expect(work4youTheme.colors.primary).not.toBe(work4youOliveTheme.colors.primary)
    expect(work4youTheme.colors.sidebarBackground).not.toBe(work4youOliveTheme.colors.sidebarBackground)
  })

  it('leaves no Blue-family hex or mix seed in the Olive palettes', () => {
    const values = paletteValues(work4youOliveTheme)
    const folded = values.join(' ').toUpperCase()

    for (const hex of RETIRED_BLUE_FAMILY) {
      expect(folded).not.toContain(hex.toUpperCase())
    }
  })

  it('tracks Blue’s light roles: leaf seed, tint ladder, and rail/stage split', () => {
    const { colors } = work4youOliveTheme

    expect(colors.primary).toBe(colors.ring)
    expect(colors.primary).toBe(colors.midground)
    expect(colors.primary).toBe(colors.composerRing)
    expect(colors.sidebarBackground).not.toBe(colors.background)
    expect(mixPercents(Object.values(colors)).size).toBeGreaterThanOrEqual(6)
  })

  it('tracks Blue’s dark roles: a forest ladder, not one fill', () => {
    const dark = work4youOliveTheme.darkColors!

    expect(dark.sidebarBackground).not.toBe(dark.background)
    expect(dark.card).not.toBe(dark.background)
    expect(dark.muted).not.toBe(dark.card)
    expect(dark.secondary).not.toBe(dark.muted)
    expect(dark.accent).not.toBe(dark.secondary)
    expect(dark.border).not.toBe(dark.accent)
    expect(dark.input).not.toBe(dark.background)
    expect(dark.midground).not.toBe(dark.background)
    expect(dark.midground).not.toBe(dark.foreground)

    const uniqueHexes = new Set(Object.values(dark).filter(value => value.startsWith('#')))

    expect(uniqueHexes.size).toBeGreaterThanOrEqual(12)
  })
})
