/**
 * Plan → single Cloud VM contract.
 *
 * Free has no VM. Plus/Super/Ultra map to one machine size. Callers never
 * pick the size. ensureOrgCloudInstanceWith is the only create path; POST
 * /api/agents stays closed. POST /api/cloud/ensure runs after the plan is
 * paid — not when Checkout opens.
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
  /** Absent or blank means Fly never recorded a machine on this row. */
  flyMachineId?: string | null
  updatedAt?: string | Date | null
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
  | { action: 'resume'; instance: T }
  | { action: 'create'; size: CloudSizeId; name: string }
  | { action: 'refuse'; error: 'paid_plan_required' }

/**
 * Past the ensure route's 300s maxDuration, so a live provision is not
 * still inside the request that created the row.
 */
export const CLOUD_PROVISION_STALE_MS = 360_000

/** Error without a machine can be retried, but not on every poll. */
export const CLOUD_PROVISION_ERROR_RETRY_MS = 60_000

const UNBORN_PROVISION_STATUSES = new Set(['provisioning', 'starting'])

function timestampAgeMs(
  value: string | Date | null | undefined,
  now: number,
): number | null {
  if (value == null || value === '') return null
  const ms = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(ms) ? now - ms : null
}

/**
 * Paid ensure should finish this row instead of treating it as done.
 * A machine id means Fly already created it. Fresh provisioning/starting
 * is an in-flight request. Error with no machine is a finished failure.
 * Missing updatedAt on provisioning is treated as in-flight.
 */
export function cloudInstanceNeedsResume(
  row: Pick<CloudInstanceRef, 'flyMachineId' | 'status' | 'updatedAt'>,
  now = Date.now(),
): boolean {
  if ((row.flyMachineId ?? '').trim()) return false
  const status = (row.status ?? '').trim().toLowerCase()
  if (status === 'error') {
    const age = timestampAgeMs(row.updatedAt, now)
    return age == null || age >= CLOUD_PROVISION_ERROR_RETRY_MS
  }
  if (!UNBORN_PROVISION_STATUSES.has(status)) return false
  const age = timestampAgeMs(row.updatedAt, now)
  return age != null && age >= CLOUD_PROVISION_STALE_MS
}

export type FlyBirthObservation = {
  appMissing: boolean
  machineIds: readonly string[]
  volumeIds: readonly string[]
}

export type FlyBirthPlan =
  | { action: 'adopt'; machineId: string }
  | { action: 'create_machine'; createApp: boolean; volumeId: string | null }

/**
 * How to finish a row whose machine id was never saved.
 * An existing Fly machine is adopted. A missing app is created once.
 * A saved or listed volume is reused so resume does not add a second disk.
 */
export function planFlyBirth(
  observation: FlyBirthObservation,
  savedVolumeId?: string | null,
): FlyBirthPlan {
  const machineId = observation.machineIds.map((id) => id.trim()).find(Boolean)
  if (machineId) return { action: 'adopt', machineId }
  if (observation.appMissing) {
    return { action: 'create_machine', createApp: true, volumeId: null }
  }
  const saved = (savedVolumeId ?? '').trim()
  const listed = observation.volumeIds.map((id) => id.trim()).find(Boolean)
  return {
    action: 'create_machine',
    createApp: false,
    volumeId: saved || listed || null,
  }
}

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
 * Size is not an input. A live Cloud row is reused, including a legacy Free
 * VM and a size that no longer matches the plan (resize is a later step).
 * A paid row whose Fly machine never got an id is resumed, not replaced.
 */
export function decideOrgCloudInstance<T extends CloudInstanceRef>(args: {
  tierId: string | null | undefined
  existing: readonly T[]
  name?: string | null
  now?: number
}): EnsureDecision<T> {
  const canonical = canonicalCloudInstance(args.existing)
  if (canonical) {
    if (
      isPaidTierId(normalizeCloudTierId(args.tierId)) &&
      cloudInstanceNeedsResume(canonical, args.now)
    ) {
      return { action: 'resume', instance: canonical }
    }
    return { action: 'reuse', instance: canonical }
  }
  const size = cloudSizeForTier(args.tierId)
  if (!size) return { action: 'refuse', error: 'paid_plan_required' }
  return { action: 'create', size, name: cloudInstanceName(args.name) }
}

/**
 * Idempotent ensure. Lists twice before create so a row committed in between
 * is reused. Two callers that both still see an empty list can both provision;
 * closing that race needs a single-slot constraint on the NAS schema.
 */
async function settleExistingInstance<T extends CloudInstanceRef>(
  decision: EnsureDecision<T>,
  resume?: (instance: T) => Promise<T>,
): Promise<CloudEnsureResult<T> | null> {
  if (decision.action === 'refuse') return { ok: false, error: decision.error }
  if (decision.action === 'reuse') {
    return { ok: true, created: false, instance: decision.instance }
  }
  if (decision.action === 'resume') {
    const instance = resume ? await resume(decision.instance) : decision.instance
    return { ok: true, created: false, instance }
  }
  return null
}

export async function ensureOrgCloudInstanceWith<T extends CloudInstanceRef>(args: {
  tierId: string | null | undefined
  name?: string | null
  now?: number
  list: () => Promise<readonly T[]>
  create: (input: { size: CloudSizeId; name: string }) => Promise<T>
  /** Finish the canonical row when its Fly machine was never recorded. */
  resume?: (instance: T) => Promise<T>
}): Promise<CloudEnsureResult<T>> {
  const listed = await args.list()
  const first = await settleExistingInstance(
    decideOrgCloudInstance({
      tierId: args.tierId,
      existing: listed,
      name: args.name,
      now: args.now,
    }),
    args.resume,
  )
  if (first) return first

  const again = decideOrgCloudInstance({
    tierId: args.tierId,
    existing: await args.list(),
    name: args.name,
    now: args.now,
  })
  const settled = await settleExistingInstance(again, args.resume)
  if (settled) return settled
  if (again.action !== 'create') {
    return { ok: false, error: 'paid_plan_required' }
  }
  const instance = await args.create({ size: again.size, name: again.name })
  return { ok: true, created: true, instance }
}

export type CloudEnsureHttpBody =
  | { ensured: false; reason: 'paid_plan_required' }
  | { ensured: true; created: boolean; instanceId: string }

/** Free stays 200 so the client can retry only that reason after Checkout. */
export function cloudEnsureBody(
  result:
    | { ok: false; error: 'paid_plan_required' }
    | { ok: true; created: boolean; instanceId: string },
): CloudEnsureHttpBody {
  if (!result.ok) return { ensured: false, reason: 'paid_plan_required' }
  return {
    ensured: true,
    created: result.created,
    instanceId: result.instanceId,
  }
}

/** Thrown before any DB insert when the Portal cannot talk to Fly. */
export class FlyNotConfiguredError extends Error {
  readonly code = 'fly_not_configured' as const

  constructor() {
    super('FLY_API_TOKEN em falta no Portal.')
    this.name = 'FlyNotConfiguredError'
  }
}

export function assertFlyApiToken(token: string | null | undefined): void {
  if (!(token ?? '').trim()) throw new FlyNotConfiguredError()
}

export type SubscriptionCloudEnsureBody = {
  ensured: boolean
  reason?: string
}

/** Webhook can lag the Checkout redirect. Five tries, two seconds apart. */
export const CLOUD_ENSURE_PAID_LAG_DELAY_MS = 2000
export const CLOUD_ENSURE_MAX_ATTEMPTS = 5

/**
 * Delay before another ensure, or null to stop.
 * Retry only on checkout return while the server still says the plan is free.
 */
export function nextCloudEnsureDelayMs(args: {
  checkoutReturn: boolean
  attempt: number
  body: SubscriptionCloudEnsureBody
}): number | null {
  if (args.body.ensured) return null
  if (
    args.checkoutReturn &&
    args.body.reason === 'paid_plan_required' &&
    args.attempt < CLOUD_ENSURE_MAX_ATTEMPTS - 1
  ) {
    return CLOUD_ENSURE_PAID_LAG_DELAY_MS
  }
  return null
}

export async function retrySubscriptionCloudEnsure<
  T extends SubscriptionCloudEnsureBody,
>(args: {
  checkoutReturn: boolean
  request: () => Promise<T>
  sleep?: (ms: number) => Promise<void>
}): Promise<T> {
  const sleep =
    args.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  let attempt = 0
  let body = await args.request()
  for (;;) {
    const delay = nextCloudEnsureDelayMs({
      checkoutReturn: args.checkoutReturn,
      attempt,
      body,
    })
    if (delay == null) return body
    await sleep(delay)
    attempt += 1
    body = await args.request()
  }
}
