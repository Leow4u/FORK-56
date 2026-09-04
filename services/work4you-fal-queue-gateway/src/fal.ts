/** FAL queue upstream (platform key — invisible to clients). */

export type FalFetch = (
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

const FORWARD_HEADER_PREFIXES = ['x-fal-', 'x-idempotency']

export function falHeaders(apiKey: string, incoming?: Headers): Headers {
  const h = new Headers()
  h.set('authorization', `Key ${apiKey}`)
  h.set('content-type', incoming?.get('content-type') || 'application/json')
  const accept = incoming?.get('accept')
  if (accept) h.set('accept', accept)
  if (incoming) {
    incoming.forEach((value, key) => {
      const k = key.toLowerCase()
      if (STRIP_REQUEST_HEADERS.has(k)) return
      if (FORWARD_HEADER_PREFIXES.some((p) => k.startsWith(p))) {
        h.set(key, value)
      }
    })
  }
  return h
}

export function createFalFetch(params: {
  queueUrl: string
  apiKey: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}): FalFetch {
  const fetchImpl = params.fetchImpl || fetch
  return (path, init) => {
    const url = `${params.queueUrl}${path.startsWith('/') ? path : `/${path}`}`
    const incoming =
      init?.headers instanceof Headers
        ? init.headers
        : init?.headers
          ? new Headers(init.headers)
          : undefined
    const headers = falHeaders(params.apiKey, incoming)
    const signal =
      init?.signal ||
      (AbortSignal.timeout ? AbortSignal.timeout(params.timeoutMs) : undefined)
    return fetchImpl(url, { ...init, headers, signal })
  }
}
