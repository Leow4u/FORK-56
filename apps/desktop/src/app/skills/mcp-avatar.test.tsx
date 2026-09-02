import { cleanup, render, waitFor } from '@testing-library/react'
import { directoryAppLogoUrl } from '@work4you/shared'
import { afterEach, describe, expect, it } from 'vitest'

import { resetComposioLogoCache } from '@/lib/composio-logo'

import { McpAvatar } from './mcp-avatar'

afterEach(() => {
  cleanup()
  resetComposioLogoCache()
})

describe('McpAvatar', () => {
  it('paints the Composio CDN mark from directoryAppLogoUrl on http(s)', async () => {
    render(
      <McpAvatar
        logo={directoryAppLogoUrl({ id: 'gmail', source: 'composio' })}
        name="gmail"
        status="unknown"
      />
    )

    await waitFor(() => {
      expect(document.querySelector('[data-mcp-avatar="gmail"]')?.getAttribute('src')).toBe(
        'https://logos.composio.dev/api/gmail'
      )
    })
  })

  it('falls back to a letter when there is no trusted mark and no brand glyph', () => {
    render(<McpAvatar logo={null} name="hubspot" status="unknown" />)

    expect(document.querySelector('[data-mcp-avatar]')).toBeNull()
    expect(document.body.textContent).toContain('H')
  })
})
