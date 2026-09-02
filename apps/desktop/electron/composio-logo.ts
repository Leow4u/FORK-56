import { isTrustedComposioLogoUrl } from '../../shared/src/mcp-directory'

export const COMPOSIO_LOGO_MAX_BYTES = 64 * 1024
export const COMPOSIO_LOGO_TIMEOUT_MS = 8_000

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

function headerType(response: Response): string {
  return (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
}

function isImageType(type: string): boolean {
  return !type || type === 'image/svg+xml' || type.startsWith('image/')
}

/** Main-process fetch of a trusted Composio mark into a data URL the file:// renderer can paint. */
export async function fetchComposioLogoDataUrl(rawUrl: string, fetchImpl: FetchLike = fetch): Promise<string> {
  const url = String(rawUrl || '').trim()

  if (!isTrustedComposioLogoUrl(url)) {
    throw new Error('untrusted composio logo url')
  }

  const response = await fetchImpl(url, {
    headers: { Accept: 'image/svg+xml,image/*;q=0.9' },
    redirect: 'error',
    signal: AbortSignal.timeout(COMPOSIO_LOGO_TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error(`composio logo http ${response.status}`)
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

  if (mime === 'image/svg+xml' || mime === 'image/svg') {
    const text = bytes.toString('utf8')

    if (!/<svg[\s>/]/i.test(text)) {
      throw new Error('composio logo is not svg')
    }

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`
  }

  return `data:${mime};base64,${bytes.toString('base64')}`
}
