/** NAS authorize + debit (Hermes billing wall path). */
import { config } from './config.js'

export type AuthorizeOk = { allowed: true }
export type AuthorizeDenied = {
  allowed: false
  status: number
  body: Record<string, unknown>
}

export async function authorizeOrg(
  orgId: string,
): Promise<AuthorizeOk | AuthorizeDenied> {
  const res = await fetch(
    `${config.portalBillingBaseUrl}/api/internal/billing/authorize`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.inferenceBillingSecret}`,
        'x-work4you-billing-key': config.inferenceBillingSecret,
      },
      body: JSON.stringify({ orgId }),
    },
  )
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 402 || body.allowed === false) {
    return { allowed: false, status: 402, body }
  }
  if (!res.ok) {
    return {
      allowed: false,
      status: res.status >= 400 ? res.status : 502,
      body: {
        error: 'authorize_failed',
        message: typeof body.message === 'string' ? body.message : 'authorize failed',
        upstream: body,
      },
    }
  }
  return { allowed: true }
}

export async function debitOrg(params: {
  orgId: string
  amountUsd: number
  idempotencyKey: string
  purpose?: string
}): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  if (!(params.amountUsd > 0) || !Number.isFinite(params.amountUsd)) {
    return { ok: true, status: 200, body: { skipped: true, reason: 'zero_amount' } }
  }
  const res = await fetch(
    `${config.portalBillingBaseUrl}/api/internal/billing/debit`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.inferenceBillingSecret}`,
        'x-work4you-billing-key': config.inferenceBillingSecret,
      },
      body: JSON.stringify({
        orgId: params.orgId,
        amountUsd: params.amountUsd,
        idempotencyKey: params.idempotencyKey,
        purpose: params.purpose || 'inference',
      }),
    },
  )
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, body }
}

/** Prefer OpenRouter usage.cost; else prompt/completion pricing from /models. */
export function costUsdFromUsage(
  usage: Record<string, unknown> | null | undefined,
  pricing: { prompt?: string; completion?: string } | null,
): number {
  if (!usage) return 0
  const direct = usage.cost
  if (typeof direct === 'number' && Number.isFinite(direct) && direct > 0) {
    return direct
  }
  if (typeof direct === 'string') {
    const n = Number(direct)
    if (Number.isFinite(n) && n > 0) return n
  }
  const promptTokens = Number(usage.prompt_tokens || 0)
  const completionTokens = Number(usage.completion_tokens || 0)
  if (!pricing) return 0
  const p = Number(pricing.prompt || 0)
  const c = Number(pricing.completion || 0)
  // OpenRouter model pricing is USD per token (already tiny fractions).
  const total = promptTokens * p + completionTokens * c
  return Number.isFinite(total) && total > 0 ? total : 0
}
