import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  bindComposioLogoNetFetch,
  COMPOSIO_LOGO_MAX_BYTES,
  COMPOSIO_LOGO_PROTOCOL,
  handleComposioLogoProtocol
} from './composio-logo'

const GMAIL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>'
const GMAIL_CDN = 'https://logos.composio.dev/api/gmail'
const GMAIL_PROTOCOL = `${COMPOSIO_LOGO_PROTOCOL}://mark/gmail`

function svgResponse(body: string, extra: { status?: number; type?: string; url?: string } = {}): Response {
  return new Response(body, {
    status: extra.status ?? 200,
    headers: { 'content-type': extra.type ?? 'image/svg+xml' }
  })
}

test('bindComposioLogoNetFetch always uses Chromium net.fetch options', async () => {
  const calls: Array<{ url: string; init?: RequestInit & { bypassCustomProtocolHandlers?: boolean } }> = []

  const fetchImpl = bindComposioLogoNetFetch(async (url, init) => {
    calls.push({ url, init })

    return svgResponse(GMAIL_SVG)
  })

  const response = await handleComposioLogoProtocol({ url: GMAIL_PROTOCOL }, fetchImpl)

  assert.equal(response.status, 200)
  assert.equal(calls[0]?.url, GMAIL_CDN)
  assert.equal(calls[0]?.init?.bypassCustomProtocolHandlers, true)
  assert.equal(calls[0]?.init?.credentials, 'omit')
  assert.equal(calls[0]?.init?.redirect, 'error')
})

test('handleComposioLogoProtocol serves a trusted SVG through the privileged scheme', async () => {
  const response = await handleComposioLogoProtocol({ url: GMAIL_PROTOCOL }, async (url, init) => {
    assert.equal(url, GMAIL_CDN)
    assert.equal(init?.redirect, 'error')

    return svgResponse(GMAIL_SVG)
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/svg+xml')
  assert.ok((await response.text()).includes('<svg'))
})

test('handleComposioLogoProtocol rejects hosts other than the logo scheme', async () => {
  const response = await handleComposioLogoProtocol({ url: 'https://evil.example/gmail' }, async () =>
    svgResponse(GMAIL_SVG)
  )

  assert.equal(response.status, 400)
})

test('handleComposioLogoProtocol rejects HTTP failures and non-images', async () => {
  const missing = await handleComposioLogoProtocol({ url: GMAIL_PROTOCOL }, async () =>
    svgResponse('nope', { status: 404 })
  )

  assert.equal(missing.status, 502)

  const json = await handleComposioLogoProtocol({ url: GMAIL_PROTOCOL }, async () =>
    svgResponse('{"ok":true}', { type: 'application/json' })
  )

  assert.equal(json.status, 415)
})

test('handleComposioLogoProtocol rejects oversized payloads', async () => {
  const huge = `<svg>${'x'.repeat(COMPOSIO_LOGO_MAX_BYTES + 1)}</svg>`
  const response = await handleComposioLogoProtocol({ url: GMAIL_PROTOCOL }, async () => svgResponse(huge))

  assert.equal(response.status, 413)
})
