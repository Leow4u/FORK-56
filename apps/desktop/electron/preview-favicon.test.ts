import assert from 'node:assert/strict'

import { test } from 'vitest'

import { previewFaviconSrc } from '../../shared/src/preview-favicon'

import {
  bindPreviewFaviconFetch,
  handlePreviewFaviconProtocol,
  PREVIEW_FAVICON_MAX_BYTES,
  PREVIEW_FAVICON_PROTOCOL
} from './preview-favicon'

const ICON_URL = 'https://example.com/static/favicon.ico?v=2#top'
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
const ICO = Uint8Array.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10])
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>'

function iconRequest(url = ICON_URL) {
  const src = previewFaviconSrc(url)

  assert.ok(src)

  return { url: src }
}

function answer(body: BodyInit, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(body, { headers, status })
}

test('the page icon is fetched by the browser session, without cookies, at the address the page named', async () => {
  const calls: Array<{ init?: RequestInit & { bypassCustomProtocolHandlers?: boolean }; url: string }> = []

  const fetchImpl = bindPreviewFaviconFetch(async (url, init) => {
    calls.push({ init, url })

    return answer(PNG, { 'content-type': 'image/png' })
  })

  const response = await handlePreviewFaviconProtocol(iconRequest(), fetchImpl)

  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, new URL(ICON_URL).href)
  assert.equal(calls[0]?.init?.bypassCustomProtocolHandlers, true)
  assert.equal(calls[0]?.init?.credentials, 'omit')
})

test('an icon sent untyped or as octet-stream is served as what its bytes are', async () => {
  const ico = await handlePreviewFaviconProtocol(iconRequest(), async () => answer(ICO))

  assert.equal(ico.status, 200)
  assert.equal(ico.headers.get('content-type'), 'image/x-icon')
  assert.deepEqual(new Uint8Array(await ico.arrayBuffer()), ICO)

  const png = await handlePreviewFaviconProtocol(iconRequest(), async () =>
    answer(PNG, { 'content-type': 'application/octet-stream' })
  )

  assert.equal(png.headers.get('content-type'), 'image/png')
})

test('an svg icon is served only when it is one', async () => {
  const svg = await handlePreviewFaviconProtocol(iconRequest(), async () =>
    answer(SVG, { 'content-type': 'image/svg+xml; charset=utf-8' })
  )

  assert.equal(svg.status, 200)
  assert.equal(svg.headers.get('content-type'), 'image/svg+xml')

  const page = await handlePreviewFaviconProtocol(iconRequest(), async () =>
    answer('<html><body>not found</body></html>', { 'content-type': 'image/svg+xml' })
  )

  assert.equal(page.status, 415)
})

test('a page instead of an icon is refused', async () => {
  const html = await handlePreviewFaviconProtocol(iconRequest(), async () =>
    answer(`<html><body>${SVG}</body></html>`, { 'content-type': 'text/html' })
  )

  assert.equal(html.status, 415)

  const missing = await handlePreviewFaviconProtocol(iconRequest(), async () => answer('nope', {}, 404))

  assert.equal(missing.status, 502)

  const failed = await handlePreviewFaviconProtocol(iconRequest(), async () => {
    throw new Error('offline')
  })

  assert.equal(failed.status, 502)
})

test('an icon over the size cap is refused, declared or streamed', async () => {
  const declared = await handlePreviewFaviconProtocol(iconRequest(), async () =>
    answer(PNG, { 'content-length': String(PREVIEW_FAVICON_MAX_BYTES + 1), 'content-type': 'image/png' })
  )

  assert.equal(declared.status, 413)

  let pulls = 0

  const endless = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1
      controller.enqueue(new Uint8Array(16 * 1024))
    }
  })

  const streamed = await handlePreviewFaviconProtocol(iconRequest(), async () =>
    answer(endless, { 'content-type': 'image/png' })
  )

  assert.equal(streamed.status, 413)
  assert.ok(pulls <= Math.ceil(PREVIEW_FAVICON_MAX_BYTES / (16 * 1024)) + 2)
})

test('only an http(s) icon on the icon host is fetched', async () => {
  let fetched = false

  const fetchImpl = async () => {
    fetched = true

    return answer(PNG, { 'content-type': 'image/png' })
  }

  for (const url of [
    `${PREVIEW_FAVICON_PROTOCOL}://icon/${encodeURIComponent('file:///etc/hosts')}`,
    `${PREVIEW_FAVICON_PROTOCOL}://icon/${encodeURIComponent('data:image/png;base64,AAAA')}`,
    `${PREVIEW_FAVICON_PROTOCOL}://mark/${encodeURIComponent(ICON_URL)}`,
    `https://example.com/favicon.ico`
  ]) {
    const response = await handlePreviewFaviconProtocol({ url }, fetchImpl)

    assert.equal(response.status, 400, url)
  }

  assert.equal(fetched, false)
  assert.equal(previewFaviconSrc('data:image/png;base64,AAAA'), null)
  assert.equal(previewFaviconSrc('not a url'), null)
})
