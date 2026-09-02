import assert from 'node:assert/strict'

import { test } from 'vitest'

import { COMPOSIO_LOGO_MAX_BYTES, fetchComposioLogoDataUrl } from './composio-logo'

const GMAIL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>'
const GMAIL_URL = 'https://logos.composio.dev/api/gmail'

function svgResponse(body: string, extra: { status?: number; type?: string } = {}): Response {
  return new Response(body, {
    status: extra.status ?? 200,
    headers: { 'content-type': extra.type ?? 'image/svg+xml' }
  })
}

test('fetchComposioLogoDataUrl inlines a trusted SVG as a data URL', async () => {
  const dataUrl = await fetchComposioLogoDataUrl(GMAIL_URL, async (url, init) => {
    assert.equal(url, GMAIL_URL)
    assert.equal(init?.redirect, 'error')

    return svgResponse(GMAIL_SVG)
  })

  assert.match(dataUrl, /^data:image\/svg\+xml;charset=utf-8,/)
  assert.ok(decodeURIComponent(dataUrl.split(',')[1]).includes('<svg'))
})

test('fetchComposioLogoDataUrl rejects hosts other than logos.composio.dev', async () => {
  await assert.rejects(
    () => fetchComposioLogoDataUrl('https://evil.example/api/gmail', async () => svgResponse(GMAIL_SVG)),
    /untrusted/
  )
})

test('fetchComposioLogoDataUrl rejects HTTP failures and non-images', async () => {
  await assert.rejects(
    () => fetchComposioLogoDataUrl(GMAIL_URL, async () => svgResponse('nope', { status: 404 })),
    /http 404/
  )
  await assert.rejects(
    () =>
      fetchComposioLogoDataUrl(GMAIL_URL, async () => svgResponse('{"ok":true}', { type: 'application/json' })),
    /not an image/
  )
})

test('fetchComposioLogoDataUrl rejects oversized payloads', async () => {
  const huge = `<svg>${'x'.repeat(COMPOSIO_LOGO_MAX_BYTES + 1)}</svg>`

  await assert.rejects(
    () => fetchComposioLogoDataUrl(GMAIL_URL, async () => svgResponse(huge)),
    /size/
  )
})

test('fetchComposioLogoDataUrl encodes raster bytes as base64', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

  const dataUrl = await fetchComposioLogoDataUrl(GMAIL_URL, async () => {
    return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } })
  })

  assert.equal(dataUrl, `data:image/png;base64,${png.toString('base64')}`)
})
