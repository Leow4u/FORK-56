/** OpenRouter upstream (platform key — invisible to clients). */
import { config } from './config.js'

export function openRouterHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra)
  h.set('authorization', `Bearer ${config.openRouterApiKey}`)
  h.set('content-type', 'application/json')
  h.set('http-referer', config.openRouterHttpReferer)
  h.set('x-title', config.openRouterXTitle)
  return h
}

export async function openRouterFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${config.openRouterBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const headers = openRouterHeaders(init?.headers)
  return fetch(url, { ...init, headers })
}

type Pricing = { prompt?: string; completion?: string }

let pricingCache: { at: number; byId: Map<string, Pricing> } | null = null
const PRICING_TTL_MS = 10 * 60 * 1000

export async function getModelPricing(
  modelId: string,
): Promise<Pricing | null> {
  const now = Date.now()
  if (!pricingCache || now - pricingCache.at > PRICING_TTL_MS) {
    try {
      const res = await openRouterFetch('/models')
      const json = (await res.json()) as {
        data?: Array<{ id: string; pricing?: Pricing }>
      }
      const byId = new Map<string, Pricing>()
      for (const m of json.data || []) {
        if (m?.id && m.pricing) byId.set(m.id, m.pricing)
      }
      pricingCache = { at: now, byId }
    } catch {
      return pricingCache?.byId.get(modelId) || null
    }
  }
  return pricingCache.byId.get(modelId) || null
}
