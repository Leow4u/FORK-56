/**
 * Plan → single Cloud VM contract.
 *
 * Free has no VM. Plus/Super/Ultra map to one machine size. Callers never
 * pick the size. ensureOrgCloudInstanceWith is the only create path; POST
 * /api/agents stays closed.
 */
import { getTier, isPaidTierId, type TierId } from './tiers'

export type CloudSizeId = 'small' | 'medium' | 'large'

export const TIER_CLOUD_SIZE: Record<Exclude<TierId, 'free'>, CloudSizeId> = {
  plus: 'small',
  super: 'medium',
  ultra: 'large',
}

/** Portal-registered local dashboards are not the subscription VM. */
export const NON_CLOUD_INSTANCE_STATUS = 'self_hosted'

export const DEFAULT_CLOUD_INSTANCE_NAME = 'Work4You Cloud'

export const MANUAL_CLOUD_CREATE_ERROR = 'manual_create_disabled' as const

export type CloudInstanceRef = {
  id: string
  createdAt: string | Date
  status?: string | null
}

export type CloudEntitlement = {
  tierId: TierId
  canUseCloud: boolean
  allowedSize: CloudSizeId | null
  /** Public create stays closed. Provisioning goes through ensure. */
  manualCreate: false
  reason: 'ok' | 'paid_plan_required'
}

export type CloudEnsureRefusal = {
  ok: false
  error: 'paid_plan_required'
}

export type CloudEnsureSuccess<T extends CloudInstanceRef = CloudInstanceRef> = {
  ok: true
  created: boolean
  instance: T
}

export type CloudEnsureResult<T extends CloudInstanceRef = CloudInstanceRef> =
  | CloudEnsureRefusal
  | CloudEnsureSuccess<T>

type EnsureDecision<T extends CloudInstanceRef> =
  | { action: 'reuse'; instance: T }
  | { action: 'create'; size: CloudSizeId; name: string }
  | { action: 'refuse'; error: 'paid_plan_required' }

export function normalizeCloudTierId(tierId: string | null | undefined): TierId {
  const raw = (tierId ?? '').trim().toLowerCase()
  return getTier(raw || 'free').tierId
}

export function cloudSizeForTier(tierId: string | null | undefined): CloudSizeId | null {
  const id = normalizeCloudTierId(tierId)
  if (!isPaidTierId(id)) return null
  return TIER_CLOUD_SIZE[id]
}

export function cloudInstanceName(name?: string | null): string {
  const trimmed = (name ?? '').trim().slice(0, 64)
  return trimmed || DEFAULT_CLOUD_INSTANCE_NAME
}

export function isSubscriptionCloudInstance(row: { status?: string | null }): boolean {
  return row.status !== NON_CLOUD_INSTANCE_STATUS
}

function createdAtMs(value: string | Date): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY
}

/** Oldest real Cloud row. Self-hosted registrations do not occupy the slot. */
export function canonicalCloudInstance<T extends CloudInstanceRef>(
  rows: readonly T[],
): T | null {
  let best: T | null = null
  for (const row of rows) {
    if (!isSubscriptionCloudInstance(row)) continue
    if (!best) {
      best = row
      continue
    }
    const rowMs = createdAtMs(row.createdAt)
    const bestMs = createdAtMs(best.createdAt)
    if (rowMs < bestMs || (rowMs === bestMs && row.id < best.id)) {
      best = row
    }
  }
  return best
}

export function cloudEntitlement(tierId: string | null | undefined): CloudEntitlement {
  const id = normalizeCloudTierId(tierId)
  const allowedSize = cloudSizeForTier(id)
  const canUseCloud = allowedSize !== null
  return {
    tierId: id,
    canUseCloud,
    allowedSize,
    manualCreate: false,
    reason: canUseCloud ? 'ok' : 'paid_plan_required',
  }
}

/**
 * Stable refusal for POST /api/agents. Authenticate first, then return this.
 * Name, size, and model on the body are ignored.
 */
export function manualCloudCreateRefusal(): {
  status: 403
  body: { error: typeof MANUAL_CLOUD_CREATE_ERROR; message: string }
} {
  return {
    status: 403,
    body: {
      error: MANUAL_CLOUD_CREATE_ERROR,
      message:
        'A instância Cloud nasce com a assinatura. Não é possível criar manualmente.',
    },
  }
}

/**
 * Size is not an input. An existing Cloud row is reused, including a legacy
 * Free VM and a size that no longer matches the plan (resize is a later step).
 */
export function decideOrgCloudInstance<T extends CloudInstanceRef>(args: {
  tierId: string | null | undefined
  existing: readonly T[]
  name?: string | null
}): EnsureDecision<T> {
  const canonical = canonicalCloudInstance(args.existing)
  if (canonical) return { action: 'reuse', instance: canonical }
  const size = cloudSizeForTier(args.tierId)
  if (!size) return { action: 'refuse', error: 'paid_plan_required' }
  return { action: 'create', size, name: cloudInstanceName(args.name) }
}

/**
 * Idempotent ensure. Lists twice before create so a row committed in between
 * is reused. Two callers that both still see an empty list can both provision;
 * closing that race needs a single-slot constraint on the NAS schema.
 */
export async function ensureOrgCloudInstanceWith<T extends CloudInstanceRef>(args: {
  tierId: string | null | undefined
  name?: string | null
  list: () => Promise<readonly T[]>
  create: (input: { size: CloudSizeId; name: string }) => Promise<T>
}): Promise<CloudEnsureResult<T>> {
  const first = decideOrgCloudInstance({
    tierId: args.tierId,
    existing: await args.list(),
    name: args.name,
  })
  if (first.action === 'refuse') return { ok: false, error: first.error }
  if (first.action === 'reuse') {
    return { ok: true, created: false, instance: first.instance }
  }

  const second = decideOrgCloudInstance({
    tierId: args.tierId,
    existing: await args.list(),
    name: args.name,
  })
  if (second.action === 'refuse') return { ok: false, error: second.error }
  if (second.action === 'reuse') {
    return { ok: true, created: false, instance: second.instance }
  }

  const instance = await args.create({ size: second.size, name: second.name })
  return { ok: true, created: true, instance }
}
