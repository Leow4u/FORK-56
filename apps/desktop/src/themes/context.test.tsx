import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { __resetBackendSkinSync, ingestBackendSkin } from './backend-sync'
import { skinPref, ThemeProvider, useTheme } from './context'
import { midnightTheme, work4youOliveTheme } from './presets'
import { CHAT_SELECTION_BACKGROUND, COMPOSER_SELECTION_BACKGROUND } from './text-selection'

// The live-authoring loop: Work4You writes/edits one skin file and every surface
// repaints. An in-place edit keeps the NAME — only the palette moves.
const bloomberg = (foreground: string) => ({
  name: 'bloomberg',
  colors: { background: '#000000', ui_text: foreground, ui_accent: '#ff8000' }
})

const cssVar = (name: string) => window.document.documentElement.style.getPropertyValue(name)

describe('ThemeProvider ← backend skin sync', () => {
  beforeEach(() => {
    window.localStorage.clear()
    __resetBackendSkinSync()
  })

  afterEach(cleanup)

  it('applies an activated backend skin', () => {
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    )

    act(() => ingestBackendSkin(bloomberg('#ff9f0a'), { apply: true }))

    expect(cssVar('--theme-foreground')).toBe('#ff9f0a')
    expect(cssVar('--theme-background-seed')).toBe('#000000')
  })

  it('repaints an in-place edit of the ACTIVE skin (same name, new palette)', () => {
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    )

    act(() => ingestBackendSkin(bloomberg('#ff9f0a'), { apply: true }))
    expect(cssVar('--theme-foreground')).toBe('#ff9f0a')

    // Recolor the same skin file. The same-name apply guard correctly no-ops
    // (protects manual desktop picks), so the repaint must come from the
    // registry update reaching the active theme derivation.
    act(() => ingestBackendSkin(bloomberg('#ff2d95'), { apply: true }))
    expect(cssVar('--theme-foreground')).toBe('#ff2d95')
  })

  it('does not repaint an edit to an INACTIVE skin', () => {
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    )

    act(() => ingestBackendSkin(bloomberg('#ff9f0a'), { apply: true }))

    // A different skin registered without apply (e.g. seeded on reconnect)
    // must not touch the painted theme.
    act(() =>
      ingestBackendSkin({ name: 'forest', colors: { background: '#001100', ui_text: '#66ff66' } }, { apply: false })
    )
    expect(cssVar('--theme-foreground')).toBe('#ff9f0a')
  })
})

describe('ThemeProvider highlight preview', () => {
  beforeEach(() => {
    window.localStorage.clear()
    __resetBackendSkinSync()
  })

  afterEach(cleanup)

  // Read the live context so the tests drive the real provider, not a mock.
  let ctx: ReturnType<typeof useTheme>

  function Probe() {
    ctx = useTheme()

    return null
  }

  const renderProbe = () =>
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )

  it('paints the previewed theme without persisting it', () => {
    renderProbe()

    const committed = ctx.themeName

    act(() => ctx.previewTheme('midnight', 'dark'))

    expect(cssVar('--theme-foreground')).toBe(midnightTheme.colors.foreground)
    // The commit surface does not change. The context name and the stored
    // preference keep their values.
    expect(ctx.themeName).toBe(committed)
    expect(skinPref.resolve('default')).toBe(committed)
  })

  it('clearThemePreview repaints the committed appearance', () => {
    renderProbe()

    act(() => ctx.previewTheme('midnight', 'dark'))
    expect(cssVar('--theme-foreground')).toBe(midnightTheme.colors.foreground)

    act(() => ctx.clearThemePreview())
    expect(cssVar('--theme-foreground')).not.toBe(midnightTheme.colors.foreground)
  })

  it('a commit replaces the preview and persists', () => {
    renderProbe()

    act(() => ctx.previewTheme('midnight', 'dark'))
    act(() => ctx.setTheme('mono'))

    expect(ctx.themeName).toBe('mono')
    expect(skinPref.resolve('default')).toBe('mono')
    expect(cssVar('--theme-foreground')).not.toBe(midnightTheme.colors.foreground)
  })

  it('ignores a preview of an unknown theme', () => {
    renderProbe()

    const painted = cssVar('--theme-foreground')

    act(() => ctx.previewTheme('does-not-exist', 'dark'))
    expect(cssVar('--theme-foreground')).toBe(painted)
  })

  it('paints VS Code chat selection and GitHub composer selection', () => {
    renderProbe()

    expect(cssVar('--ui-selection-background')).toBe(CHAT_SELECTION_BACKGROUND.light)
    expect(cssVar('--ui-composer-selection-background')).toBe(COMPOSER_SELECTION_BACKGROUND.light)

    act(() => ctx.previewTheme('midnight', 'dark'))

    expect(cssVar('--ui-selection-background')).toBe(CHAT_SELECTION_BACKGROUND.dark)
    expect(cssVar('--ui-composer-selection-background')).toBe(COMPOSER_SELECTION_BACKGROUND.dark)
  })

  it('commits the retired Blue name as Olive', () => {
    renderProbe()

    act(() => ctx.setTheme('work4you-blue'))

    expect(ctx.themeName).toBe('work4you-olive')
    expect(skinPref.resolve('default')).toBe('work4you-olive')
    expect(cssVar('--theme-background-seed')).toBe(work4youOliveTheme.colors.background)
    expect(cssVar('--theme-sidebar-seed')).toBe(work4youOliveTheme.colors.sidebarBackground)
  })

  it('previews Olive from the retired Blue name without persisting', () => {
    renderProbe()

    const committed = ctx.themeName

    act(() => ctx.previewTheme('work4you-blue', 'dark'))

    expect(cssVar('--theme-foreground')).toBe(work4youOliveTheme.darkColors?.foreground)
    expect(ctx.themeName).toBe(committed)
    expect(skinPref.resolve('default')).toBe(committed)
  })
})
