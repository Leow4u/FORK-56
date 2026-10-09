/** NAS authorize + debit — same wall as work4you-inference-api. */
import { config } from './config.js'
import {
  DEFAULT_TIER_RATE_LIMITS,
  type RateLimitConfig,
} from './rate-limit.js'

export type AuthorizeOk = {
  allowed: true
  paidPlan: boolean
  tierId: string
  subscriptionTier: number
  rateLimit: RateLimitConfig
}
export type AuthorizeDenied = {
  allowed: false
  status: number
  body: Record<string, unknown>
  paidPlan?: boolean
  tierId?: string
  rateLimit?: RateLimitConfig
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
  const tierId = typeof body.tier_id === 'string' ? body.tier_id : 'free'
  const paidPlan =
    typeof body.paid_plan === 'boolean' ? body.paid_plan : tierId !== 'free'
  const subscriptionTier =
    typeof body.subscription_tier === 'number' ? body.subscription_tier : 0
  const rateLimit =
    body.rate_limit &&
    typeof body.rate_limit === 'object' &&
    typeof (body.rate_limit as { rpm?: unknown }).rpm === 'number' &&
    typeof (body.rate_limit as { tpm?: unknown }).tpm === 'number'
      ? (body.rate_limit as RateLimitConfig)
      : DEFAULT_TIER_RATE_LIMITS[tierId] || DEFAULT_TIER_RATE_LIMITS.free

  if (res.status === 402 || body.allowed === false) {
    return {
      allowed: false,
      status: 402,
      body,
      paidPlan,
      tierId,
      rateLimit,
    }
  }
  if (!res.ok) {
    return {
      allowed: false,
      status: res.status >= 400 ? res.status : 502,
      body: {
        error: 'authorize_failed',
        message:
          typeof body.message === 'string' ? body.message : 'authorize failed',
        upstream: body,
      },
    }
  }
  return {
    allowed: true,
    paidPlan,
    tierId,
    subscriptionTier,
    rateLimit,
  }
}

export async function debitOrg(params: {
  orgId: string
  amountUsd: number
  idempotencyKey: string
  purpose?: string
  apiKeyId?: string | null
}): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const amount = Number.isFinite(params.amountUsd) ? params.amountUsd : 0
  if (!(amount > 0)) {
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
        amountUsd: amount,
        idempotencyKey: params.idempotencyKey,
        purpose: params.purpose || 'fal-queue',
        ...(params.apiKeyId ? { apiKeyId: params.apiKeyId } : {}),
      }),
    },
  )
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, body }
}
