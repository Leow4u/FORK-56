/**
 * FAL queue apps the Work4You image_generate tool actually calls
 * (text-to-image + paired /edit + Clarity upscaler).
 * Video endpoints stay closed on this host — they are a separate
 * coverage category (`fal-video`) and a later product step.
 */
export const ALLOWED_APPS = [
  'alibaba/qwen-image-3/edit',
  'alibaba/qwen-image-3/text-to-image',
  'bytedance/seedream/v5/lite/text-to-image',
  'bytedance/seedream/v5/pro/edit',
  'bytedance/seedream/v5/pro/text-to-image',
  'fal-ai/clarity-upscaler',
  'fal-ai/flux-2-pro',
  'fal-ai/flux-2-pro/edit',
  'fal-ai/flux-2/klein/9b',
  'fal-ai/flux-2/klein/9b/edit',
  'fal-ai/gpt-image-1.5',
  'fal-ai/gpt-image-1.5/edit',
  'fal-ai/gpt-image-2',
  'fal-ai/ideogram/v3',
  'fal-ai/ideogram/v3/edit',
  'fal-ai/krea/v2/large/text-to-image',
  'fal-ai/krea/v2/medium/text-to-image',
  'fal-ai/nano-banana-2',
  'fal-ai/nano-banana-2/edit',
  'fal-ai/nano-banana-pro',
  'fal-ai/nano-banana-pro/edit',
  'fal-ai/qwen-image',
  'fal-ai/qwen-image-2/pro/edit',
  'fal-ai/recraft/v4.1/text-to-image',
  'fal-ai/recraft/v4/pro/text-to-image',
  'fal-ai/z-image/turbo',
  'google/nano-banana-2-lite',
  'google/nano-banana-2-lite/edit',
  'ideogram/v4/fast',
  'ideogram/v4/instant',
  'microsoft/mai-image-2.5-pro',
  'openai/gpt-image-2/edit',
  'xai/grok-imagine-image/v2.0/edit',
  'xai/grok-imagine-image/v2.0/text-to-image',
] as const

const APPS_BY_LENGTH = [...ALLOWED_APPS].sort((a, b) => b.length - a.length)

const REQUEST_ID = '[A-Za-z0-9._-]{8,128}'
const GET_REST = new RegExp(
  `^/requests/${REQUEST_ID}(/(status|response))?$`,
)
const CANCEL_REST = new RegExp(`^/requests/${REQUEST_ID}/cancel$`)

export type MatchedFalRoute = {
  app: string
  rest: string
  kind: 'submit' | 'status' | 'result' | 'cancel'
}

export function normalizePath(pathname: string): string {
  if (!pathname.startsWith('/')) return `/${pathname}`
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function matchAllowedApp(
  pathname: string,
): { app: string; rest: string } | null {
  const p = normalizePath(pathname)
  if (p.includes('..') || p.includes('//')) return null
  for (const app of APPS_BY_LENGTH) {
    const prefix = `/${app}`
    if (p === prefix) return { app, rest: '' }
    if (p.startsWith(`${prefix}/`)) {
      return { app, rest: p.slice(prefix.length) }
    }
  }
  return null
}

export function parseFalQueueRoute(
  method: string,
  pathname: string,
  search = '',
): MatchedFalRoute | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (params.has('fal_webhook')) return null

  const matched = matchAllowedApp(pathname)
  if (!matched) return null

  const m = method.toUpperCase()
  const rest = matched.rest || ''

  if (m === 'POST' && rest === '') {
    return { ...matched, rest, kind: 'submit' }
  }
  if (m === 'GET' && GET_REST.test(rest)) {
    const kind = rest.endsWith('/status') ? 'status' : 'result'
    return { ...matched, rest, kind }
  }
  if (m === 'PUT' && CANCEL_REST.test(rest)) {
    return { ...matched, rest, kind: 'cancel' }
  }
  return null
}

export function isAllowedFalRoute(
  method: string,
  pathname: string,
  search = '',
): boolean {
  return parseFalQueueRoute(method, pathname, search) !== null
}

/** FAL queue request id from `/requests/{id}…` rest, used as NAS debit idempotency. */
export function falRequestIdFromRest(rest: string): string | null {
  const m = rest.match(/^\/requests\/([A-Za-z0-9._-]{8,128})/)
  return m ? m[1] : null
}

/** Rewrite queue.fal.run URLs in a JSON tree onto the gateway origin. */
export function rewriteQueueUrls(
  value: unknown,
  falQueueOrigin: string,
  gatewayOrigin: string,
): unknown {
  const from = falQueueOrigin.replace(/\/$/, '')
  const to = gatewayOrigin.replace(/\/$/, '')
  if (!from || from === to) return value

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      if (node === from || node.startsWith(`${from}/`)) {
        return to + node.slice(from.length)
      }
      return node
    }
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = walk(v)
      }
      return out
    }
    return node
  }
  return walk(value)
}
