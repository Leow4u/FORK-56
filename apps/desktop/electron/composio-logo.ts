import {
  composioCdnUrlFromProtocolRequest,
  isTrustedComposioLogoUrl
} from '../../shared/src/mcp-directory'

export { COMPOSIO_LOGO_PROTOCOL } from '../../shared/src/mcp-directory'

export const COMPOSIO_LOGO_MAX_BYTES = 64 * 1024
export const COMPOSIO_LOGO_TIMEOUT_MS = 8_000

/** Privileges for the logo scheme. `stream` matches work4you-media; CSP/CORS
 *  so a file:// renderer can consume the response if anything still hits the
 *  scheme. The MCP tab paints via data URLs from `fetchComposioLogoDataUrl`. */
export const COMPOSIO_LOGO_SCHEME_PRIVILEGES = {
  bypassCSP: true,
  corsEnabled: true,
  secure: true,
  standard: true,
  stream: true,
  supportFetchAPI: true
} as const

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

export interface ComposioLogoBytes {
  bytes: Buffer
  mime: string
}

/** Chromium-network fetch of a trusted Composio mark. */
export async function loadTrustedComposioLogo(
  rawUrl: string,
  fetchImpl: FetchLike
): Promise<ComposioLogoBytes> {
  const url = String(rawUrl || '').trim()

  if (!isTrustedComposioLogoUrl(url)) {
    throw new Error('untrusted composio logo url')
  }

  const response = await fetchImpl(url, {
    headers: { Accept: 'image/svg+xml,image/*;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(COMPOSIO_LOGO_TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error(`composio logo http ${response.status}`)
  }

  if (!isTrustedComposioLogoUrl(finalUrl(response, url))) {
    throw new Error('composio logo redirected off-host')
  }

  const type = headerType(response)

  if (!isImageType(type)) {
    throw new Error('composio logo is not an image')
  }

  const bytes = Buffer.from(await response.arrayBuffer())

  if (!bytes.length || bytes.length > COMPOSIO_LOGO_MAX_BYTES) {
    throw new Error('composio logo size')
  }

  const mime = type || 'image/svg+xml'

  if ((mime === 'image/svg+xml' || mime === 'image/svg') && !/<svg[\s>/]/i.test(bytes.toString('utf8'))) {
    throw new Error('composio logo is not svg')
  }

  return { bytes, mime }
}

/** Data URL the file:// renderer can put on <img src>. */
export async function fetchComposioLogoDataUrl(rawUrl: string, fetchImpl: FetchLike): Promise<string> {
  const { bytes, mime } = await loadTrustedComposioLogo(rawUrl, fetchImpl)

  if (mime === 'image/svg+xml' || mime === 'image/svg') {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bytes.toString('utf8'))}`
  }

  return `data:${mime};base64,${bytes.toString('base64')}`
}

function protocolErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : ''

  if (message.includes('untrusted') || message.includes('redirected')) {
    return 400
  }

  if (message.includes('size')) {
    return 413
  }

  if (message.includes('not an image') || message.includes('not svg')) {
    return 415
  }

  return 502
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
    const { bytes, mime } = await loadTrustedComposioLogo(cdn, fetchImpl)

    return new Response(Uint8Array.from(bytes), {
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=86400',
        'content-type': mime
      },
      status: 200
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'composio logo fetch failed'

    return new Response(message, { status: protocolErrorStatus(error) })
  }
}
