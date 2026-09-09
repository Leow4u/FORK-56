/**
 * Paths the Work4You web tools actually call (web_search / web_extract).
 * Team, crawl, agent, and billing Firecrawl routes stay closed so the
 * platform key cannot leak account state or run unbounded jobs.
 */
const ALLOWED = new Set([
  'POST /v1/search',
  'POST /v2/search',
  'POST /v1/scrape',
  'POST /v2/scrape',
])

export function normalizePath(pathname: string): string {
  if (!pathname.startsWith('/')) return `/${pathname}`
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function isAllowedFirecrawlRoute(method: string, pathname: string): boolean {
  const m = method.toUpperCase()
  const p = normalizePath(pathname)
  if (p.includes('..') || p.includes('//')) return false
  return ALLOWED.has(`${m} ${p}`)
}

export function creditsUsedFromJson(json: unknown): number {
  if (!json || typeof json !== 'object') return 0
  const o = json as Record<string, unknown>
  const top = o.creditsUsed ?? o.credits_used
  if (typeof top === 'number' && Number.isFinite(top) && top > 0) return top
  const data = o.data
  if (data && typeof data === 'object') {
    const nested = (data as Record<string, unknown>).creditsUsed
    if (typeof nested === 'number' && Number.isFinite(nested) && nested > 0) {
      return nested
    }
  }
  return 0
}
