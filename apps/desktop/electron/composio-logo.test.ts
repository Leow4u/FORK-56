import assert from 'node:assert/strict'

import { test } from 'vitest'

import {
  bindComposioLogoNetFetch,
  COMPOSIO_LOGO_MAX_BYTES,
  COMPOSIO_LOGO_PROTOCOL,
  COMPOSIO_LOGO_SCHEME_PRIVILEGES,
  fetchComposioLogoDataUrl,
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
  assert.equal(calls[0]?.init?.redirect, 'follow')
})

test('logo scheme privileges match the media paint path (stream + bypassCSP)', () => {
  assert.equal(COMPOSIO_LOGO_SCHEME_PRIVILEGES.stream, true)
  assert.equal(COMPOSIO_LOGO_SCHEME_PRIVILEGES.bypassCSP, true)
  assert.equal(COMPOSIO_LOGO_SCHEME_PRIVILEGES.supportFetchAPI, true)
})

test('handleComposioLogoProtocol serves a trusted SVG through the privileged scheme', async () => {
  const response = await handleComposioLogoProtocol({ url: GMAIL_PROTOCOL }, async (url, init) => {
    assert.equal(url, GMAIL_CDN)
    assert.equal(init?.redirect, 'follow')

    return svgResponse(GMAIL_SVG)
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/svg+xml')
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
  assert.ok((await response.text()).includes('<svg'))
})

test('handleComposioLogoProtocol rejects hosts other than the logo scheme', async () => {
  const response = await handleComposioLogoProtocol(
    { url: 'https://evil.example/gmail' },
    async () => svgResponse(GMAIL_SVG)
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

test('fetchComposioLogoDataUrl inlines a trusted SVG as a data URL', async () => {
  const dataUrl = await fetchComposioLogoDataUrl(GMAIL_CDN, async (url, init) => {
    assert.equal(url, GMAIL_CDN)
    assert.equal(init?.redirect, 'follow')

    return svgResponse(GMAIL_SVG)
  })

  assert.match(dataUrl, /^data:image\/svg\+xml;charset=utf-8,/)
  assert.ok(decodeURIComponent(dataUrl.split(',')[1] ?? '').includes('<svg'))
})

test('fetchComposioLogoDataUrl rejects hosts other than logos.composio.dev', async () => {
  await assert.rejects(
    () => fetchComposioLogoDataUrl('https://evil.example/api/gmail', async () => svgResponse(GMAIL_SVG)),
    /untrusted/
  )
})

test('fetchComposioLogoDataUrl rejects HTTP failures and non-images', async () => {
  await assert.rejects(
    () => fetchComposioLogoDataUrl(GMAIL_CDN, async () => svgResponse('nope', { status: 404 })),
    /http 404/
  )
  await assert.rejects(
    () => fetchComposioLogoDataUrl(GMAIL_CDN, async () => svgResponse('{"ok":true}', { type: 'application/json' })),
    /not an image/
  )
})

test('fetchComposioLogoDataUrl rejects oversized payloads', async () => {
  const huge = `<svg>${'x'.repeat(COMPOSIO_LOGO_MAX_BYTES + 1)}</svg>`

  await assert.rejects(() => fetchComposioLogoDataUrl(GMAIL_CDN, async () => svgResponse(huge)), /size/)
})

test('fetchComposioLogoDataUrl encodes raster bytes as base64', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

  const dataUrl = await fetchComposioLogoDataUrl(GMAIL_CDN, async () => {
    return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } })
  })

  assert.equal(dataUrl, `data:image/png;base64,${png.toString('base64')}`)
})

test('loadTrustedComposioLogo rejects a redirect off logos.composio.dev', async () => {
  const response = await handleComposioLogoProtocol({ url: GMAIL_PROTOCOL }, async () => {
    const redirected = svgResponse(GMAIL_SVG)

    Object.defineProperty(redirected, 'url', { value: 'https://evil.example/gmail.svg' })

    return redirected
  })

  assert.equal(response.status, 400)
})
