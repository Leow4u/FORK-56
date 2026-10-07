import { previewFaviconTargetFromRequest } from '../../shared/src/preview-favicon'

export { PREVIEW_BROWSER_PARTITION, PREVIEW_FAVICON_PROTOCOL } from '../../shared/src/preview-favicon'

export const PREVIEW_FAVICON_MAX_BYTES = 64 * 1024
export const PREVIEW_FAVICON_TIMEOUT_MS = 8_000

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

type SessionFetchInit = RequestInit & { bypassCustomProtocolHandlers?: boolean }

/**
 * Adapter for the content area browser's `session.fetch`: Chromium's network,
 * with that browser's cache and proxy, and never its cookies.
 */
export function bindPreviewFaviconFetch(
  sessionFetch: (url: string, init?: SessionFetchInit) => Promise<Response>
): FetchLike {
  return (url, init) =>
    sessionFetch(url, {
      ...init,
      bypassCustomProtocolHandlers: true,
      credentials: 'omit'
    })
}

// Servers often send an icon untyped, or as octet-stream, so what its first
// bytes are decides before the declared type does.
const RASTER_SIGNATURES: ReadonlyArray<{ magic: readonly number[]; type: string }> = [
  { magic: [0x89, 0x50, 0x4e, 0x47], type: 'image/png' },
  { magic: [0x00, 0x00, 0x01, 0x00], type: 'image/x-icon' },
  { magic: [0x47, 0x49, 0x46, 0x38], type: 'image/gif' },
  { magic: [0xff, 0xd8, 0xff], type: 'image/jpeg' }
]

function rasterType(bytes: Buffer): string | null {
  const signature = RASTER_SIGNATURES.find(({ magic }) => magic.every((byte, index) => bytes[index] === byte))

  if (signature) {
    return signature.type
  }

  return bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP' ? 'image/webp' : null
}

function headerType(response: Response): string {
  return (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
}

/** The image `bytes` are: by their first bytes, else by the declared type.
 *  Null when they aren't one. An svg is text, so it must look like one. */
function iconType(bytes: Buffer, declared: string): string | null {
  const raster = rasterType(bytes)

  if (raster) {
    return raster
  }

  if (
    !declared ||
    declared === 'application/octet-stream' ||
    declared === 'image/svg+xml' ||
    declared === 'image/svg'
  ) {
    return /<svg[\s>/]/i.test(bytes.toString('utf8')) ? 'image/svg+xml' : null
  }

  return declared.startsWith('image/') ? declared : null
}

/** The body, or null once it outgrows `max` — the read stops there, so a huge
 *  answer is never buffered whole. */
async function cappedBody(response: Response, max: number): Promise<Buffer<ArrayBuffer> | null> {
  if (Number(response.headers.get('content-length') ?? '') > max) {
    return null
  }

  if (!response.body) {
    return Buffer.alloc(0)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      return Buffer.concat(chunks)
    }

    size += value.byteLength

    if (size > max) {
      await reader.cancel().catch(() => undefined)

      return null
    }

    chunks.push(value)
  }
}

/** The icon a page in the content area names, fetched by that area's browser
 *  for the work4you-favicon scheme: http(s) only, an image only, at most
 *  64 KB, without cookies. */
export async function handlePreviewFaviconProtocol(request: { url: string }, fetchImpl: FetchLike): Promise<Response> {
  const target = previewFaviconTargetFromRequest(request.url)

  if (!target) {
    return new Response('not a page icon', { status: 400 })
  }

  try {
    const response = await fetchImpl(target, {
      headers: { Accept: 'image/webp,image/svg+xml,image/*;q=0.9' },
      signal: AbortSignal.timeout(PREVIEW_FAVICON_TIMEOUT_MS)
    })

    if (!response.ok) {
      return new Response(`page icon http ${response.status}`, { status: 502 })
    }

    const bytes = await cappedBody(response, PREVIEW_FAVICON_MAX_BYTES)

    if (!bytes?.length) {
      return new Response('page icon size', { status: 413 })
    }

    const type = iconType(bytes, headerType(response))

    if (!type) {
      return new Response('page icon is not an image', { status: 415 })
    }

    return new Response(bytes, {
      headers: {
        'cache-control': 'public, max-age=86400',
        'content-type': type
      },
      status: 200
    })
  } catch {
    return new Response('page icon fetch failed', { status: 502 })
  }
}
