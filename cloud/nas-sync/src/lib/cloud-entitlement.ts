/**
 * Plan → single Cloud VM contract.
 *
 * Free has no VM. Plus/Super/Ultra map to one machine size. Callers never
 * pick the size. ensureOrgCloudInstanceWith is the only create path; POST
 * /api/agents stays closed. POST /api/cloud/ensure runs after the plan is
 * paid — not when Checkout opens. Returning to Free parks that machine:
 * the row and disk stay, and the next paid ensure wakes the same instance.
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

/**
 * Free stopped the machine and kept the row. Distinct from a user stop
 * (`stopped`), which must stay stopped after the org subscribes again.
 */
export const CLOUD_PARKED_STATUS = 'parked'

export const DEFAULT_CLOUD_INSTANCE_NAME = 'Work4You Cloud'

export const MANUAL_CLOUD_CREATE_ERROR = 'manual_create_disabled' as const

export type CloudInstanceRef = {
  id: string
  createdAt: string | Date
  status?: string | null
  /** Absent or blank means Fly never recorded a machine on this row. */
  flyMachineId?: string | null
  updatedAt?: string | Date | null
  /** Recorded machine size. Blank means the row cannot be resized safely. */
  size?: string | null
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
  | { action: 'resize'; instance: T; size: CloudSizeId }
  | { action: 'park'; instance: T }
  | { action: 'wake'; instance: T }
  | { action: 'create'; size: CloudSizeId; name: string }
  | { action: 'refuse'; error: 'paid_plan_required' }

const PARK_EXEMPT_STATUSES = new Set([
  CLOUD_PARKED_STATUS,
  'stopped',
  'deleting',
  NON_CLOUD_INSTANCE_STATUS,
])

function cloudStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase()
}

function hasFlyMachine(row: { flyMachineId?: string | null }): boolean {
  return Boolean((row.flyMachineId ?? '').trim())
}

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

export function recordedCloudSize(size: string | null | undefined): CloudSizeId | null {
  const id = (size ?? '').trim().toLowerCase()
  if (id === 'small' || id === 'medium' || id === 'large') return id
  return null
}

/** Disk only grows. A smaller plan keeps the volume that is already there. */
export function planDiskGb(currentGb: number, targetGb: number): number {
  const current = Number.isFinite(currentGb) && currentGb > 0 ? currentGb : 0
  const target = Number.isFinite(targetGb) && targetGb > 0 ? targetGb : 0
  return Math.max(current, target)
}

/** GB to send to Fly extend, or null when the volume must stay as it is. */
export function volumeExtendGb(currentGb: number, targetGb: number): number | null {
  if (!Number.isFinite(targetGb) || targetGb <= 0) return null
  if (!Number.isFinite(currentGb) || currentGb <= 0) return targetGb
  if (targetGb > currentGb) return targetGb
  return null
}

/**
 * Paid plan size when the existing machine should change.
 * An unborn row is resumed first. Free never resizes. A blank size is left
 * alone so we do not guess the machine's current shape.
 */
export function cloudInstanceResizeTarget(
  row: Pick<CloudInstanceRef, 'flyMachineId' | 'size' | 'status' | 'updatedAt'>,
  tierId: string | null | undefined,
  now = Date.now(),
): CloudSizeId | null {
  const target = cloudSizeForTier(tierId)
  if (!target) return null
  if (!(row.flyMachineId ?? '').trim()) return null
  if (cloudInstanceNeedsResume(row, now)) return null
  const current = recordedCloudSize(row.size)
  if (!current || current === target) return null
  return target
}

/**
 * Free, with a Fly machine that is not already stopped or parked.
 * An unborn row has no machine id and stays unborn so a later paid
 * ensure can still resume it. A user stop stays `stopped`.
 */
export function cloudInstanceNeedsPark(
  row: Pick<CloudInstanceRef, 'flyMachineId' | 'status'>,
  tierId: string | null | undefined,
): boolean {
  if (cloudSizeForTier(tierId)) return false
  if (!hasFlyMachine(row)) return false
  return !PARK_EXEMPT_STATUSES.has(cloudStatus(row.status))
}

/**
 * Paid plan should start the machine Free parked.
 * A different plan size is a resize, which starts a parked machine.
 * Status `stopped` is a user stop and is not woken.
 */
export function cloudInstanceNeedsWake(
  row: Pick<CloudInstanceRef, 'flyMachineId' | 'size' | 'status' | 'updatedAt'>,
  tierId: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!cloudSizeForTier(tierId)) return false
  if (cloudStatus(row.status) !== CLOUD_PARKED_STATUS) return false
  if (!hasFlyMachine(row)) return false
  if (cloudInstanceResizeTarget(row, tierId, now)) return false
  return true
}

/**
 * Fly `suspended` is idle sleep on a paid plan. It stays addressable, so a
 * list refresh must not record it as a user stop or a Free park.
 * Fly `stopped` is a real stop. A Free park stays parked.
 * Unknown Fly states return null and the row status is left alone.
 */
export function cloudStatusForFlyState(
  rowStatus: string | null | undefined,
  flyState: string | null | undefined,
): { status: string; gateway: 'active' | 'down' | 'unknown' } | null {
  const fly = (flyState ?? '').trim().toLowerCase()
  const row = (rowStatus ?? '').trim().toLowerCase()
  if (fly === 'started') return { status: 'online', gateway: 'active' }
  if (fly === 'suspended') {
    if (row === CLOUD_PARKED_STATUS) return { status: 'parked', gateway: 'down' }
    if (row === 'stopped') return { status: 'stopped', gateway: 'down' }
    return { status: 'online', gateway: 'active' }
  }
  if (fly === 'stopped') {
    if (row === CLOUD_PARKED_STATUS) return { status: 'parked', gateway: 'down' }
    return { status: 'stopped', gateway: 'down' }
  }
  if (fly === 'created' || fly === 'starting') {
    return { status: 'starting', gateway: 'unknown' }
  }
  if (fly === 'replacing' || fly === 'destroying') {
    return {
      status: row === 'updating' ? 'updating' : 'starting',
      gateway: 'unknown',
    }
  }
  return null
}

/** Resize starts a running, online, or parked machine. A user stop stays stopped. */
export function cloudResizeShouldStart(args: {
  flyRunning: boolean
  status?: string | null
}): boolean {
  if (args.flyRunning) return true
  const status = cloudStatus(args.status)
  return status === 'online' || status === CLOUD_PARKED_STATUS
}

/**
 * Start and image update need a paid plan. Stop stays available so a
 * Free org can still halt a machine the park path has not reached.
 */
export function cloudLifecycleActionAllowed(
  tierId: string | null | undefined,
  action: string,
): boolean {
  if (action === 'stop') return true
  if (action === 'start' || action === 'update') {
    return cloudEntitlement(tierId).canUseCloud
  }
  return false
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
 * Size is not an input. A live Cloud row stays the org's only VM.
 * A paid row whose Fly machine never got an id is resumed. A paid row whose
 * recorded size differs from the plan is resized in place. Free parks a
 * born machine and does not create. A parked machine wakes on the next
 * paid plan; a user stop stays stopped.
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
    const resizeTo = cloudInstanceResizeTarget(canonical, args.tierId, args.now)
    if (resizeTo) return { action: 'resize', instance: canonical, size: resizeTo }
    if (cloudInstanceNeedsWake(canonical, args.tierId, args.now)) {
      return { action: 'wake', instance: canonical }
    }
    if (cloudInstanceNeedsPark(canonical, args.tierId)) {
      return { action: 'park', instance: canonical }
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
  handlers: {
    resume?: (instance: T) => Promise<T>
    resize?: (instance: T, size: CloudSizeId) => Promise<T>
    park?: (instance: T) => Promise<T>
    wake?: (instance: T) => Promise<T>
  },
): Promise<CloudEnsureResult<T> | null> {
  if (decision.action === 'refuse') return { ok: false, error: decision.error }
  if (decision.action === 'reuse') {
    return { ok: true, created: false, instance: decision.instance }
  }
  if (decision.action === 'resume') {
    const instance = handlers.resume
      ? await handlers.resume(decision.instance)
      : decision.instance
    return { ok: true, created: false, instance }
  }
  if (decision.action === 'resize') {
    const instance = handlers.resize
      ? await handlers.resize(decision.instance, decision.size)
      : decision.instance
    return { ok: true, created: false, instance }
  }
  if (decision.action === 'park') {
    const instance = handlers.park
      ? await handlers.park(decision.instance)
      : decision.instance
    return { ok: true, created: false, instance }
  }
  if (decision.action === 'wake') {
    const instance = handlers.wake
      ? await handlers.wake(decision.instance)
      : decision.instance
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
  /** Change the canonical machine to the plan size. Does not insert a row. */
  resize?: (instance: T, size: CloudSizeId) => Promise<T>
  /** Stop the canonical machine and keep the row. Does not delete the disk. */
  park?: (instance: T) => Promise<T>
  /** Start a machine that was parked on Free. Does not insert a row. */
  wake?: (instance: T) => Promise<T>
}): Promise<CloudEnsureResult<T>> {
  const handlers = {
    resume: args.resume,
    resize: args.resize,
    park: args.park,
    wake: args.wake,
  }
  const listed = await args.list()
  const first = await settleExistingInstance(
    decideOrgCloudInstance({
      tierId: args.tierId,
      existing: listed,
      name: args.name,
      now: args.now,
    }),
    handlers,
  )
  if (first) return first

  const again = decideOrgCloudInstance({
    tierId: args.tierId,
    existing: await args.list(),
    name: args.name,
    now: args.now,
  })
  const settled = await settleExistingInstance(again, handlers)
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
