import { retrySubscriptionCloudEnsure } from '@/lib/cloud-entitlement'

export interface SubscriptionCloudEnsureResult {
  ensured: boolean
  created?: boolean
  instanceId?: string
  reason?: string
}

/**
 * Ask the Portal to ensure the org VM. Checkout return retries only while
 * the server still reports paid_plan_required (webhook lag). Other failures
 * stop immediately.
 */
export async function requestSubscriptionCloud(args: {
  headers: HeadersInit
  org?: string | null
  checkoutReturn?: boolean
  sleep?: (ms: number) => Promise<void>
}): Promise<SubscriptionCloudEnsureResult> {
  const once = async (): Promise<SubscriptionCloudEnsureResult> => {
    const res = await fetch('/api/cloud/ensure', {
      method: 'POST',
      headers: { ...headersRecord(args.headers), 'Content-Type': 'application/json' },
      body: JSON.stringify(args.org ? { org: args.org } : {}),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ensured?: unknown
      created?: unknown
      instanceId?: unknown
      reason?: unknown
    }
    if (!res.ok) return { ensured: false, reason: 'request_failed' }
    return {
      ensured: data.ensured === true,
      created: typeof data.created === 'boolean' ? data.created : undefined,
      instanceId: typeof data.instanceId === 'string' ? data.instanceId : undefined,
      reason: typeof data.reason === 'string' ? data.reason : undefined,
    }
  }

  return retrySubscriptionCloudEnsure({
    checkoutReturn: Boolean(args.checkoutReturn),
    request: once,
    sleep: args.sleep,
  })
}

function headersRecord(headers: HeadersInit): Record<string, string> {
  if (headers instanceof Headers) {
    const out: Record<string, string> = {}
    headers.forEach((value, key) => {
      out[key] = value
    })
    return out
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return { ...headers }
}
