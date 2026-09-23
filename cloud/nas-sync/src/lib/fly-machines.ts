/**
 * Fly Machines REST client for Work4You Cloud (greenfield — not the legacy Wayne stack).
 * Auth: FLY_API_TOKEN (org token). Org slug: FLY_ORG (default personal).
 */

const MACHINES = 'https://api.machines.dev/v1'

function token(): string {
  const t = process.env.FLY_API_TOKEN
  if (!t) throw new Error('FLY_API_TOKEN missing')
  return t
}

function orgSlug(): string {
  return process.env.FLY_ORG || 'personal'
}

async function flyFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${MACHINES}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  if (!res.ok) {
    const err = new Error(
      `fly ${init.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 400)}`,
    ) as Error & { status: number; body: unknown }
    err.status = res.status
    err.body = body
    throw err
  }
  return body as T
}

export type FlyApp = {
  id: string
  name: string
  status?: string
}

/** Machine config as returned/accepted by Fly Machines API. */
export type FlyMachineConfig = {
  image?: string
  env?: Record<string, string>
  guest?: { cpu_kind?: string; cpus?: number; memory_mb?: number }
  init?: { cmd?: string[]; entrypoint?: string[]; exec?: string[] }
  services?: unknown[]
  mounts?: Array<{ volume: string; path: string; size_gb?: number }>
  auto_destroy?: boolean
  restart?: { policy?: string; max_retries?: number }
  [key: string]: unknown
}

export type FlyMachine = {
  id: string
  name?: string
  state?: string
  region?: string
  instance_id?: string
  config?: FlyMachineConfig
  /** Present on GET even when `config.image` is omitted. */
  image_ref?: {
    registry?: string
    repository?: string
    tag?: string
    digest?: string
  }
}

export type FlyVolume = {
  id: string
  name: string
  size_gb: number
  region: string
}

/** Compare image refs ignoring digest suffixes and case. */
export function normalizeImageRef(image: string): string {
  return image.split('@')[0]!.trim().toLowerCase()
}

export function imagesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  return normalizeImageRef(a) === normalizeImageRef(b)
}

/** Best-effort image ref from a Machines API payload. */
export function imageFromMachine(machine: FlyMachine): string | null {
  const fromConfig = machine.config?.image
  if (typeof fromConfig === 'string' && fromConfig.trim()) {
    return fromConfig.trim()
  }
  const ref = machine.image_ref
  if (ref?.registry && ref.repository && ref.tag) {
    return `${ref.registry}/${ref.repository}:${ref.tag}`
  }
  return null
}

export async function listMachines(appName: string): Promise<FlyMachine[]> {
  const body = await flyFetch<FlyMachine[] | { machines?: FlyMachine[] }>(
    `/apps/${encodeURIComponent(appName)}/machines`,
  )
  if (Array.isArray(body)) return body
  if (body && Array.isArray(body.machines)) return body.machines
  return []
}

export async function createFlyApp(name: string): Promise<FlyApp> {
  return flyFetch<FlyApp>('/apps', {
    method: 'POST',
    body: JSON.stringify({ app_name: name, org_slug: orgSlug() }),
  })
}

/** True when Fly rejected a create because the app, volume, or IP already exists. */
export function flyAlreadyExists(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const status = (error as { status?: number }).status
  if (status !== 409 && status !== 422) return false
  const message = error instanceof Error ? error.message : ''
  return /already|exists|taken|duplicate/i.test(message)
}

export async function deleteFlyApp(appName: string): Promise<void> {
  try {
    await flyFetch(`/apps/${encodeURIComponent(appName)}`, { method: 'DELETE' })
  } catch (e) {
    const err = e as { status?: number }
    if (err.status === 404) return
    throw e
  }
}

export async function allocateSharedIpv4(appName: string): Promise<void> {
  // Best-effort: machines with HTTP services often get shared IPv4 automatically.
  // GraphQL allocate is still useful when the platform requires an explicit IP.
  const res = await fetch('https://api.fly.io/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        mutation($input: AllocateIPAddressInput!) {
          allocateIpAddress(input: $input) {
            ipAddress { id address type }
          }
        }
      `,
      variables: {
        input: { appId: appName, type: 'shared_v4' },
      },
    }),
  })
  const json = (await res.json()) as {
    errors?: Array<{ message: string }>
    data?: { allocateIpAddress?: { ipAddress?: unknown } }
  }
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join('; ')
    if (/already|exists|allocated/i.test(msg)) return
    // Non-fatal — service-defined shared IPv4 may still work.
    console.warn(`fly allocateIp (non-fatal): ${msg}`)
  }
}

export async function listVolumes(appName: string): Promise<FlyVolume[]> {
  const body = await flyFetch<FlyVolume[] | { volumes?: FlyVolume[] }>(
    `/apps/${encodeURIComponent(appName)}/volumes`,
  )
  if (Array.isArray(body)) return body
  if (body && Array.isArray(body.volumes)) return body.volumes
  return []
}

/** True when the running guest is not the plan's CPU and memory. */
export function guestNeedsResize(
  current: { cpu_kind?: string; cpus?: number; memory_mb?: number } | undefined,
  target: { cpu_kind: string; cpus: number; memory_mb: number },
): boolean {
  if (!current) return true
  return (
    current.cpu_kind !== target.cpu_kind ||
    current.cpus !== target.cpus ||
    current.memory_mb !== target.memory_mb
  )
}

export async function extendVolume(args: {
  appName: string
  volumeId: string
  sizeGb: number
}): Promise<void> {
  try {
    await flyFetch(
      `/apps/${encodeURIComponent(args.appName)}/volumes/${encodeURIComponent(args.volumeId)}/extend`,
      {
        method: 'POST',
        body: JSON.stringify({ size_gb: args.sizeGb }),
      },
    )
  } catch (error) {
    if (flyAlreadyExists(error)) return
    const message = error instanceof Error ? error.message : ''
    if (/greater than or equal|already at|not larger|cannot be smaller|same size/i.test(message)) {
      return
    }
    throw error
  }
}

export async function createVolume(args: {
  appName: string
  name: string
  region: string
  sizeGb: number
}): Promise<FlyVolume> {
  return flyFetch<FlyVolume>(
    `/apps/${encodeURIComponent(args.appName)}/volumes`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: args.name,
        region: args.region,
        size_gb: args.sizeGb,
        encrypted: true,
      }),
    },
  )
}

const SCALE_TO_ZERO_ENV = 'WORK4YOU_SCALE_TO_ZERO'
const WAKE_URL_ENV = 'GATEWAY_RELAY_WAKE_URL'
const DASHBOARD_URL_ENV = 'WORK4YOU_DASHBOARD_PUBLIC_URL'

type ScaleToZeroService = {
  autostop?: string
  autostart?: boolean
  [key: string]: unknown
}

/**
 * Paid Cloud idle sleep. The gateway inside the machine decides when to
 * suspend (it can see a live turn). Fly proxy autostop stays off. Autostart
 * wakes the machine on the next request to the dashboard.
 * A config with no dashboard address is left alone — there is no wake target.
 */
export function withCloudScaleToZero(config: FlyMachineConfig): {
  config: FlyMachineConfig
  changed: boolean
} {
  const env = { ...(config.env ?? {}) }
  const wake = (env[WAKE_URL_ENV] || env[DASHBOARD_URL_ENV] || '')
    .trim()
    .replace(/\/$/, '')
  if (!wake) return { config, changed: false }

  const nextEnv = {
    ...env,
    [SCALE_TO_ZERO_ENV]: '1',
    [WAKE_URL_ENV]: wake,
  }
  const services = Array.isArray(config.services) ? config.services : null
  const nextServices = services
    ? services.map((service) => {
        if (!service || typeof service !== 'object') return service
        return { ...(service as ScaleToZeroService), autostop: 'off', autostart: true }
      })
    : null

  const envChanged =
    env[SCALE_TO_ZERO_ENV] !== '1' ||
    (env[WAKE_URL_ENV] || '').trim().replace(/\/$/, '') !== wake
  const servicesChanged = Boolean(
    services &&
      nextServices &&
      services.some((service, index) => {
        const next = nextServices[index]
        if (!service || typeof service !== 'object' || !next || typeof next !== 'object') {
          return false
        }
        const current = service as ScaleToZeroService
        const patched = next as ScaleToZeroService
        return current.autostop !== patched.autostop || current.autostart !== true
      }),
  )
  if (!envChanged && !servicesChanged) return { config, changed: false }
  return {
    config: {
      ...config,
      env: nextEnv,
      ...(nextServices ? { services: nextServices } : {}),
    },
    changed: true,
  }
}

/**
 * Write the idle-sleep stamp onto a machine that is not running.
 * A started machine is left alone so a billing visit does not restart it.
 */
export async function syncMachineScaleToZero(args: {
  appName: string
  machineId: string
}): Promise<{ changed: boolean }> {
  const current = await getMachine(args.appName, args.machineId)
  const state = (current.state ?? '').toLowerCase()
  if (state === 'started' || state === 'starting') return { changed: false }
  if (!current.config) return { changed: false }
  const patched = withCloudScaleToZero(current.config)
  if (!patched.changed) return { changed: false }
  await updateMachine({
    appName: args.appName,
    machineId: args.machineId,
    config: patched.config,
    skip_launch: true,
  })
  return { changed: true }
}

export async function createMachine(args: {
  appName: string
  region: string
  image: string
  name: string
  guest: { cpu_kind: string; cpus: number; memory_mb: number }
  env: Record<string, string>
  volumeId: string
  internalPort: number
}): Promise<FlyMachine> {
  const stamped = withCloudScaleToZero({
    image: args.image,
    env: args.env,
    guest: args.guest,
    // Golden image ENTRYPOINT is entrypoint-dispatch.sh with empty CMD.
    // Fly Machines are not PID 1, so we must pass the dashboard subcommand
    // explicitly (same as fly.cloud-runtime.toml [processes] app=).
    init: {
      cmd: [
        'dashboard',
        '--host',
        '0.0.0.0',
        '--port',
        String(args.internalPort),
        '--no-open',
      ],
    },
    services: [
      {
        protocol: 'tcp',
        internal_port: args.internalPort,
        ports: [
          { port: 443, handlers: ['tls', 'http'] },
          { port: 80, handlers: ['http'] },
        ],
        force_https: true,
        autostop: 'off',
        autostart: true,
      },
    ],
    mounts: [
      {
        volume: args.volumeId,
        path: '/opt/data',
      },
    ],
    auto_destroy: false,
    restart: { policy: 'on-failure', max_retries: 10 },
  })
  return flyFetch<FlyMachine>(
    `/apps/${encodeURIComponent(args.appName)}/machines`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: args.name,
        region: args.region,
        config: stamped.config,
      }),
    },
  )
}

export async function waitMachine(
  appName: string,
  machineId: string,
  state: string,
  timeoutSec = 60,
): Promise<void> {
  // Fly Machines wait API rejects timeouts outside [1s, 60s].
  const bounded = Math.max(1, Math.min(60, Math.floor(timeoutSec)))
  const q = new URLSearchParams({
    state,
    timeout: String(bounded),
  })
  await flyFetch(
    `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/wait?${q}`,
  )
}

export async function stopMachine(
  appName: string,
  machineId: string,
): Promise<void> {
  await flyFetch(
    `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/stop`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}

export async function startMachine(
  appName: string,
  machineId: string,
): Promise<void> {
  await flyFetch(
    `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/start`,
    { method: 'POST' },
  )
}

export async function destroyMachine(
  appName: string,
  machineId: string,
): Promise<void> {
  try {
    await flyFetch(
      `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}?force=true`,
      { method: 'DELETE' },
    )
  } catch (e) {
    const err = e as { status?: number }
    if (err.status === 404) return
    throw e
  }
}

export async function getMachine(
  appName: string,
  machineId: string,
): Promise<FlyMachine> {
  return flyFetch(
    `/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}`,
  )
}

/**
 * In-place machine update (new golden image). Posts the full config from GET
 * with only `image` changed — mounts/env/guest/services stay intact so
 * `/opt/data` (sessions, memory, skills) survives. Never deletes the app.
 *
 * @see https://fly.io/docs/machines/api/machines-resource/#update-a-machine
 */
export async function updateMachine(args: {
  appName: string
  machineId: string
  config: FlyMachineConfig
  skip_launch?: boolean
}): Promise<FlyMachine> {
  return flyFetch(
    `/apps/${encodeURIComponent(args.appName)}/machines/${encodeURIComponent(args.machineId)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        config: args.config,
        ...(args.skip_launch != null
          ? { skip_launch: args.skip_launch }
          : {}),
      }),
    },
  )
}

/**
 * Roll a machine onto `targetImage` while keeping the data volume.
 * Aborts if `/opt/data` mount is missing or volume id ≠ expected.
 * No-ops when the machine already runs the target image.
 */
export async function rollMachineImage(args: {
  appName: string
  machineId: string
  expectedVolumeId: string
  targetImage: string
  /** When true, do not start a stopped machine after the config write. */
  skip_launch?: boolean
}): Promise<{
  previousImage: string
  nextImage: string
  changed: boolean
  machine: FlyMachine
}> {
  const current = await getMachine(args.appName, args.machineId)
  const config = current.config
  if (!config || typeof config !== 'object') {
    throw new Error('Máquina Fly sem config — não é seguro atualizar')
  }
  const mounts = Array.isArray(config.mounts) ? config.mounts : []
  const dataMount = mounts.find((m) => m.path === '/opt/data')
  if (!dataMount?.volume) {
    throw new Error(
      'Mount /opt/data em falta — abortar update para não perder dados',
    )
  }
  if (dataMount.volume !== args.expectedVolumeId) {
    throw new Error(
      `Volume id diverge (machine=${dataMount.volume}, db=${args.expectedVolumeId}) — abortar`,
    )
  }
  const previousImage = typeof config.image === 'string' ? config.image : ''
  if (previousImage && imagesMatch(previousImage, args.targetImage)) {
    return {
      previousImage,
      nextImage: previousImage,
      changed: false,
      machine: current,
    }
  }
  const nextConfig = withCloudScaleToZero({
    ...config,
    image: args.targetImage,
  }).config
  const machine = await updateMachine({
    appName: args.appName,
    machineId: args.machineId,
    config: nextConfig,
    skip_launch: args.skip_launch,
  })
  return {
    previousImage,
    nextImage: args.targetImage,
    changed: true,
    machine,
  }
}

/**
 * Change CPU and memory in place. Keeps the image, env, and /opt/data mount.
 * Aborts when that mount is missing or the volume id does not match.
 * A stopped machine stays stopped when skip_launch is set.
 */
export async function resizeMachineGuest(args: {
  appName: string
  machineId: string
  expectedVolumeId: string
  guest: { cpu_kind: string; cpus: number; memory_mb: number }
  skip_launch?: boolean
}): Promise<{ changed: boolean; machine: FlyMachine }> {
  const current = await getMachine(args.appName, args.machineId)
  const config = current.config
  if (!config || typeof config !== 'object') {
    throw new Error('Máquina Fly sem config — não é seguro redimensionar')
  }
  const mounts = Array.isArray(config.mounts) ? config.mounts : []
  const dataMount = mounts.find((mount) => mount.path === '/opt/data')
  if (!dataMount?.volume) {
    throw new Error('Mount /opt/data em falta — abortar resize para não perder dados')
  }
  if (dataMount.volume !== args.expectedVolumeId) {
    throw new Error(
      `Volume id diverge (machine=${dataMount.volume}, db=${args.expectedVolumeId}) — abortar`,
    )
  }
  if (!guestNeedsResize(config.guest, args.guest)) {
    return { changed: false, machine: current }
  }
  const machine = await updateMachine({
    appName: args.appName,
    machineId: args.machineId,
    config: withCloudScaleToZero({ ...config, guest: args.guest }).config,
    skip_launch: args.skip_launch,
  })
  return { changed: true, machine }
}

/** Golden image for new agent VMs (deployed to work4you-cloud-runtime). */
export function agentImage(): string {
  return (
    process.env.WORK4YOU_AGENT_IMAGE ||
    // Pinned by fly-cloud-runtime deploy + NAS sync (in-place updates use this).
    'registry.fly.io/work4you-cloud-runtime:deployment-01M1ENGKR7REBYP86HJPWX4KN2'
  )
}

export function agentDashboardPort(): number {
  const n = Number(process.env.WORK4YOU_AGENT_DASHBOARD_PORT || '8080')
  return Number.isFinite(n) && n > 0 ? n : 8080
}
