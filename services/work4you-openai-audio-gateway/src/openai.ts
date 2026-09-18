/** OpenAI audio upstream (platform key — invisible to clients). */

export type OpenAIFetch = (
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

export function openaiAudioHeaders(apiKey: string, incoming?: Headers): Headers {
  const h = new Headers()
  h.set('authorization', `Bearer ${apiKey}`)
  const contentType = incoming?.get('content-type')
  if (contentType) h.set('content-type', contentType)
  const accept = incoming?.get('accept')
  if (accept) h.set('accept', accept)
  const idempotency = incoming?.get('x-idempotency-key')
  if (idempotency) h.set('x-idempotency-key', idempotency)
  const beta = incoming?.get('openai-beta')
  if (beta) h.set('openai-beta', beta)
  return h
}

export function createOpenAIFetch(params: {
  apiUrl: string
  apiKey: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}): OpenAIFetch {
  const fetchImpl = params.fetchImpl || fetch
  return (path, init) => {
    const url = `${params.apiUrl}${path.startsWith('/') ? path : `/${path}`}`
    const headers = openaiAudioHeaders(
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
