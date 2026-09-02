import { COMPOSIO_LOGO_PROTOCOL } from '@work4you/shared'
import { describe, expect, it } from 'vitest'

import { resolveComposioLogoSrc, useComposioLogoSrc } from './composio-logo'

const GMAIL = 'https://logos.composio.dev/api/gmail'

describe('resolveComposioLogoSrc', () => {
  it('keeps the CDN URL on http(s) origins', () => {
    expect(resolveComposioLogoSrc(GMAIL, 'http:')).toBe(GMAIL)
    expect(resolveComposioLogoSrc(GMAIL, 'https:')).toBe(GMAIL)
  })

  it('maps file:// origins onto the privileged Electron scheme', () => {
    expect(resolveComposioLogoSrc(GMAIL, 'file:')).toBe(`${COMPOSIO_LOGO_PROTOCOL}://mark/gmail`)
  })

  it('rejects untrusted hosts', () => {
    expect(resolveComposioLogoSrc('https://evil.example/gmail', 'file:')).toBeNull()
  })
})

describe('useComposioLogoSrc', () => {
  it('is synchronous so the avatar can mount an <img> immediately', () => {
    expect(useComposioLogoSrc(GMAIL, 'file:')).toEqual({
      failed: false,
      src: `${COMPOSIO_LOGO_PROTOCOL}://mark/gmail`
    })
  })
})
