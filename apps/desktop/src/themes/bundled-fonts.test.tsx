import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ThemeProvider, useTheme } from './context'
import { work4youOliveTheme, work4youTheme } from './presets'

// The Work4You skins ship their faces in the bundle (@font-face in styles.css).
// Painting them must never inject a remote font stylesheet: offline or behind a
// proxy that request fails and the whole UI falls back to the system face.
const remoteFontLinks = () => window.document.head.querySelectorAll('link[data-work4you-theme-font]')

describe('Work4You skins use bundled fonts', () => {
  afterEach(cleanup)

  let ctx: ReturnType<typeof useTheme>

  function Probe() {
    ctx = useTheme()

    return null
  }

  it('boots and paints both Work4You skins, light and dark, without a remote font stylesheet', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )

    expect(remoteFontLinks()).toHaveLength(0)

    for (const theme of [work4youTheme, work4youOliveTheme]) {
      for (const mode of ['light', 'dark'] as const) {
        act(() => ctx.previewTheme(theme.name, mode))

        expect(remoteFontLinks()).toHaveLength(0)
      }
    }
  })
})
