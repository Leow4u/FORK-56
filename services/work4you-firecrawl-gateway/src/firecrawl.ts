/** Firecrawl upstream (platform key — invisible to clients). */

export type FirecrawlFetch = (
  path: string,
  init?: RequestInit,
) => Promise<Response>

const STRIP_REQUEST_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
])

export function firecrawlHeaders(
  apiKey: string,
  incoming?: Headers,
): Headers {
  const h = new Headers()
  h.set('authorization', `Bearer ${apiKey}`)
  h.set('content-type', incoming?.get('content-type') || 'application/json')
  const accept = incoming?.get('accept')
  if (accept) h.set('accept', accept)
  return h
}

export function createFirecrawlFetch(params: {
  apiUrl: string
  apiKey: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}): FirecrawlFetch {
  const fetchImpl = params.fetchImpl || fetch
  return (path, init) => {
    const url = `${params.apiUrl}${path.startsWith('/') ? path : `/${path}`}`
    const headers = firecrawlHeaders(
      params.apiKey,
      init?.headers instanceof Headers ? init.headers : undefined,
    )
    if (init?.headers && !(init.headers instanceof Headers)) {
      const extra = new Headers(init.headers)
      extra.forEach((value, key) => {
        if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) {
          headers.set(key, value)
        }
      })
    }
    const signal =
      init?.signal ||
      (AbortSignal.timeout ? AbortSignal.timeout(params.timeoutMs) : undefined)
    return fetchImpl(url, { ...init, headers, signal })
  }
}
