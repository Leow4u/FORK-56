import {
  composioCdnUrlFromProtocolRequest,
  isTrustedComposioLogoUrl
} from '../../shared/src/mcp-directory'

export { COMPOSIO_LOGO_PROTOCOL } from '../../shared/src/mcp-directory'

export const COMPOSIO_LOGO_MAX_BYTES = 64 * 1024
export const COMPOSIO_LOGO_TIMEOUT_MS = 8_000

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

type NetFetchInit = RequestInit & { bypassCustomProtocolHandlers?: boolean }

/**
 * Adapter for Electron `net.fetch`. Callers must pass Chromium's fetch — Node
 * `fetch` is what left packaged Windows on letter avatars after #182.
 */
export function bindComposioLogoNetFetch(
  netFetch: (url: string, init?: NetFetchInit) => Promise<Response>
): FetchLike {
  return (url, init) =>
    netFetch(url, {
      ...init,
      bypassCustomProtocolHandlers: true,
      credentials: 'omit'
    })
}

function headerType(response: Response): string {
  return (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
}

function isImageType(type: string): boolean {
  return !type || type === 'image/svg+xml' || type.startsWith('image/')
}

function finalUrl(response: Response, fallback: string): string {
  return typeof response.url === 'string' && response.url ? response.url : fallback
}

/** Chromium-network fetch of a trusted Composio mark for the work4you-logo protocol. */
export async function handleComposioLogoProtocol(
  request: { url: string },
  fetchImpl: FetchLike
): Promise<Response> {
  const cdn = composioCdnUrlFromProtocolRequest(request.url)

  if (!cdn) {
    return new Response('untrusted composio logo url', { status: 400 })
  }

  try {
    const response = await fetchImpl(cdn, {
      headers: { Accept: 'image/svg+xml,image/*;q=0.9' },
      redirect: 'error',
      signal: AbortSignal.timeout(COMPOSIO_LOGO_TIMEOUT_MS)
    })

    if (!response.ok) {
      return new Response(`composio logo http ${response.status}`, { status: 502 })
    }

    if (!isTrustedComposioLogoUrl(finalUrl(response, cdn))) {
      return new Response('composio logo redirected off-host', { status: 400 })
    }

    const type = headerType(response)

    if (!isImageType(type)) {
      return new Response('composio logo is not an image', { status: 415 })
    }

    const bytes = Buffer.from(await response.arrayBuffer())

    if (!bytes.length || bytes.length > COMPOSIO_LOGO_MAX_BYTES) {
      return new Response('composio logo size', { status: 413 })
    }

    const mime = type || 'image/svg+xml'

    if ((mime === 'image/svg+xml' || mime === 'image/svg') && !/<svg[\s>/]/i.test(bytes.toString('utf8'))) {
      return new Response('composio logo is not svg', { status: 415 })
    }

    return new Response(bytes, {
      headers: {
        'cache-control': 'public, max-age=86400',
        'content-type': mime
      },
      status: 200
    })
  } catch {
    return new Response('composio logo fetch failed', { status: 502 })
  }
}
