import { randomBytes } from 'crypto'
import type { AgentInstance, Org, User } from '@prisma/client'
import { prisma } from './db'
import { mintAgentBootstrapSession } from './agent-bootstrap'
import {
  CLOUD_SIZES,
  flyGuestForSize,
  parseCloudSize,
  type CloudSizeId,
} from './cloud-sizes'
import {
  assertFlyApiToken,
  cloudResizeShouldStart,
  cloudSizeForTier,
  cloudStatusForFlyState,
  ensureOrgCloudInstanceWith,
  planDiskGb,
  planFlyBirth,
  recordedCloudSize,
  volumeExtendGb,
  type CloudEnsureResult,
  type CloudInstanceRef,
  type FlyBirthObservation,
} from './cloud-entitlement'
import { drainGatewayBeforeLifecycle } from './agent-gateway-drain'
import {
  fetchAnnotatedModelsForOrg,
  resolveProvisionModel,
} from './inference-catalog'
import { HOUSE_MODEL_ID } from './model-access'
import { SELF_HOSTED_STATUS } from './self-hosted-dashboard'
import {
  agentDashboardPort,
  agentImage,
  allocateSharedIpv4,
  createFlyApp,
  createMachine,
  createVolume,
  extendVolume,
  flyAlreadyExists,
  deleteFlyApp,
  destroyMachine,
  getMachine,
  imageFromMachine,
  imagesMatch,
  listMachines,
  listVolumes,
  resizeMachineGuest,
  rollMachineImage,
  startMachine,
  stopMachine,
  syncMachineScaleToZero,
  waitMachine,
} from './fly-machines'

async function drainAgentGateway(row: AgentInstance): Promise<void> {
  if (!row.dashboardUrl || !row.dashboardDrainSecret) return
  await drainGatewayBeforeLifecycle({
    dashboardUrl: row.dashboardUrl,
    drainSecret: row.dashboardDrainSecret,
    suppressNotification: true,
  })
}

export type AgentDto = {
  id: string
  name: string
  status: string
  dashboardUrl: string | null
  dashboardGatewayState: string
  size: string
  model: string | null
  slug: string
  flyAppName: string | null
  region: string
  maxSessions: number
  memoryMb: number
  cpus: number
  diskGb: number
  priceRunningUsd: string
  priceStoppedUsd: string
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  /** Portal-pinned golden image (new creates + in-place updates). */
  pinnedImage: string
  /** Image currently configured on the Fly machine, if known. */
  runningImage: string | null
  /** True when runningImage differs from pinnedImage — history-safe update available. */
  updateAvailable: boolean
}

function baseAgentDto(row: AgentInstance): Omit<
  AgentDto,
  'pinnedImage' | 'runningImage' | 'updateAvailable'
> {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    dashboardUrl: row.dashboardUrl,
    dashboardGatewayState: row.dashboardGatewayState,
    size: row.size,
    model: row.model,
    slug: row.slug,
    flyAppName: row.flyAppName,
    region: row.flyRegion,
    maxSessions: row.maxSessions,
    memoryMb: row.memoryMb,
    cpus: row.cpus,
    diskGb: row.diskGb,
    priceRunningUsd: row.priceRunningUsd,
    priceStoppedUsd: row.priceStoppedUsd,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Sync DTO without a live Fly image probe (tests / error paths). */
export function toAgentDto(
  row: AgentInstance,
  opts?: { runningImage?: string | null },
): AgentDto {
  const pinnedImage = agentImage()
  const runningImage =
    opts?.runningImage === undefined ? null : opts.runningImage
  const updateAvailable = Boolean(
    runningImage && !imagesMatch(runningImage, pinnedImage),
  )
  return {
    ...baseAgentDto(row),
    pinnedImage,
    runningImage,
    updateAvailable,
  }
}

async function probeRunningImage(row: AgentInstance): Promise<string | null> {
  if (!row.flyAppName) return null
  if (row.flyMachineId) {
    try {
      const img = imageFromMachine(
        await getMachine(row.flyAppName, row.flyMachineId),
      )
      if (img) return img
    } catch (err) {
      console.warn(
        `fly getMachine failed app=${row.flyAppName} machine=${row.flyMachineId}`,
        err,
      )
    }
  }
  try {
    const machines = await listMachines(row.flyAppName)
    const preferred =
      machines.find((m) => m.id === row.flyMachineId) ?? machines[0]
    return preferred ? imageFromMachine(preferred) : null
  } catch (err) {
    console.warn(`fly listMachines failed app=${row.flyAppName}`, err)
    return null
  }
}

/** DTO + live Fly `config.image` so the Portal can show “Atualização disponível”. */
export async function toAgentDtoLive(row: AgentInstance): Promise<AgentDto> {
  return toAgentDto(row, { runningImage: await probeRunningImage(row) })
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  const suffix = randomBytes(3).toString('hex')
  const stem = base || 'agent'
  return `${stem}-${suffix}`
}

function flyAppNameForSlug(slug: string): string {
  // Fly app names: lowercase, digits, hyphens; max ~63.
  return `w4y-agent-${slug}`.slice(0, 63)
}

const FLY_REFRESH_STATUSES = new Set([
  'provisioning',
  'starting',
  'updating',
  'deleting',
])

function agentNeedsFlyRefresh(row: AgentInstance): boolean {
  if (!row.flyAppName || !row.flyMachineId) return false
  if (FLY_REFRESH_STATUSES.has(row.status)) return true
  // waitMachine timeout: Fly may already be started while DB still says starting.
  if (row.status === 'starting' && row.errorMessage) return true
  if (row.status === 'updating' && row.errorMessage) return true
  return false
}

export async function listAgents(orgId: string): Promise<AgentDto[]> {
  const rows = await prisma.agentInstance.findMany({
    where: { orgId, status: { not: SELF_HOSTED_STATUS } },
    orderBy: { createdAt: 'desc' },
  })
  return Promise.all(
    rows.map(async (row) => {
      if (agentNeedsFlyRefresh(row)) {
        return refreshAgentStatus(row)
      }
      return toAgentDtoLive(row)
    }),
  )
}

export async function getAgent(
  orgId: string,
  id: string,
): Promise<AgentInstance | null> {
  return prisma.agentInstance.findFirst({ where: { id, orgId } })
}

function flyHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const status = (error as { status?: number }).status
  return typeof status === 'number' ? status : undefined
}

async function observeFlyBirth(appName: string): Promise<FlyBirthObservation> {
  try {
    const machines = await listMachines(appName)
    let volumeIds: string[] = []
    try {
      const volumes = await listVolumes(appName)
      volumeIds = volumes.map((volume) => volume.id).filter((id) => id.trim())
    } catch (error) {
      if (flyHttpStatus(error) !== 404) throw error
    }
    return {
      appMissing: false,
      machineIds: machines.map((machine) => machine.id).filter((id) => id.trim()),
      volumeIds,
    }
  } catch (error) {
    if (flyHttpStatus(error) === 404) {
      return { appMissing: true, machineIds: [], volumeIds: [] }
    }
    throw error
  }
}

async function ensureDataVolume(args: {
  appName: string
  name: string
  region: string
  sizeGb: number
  volumeId: string | null
}): Promise<string> {
  if (args.volumeId) return args.volumeId
  try {
    const created = await createVolume({
      appName: args.appName,
      name: args.name,
      region: args.region,
      sizeGb: args.sizeGb,
    })
    return created.id
  } catch (error) {
    if (!flyAlreadyExists(error)) throw error
    const volumes = await listVolumes(args.appName)
    const found =
      volumes.find((volume) => volume.name === args.name) ?? volumes[0]
    if (!found?.id) throw error
    return found.id
  }
}

async function markMachineOnline(
  id: string,
  flyAppName: string,
  machineId: string,
): Promise<AgentDto> {
  await prisma.agentInstance.update({
    where: { id },
    data: {
      flyAppName,
      flyMachineId: machineId,
      status: 'starting',
      dashboardGatewayState: 'unknown',
    },
  })

  try {
    const machine = await getMachine(flyAppName, machineId)
    const state = (machine.state ?? '').toLowerCase()
    if (state === 'stopped' || state === 'suspended' || state === 'created') {
      await startMachine(flyAppName, machineId)
    }
    await waitMachine(flyAppName, machineId, 'started', 60)
    const updated = await prisma.agentInstance.update({
      where: { id },
      data: {
        status: 'online',
        dashboardGatewayState: 'active',
        startedAt: new Date(),
        errorMessage: null,
      },
    })
    return toAgentDto(updated)
  } catch (waitErr) {
    if (flyHttpStatus(waitErr) === 404) {
      await prisma.agentInstance.update({
        where: { id },
        data: { flyMachineId: null },
      })
      throw waitErr
    }
    // Machine exists but is not healthy yet — leave it for the UI poll.
    const updated = await prisma.agentInstance.update({
      where: { id },
      data: {
        status: 'starting',
        dashboardGatewayState: 'unknown',
        errorMessage:
          waitErr instanceof Error
            ? waitErr.message.slice(0, 400)
            : 'Aguardando máquina',
      },
    })
    return toAgentDto(updated)
  }
}

/**
 * Finish the Fly app/machine for a row that already occupies the org slot.
 * Adopts an existing machine or volume. Does not insert another row.
 */
function sizeRecord(size: CloudSizeId, diskGb: number) {
  const spec = CLOUD_SIZES[size]
  return {
    size,
    cpus: spec.cpus,
    memoryMb: spec.memoryMb,
    diskGb,
    maxSessions: spec.maxSessions,
    priceRunningUsd: spec.priceRunningUsd,
    priceStoppedUsd: spec.priceStoppedUsd,
  }
}

async function growVolumeIfNeeded(
  appName: string,
  volumeId: string,
  targetGb: number,
): Promise<number> {
  let current = 0
  try {
    const volumes = await listVolumes(appName)
    const found = volumes.find((volume) => volume.id === volumeId)
    if (found && Number.isFinite(found.size_gb)) current = found.size_gb
  } catch (error) {
    if (flyHttpStatus(error) !== 404) throw error
  }
  const next = volumeExtendGb(current, targetGb)
  if (next != null) {
    await extendVolume({ appName, volumeId, sizeGb: next })
    return next
  }
  return planDiskGb(current, targetGb)
}

async function provisionClaimedInstance(
  row: AgentInstance,
  org: Org,
  user: Pick<User, 'id' | 'privyDid'>,
  planSize?: CloudSizeId | null,
): Promise<AgentDto> {
  const size = planSize ?? parseCloudSize(row.size)
  const spec = CLOUD_SIZES[size]
  const flyAppName = row.flyAppName || flyAppNameForSlug(row.slug)
  const region = row.flyRegion || process.env.FLY_REGION || 'gru'
  const port = agentDashboardPort()
  const portalUrl =
    process.env.PORTAL_PUBLIC_URL ||
    process.env.OAUTH_ISSUER ||
    'https://portal.work4you.ai'
  const dashboardUrl = row.dashboardUrl || `https://${flyAppName}.fly.dev`

  const plan = planFlyBirth(await observeFlyBirth(flyAppName), row.flyVolumeId)
  if (plan.action === 'adopt') {
    if (!row.dashboardUrl) {
      await prisma.agentInstance.update({
        where: { id: row.id },
        data: { dashboardUrl, flyAppName },
      })
    }
    const adopted = await markMachineOnline(row.id, flyAppName, plan.machineId)
    if (planSize && recordedCloudSize(row.size) !== planSize) {
      const fresh = await getAgent(row.orgId, row.id)
      if (fresh?.flyMachineId) return resizeOrgCloudInstance(fresh, planSize)
    }
    return adopted
  }

  if (plan.createApp) {
    try {
      await createFlyApp(flyAppName)
    } catch (error) {
      if (!flyAlreadyExists(error)) throw error
    }
  }
  await allocateSharedIpv4(flyAppName)

  const volumeId = await ensureDataVolume({
    appName: flyAppName,
    name: `data_${row.slug.replace(/-/g, '_')}`.slice(0, 30),
    region,
    sizeGb: spec.diskGb,
    volumeId: plan.volumeId,
  })
  const diskGb = await growVolumeIfNeeded(flyAppName, volumeId, spec.diskGb)

  const drainSecret = randomBytes(24).toString('base64url')
  const oauthClientId = `agent:${row.id}`
  const bootstrap = await mintAgentBootstrapSession({
    org,
    user,
    agent: row,
  })
  const model = row.model?.trim() || ''
  const env: Record<string, string> = {
    WORK4YOU_HOME: '/opt/data',
    PORT: String(port),
    WORK4YOU_DASHBOARD_HOST: '0.0.0.0',
    WORK4YOU_DASHBOARD_PORT: String(port),
    WORK4YOU_DASHBOARD_PUBLIC_URL: dashboardUrl,
    WORK4YOU_DASHBOARD_PORTAL_URL: portalUrl,
    WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID: oauthClientId,
    WORK4YOU_DASHBOARD_DRAIN_SECRET: drainSecret,
    WORK4YOU_AUTH_JSON_BOOTSTRAP: JSON.stringify(bootstrap.authJson),
    WORK4YOU_GATEWAY_BOOTSTRAP_STATE: 'running',
    WORK4YOU_CLOUD_INSTANCE_ID: row.id,
    WORK4YOU_CLOUD_ORG_ID: org.id,
    WORK4YOU_PORTAL_BASE_URL: portalUrl,
    PORTAL_URL: portalUrl,
  }
  if (model) env.WORK4YOU_DEFAULT_MODEL = model

  await prisma.agentInstance.update({
    where: { id: row.id },
    data: {
      status: 'starting',
      flyAppName,
      flyVolumeId: volumeId,
      dashboardUrl,
      bootstrapSessionId: bootstrap.sessionId,
      dashboardDrainSecret: drainSecret,
    },
  })

  const machine = await createMachine({
    appName: flyAppName,
    region,
    image: agentImage(),
    name: `agent-${row.slug}`.slice(0, 30),
    guest: flyGuestForSize(size),
    env,
    volumeId,
    internalPort: port,
  })
  const started = await markMachineOnline(row.id, flyAppName, machine.id)
  if (!planSize || recordedCloudSize(row.size) === planSize) return started
  const updated = await prisma.agentInstance.update({
    where: { id: row.id },
    data: sizeRecord(planSize, diskGb || planDiskGb(row.diskGb, spec.diskGb)),
  })
  return toAgentDto(updated)
}

/**
 * Move the existing Fly machine to the plan size. Same app, same volume.
 * Disk grows when the plan is larger and stays when the plan is smaller.
 * A stopped machine stays stopped.
 */
export async function resizeOrgCloudInstance(
  row: AgentInstance,
  target: CloudSizeId,
): Promise<AgentDto> {
  assertFlyApiToken(process.env.FLY_API_TOKEN)
  if (!row.flyAppName || !row.flyMachineId) {
    return markProvisionError(row.id, new Error('Instância sem máquina Fly'))
  }
  const appName = row.flyAppName
  const machineId = row.flyMachineId

  let working = row
  if (!working.flyVolumeId) {
    const mounted = await getMachine(appName, machineId)
    const mount = mounted.config?.mounts?.find((item) => item.path === '/opt/data')
    if (mount?.volume) {
      working = await prisma.agentInstance.update({
        where: { id: row.id },
        data: { flyVolumeId: mount.volume },
      })
    }
  }
  const volumeId = working.flyVolumeId
  if (!volumeId) {
    return markProvisionError(
      row.id,
      new Error('Volume em falta — não é seguro redimensionar sem /opt/data'),
    )
  }

  const claimed = await prisma.agentInstance.updateMany({
    where: {
      id: row.id,
      orgId: row.orgId,
      size: row.size,
      status: row.status,
    },
    data: {
      status: 'updating',
      errorMessage: null,
      updatedAt: new Date(),
    },
  })
  if (claimed.count !== 1) {
    const current = await getAgent(row.orgId, row.id)
    if (!current) throw new Error('cloud_instance_missing')
    return toAgentDto(current)
  }

  const spec = CLOUD_SIZES[target]
  try {
    const diskGb = await growVolumeIfNeeded(appName, volumeId, spec.diskGb)
    const machine = await getMachine(appName, machineId)
    const state = (machine.state ?? '').toLowerCase()
    const flyRunning = state === 'started' || state === 'starting'
    if (flyRunning) await drainAgentGateway(working)
    const bringBack = cloudResizeShouldStart({
      flyRunning,
      status: row.status,
    })
    await resizeMachineGuest({
      appName,
      machineId,
      expectedVolumeId: volumeId,
      guest: flyGuestForSize(target),
      skip_launch: !bringBack,
    })
    if (bringBack) {
      try {
        await waitMachine(appName, machineId, 'started', 60)
      } catch {
        // The next list refresh reconciles Fly if the wait times out.
      }
    }
    const updated = await prisma.agentInstance.update({
      where: { id: row.id },
      data: {
        ...sizeRecord(target, diskGb || planDiskGb(row.diskGb, spec.diskGb)),
        status: bringBack ? 'online' : 'stopped',
        dashboardGatewayState: bringBack ? 'active' : 'down',
        errorMessage: null,
      },
    })
    return toAgentDto(updated)
  } catch (error) {
    return markProvisionError(row.id, error)
  }
}

async function markProvisionError(id: string, error: unknown): Promise<AgentDto> {
  const msg = error instanceof Error ? error.message.slice(0, 500) : 'provision failed'
  const updated = await prisma.agentInstance.update({
    where: { id },
    data: {
      status: 'error',
      dashboardGatewayState: 'down',
      errorMessage: msg,
    },
  })
  return toAgentDto(updated)
}

/**
 * Claim the unfinished row, then create or adopt its Fly machine.
 * A lost claim returns the row as it is now — another request owns it.
 * First create does not use this claim; it already owns the row it inserted.
 */
export async function finishUnbornCloudInstance(
  row: AgentInstance,
  org: Org,
  user: Pick<User, 'id' | 'privyDid'>,
  planSize?: CloudSizeId | null,
): Promise<AgentDto> {
  assertFlyApiToken(process.env.FLY_API_TOKEN)

  const claimed = await prisma.agentInstance.updateMany({
    where: {
      id: row.id,
      orgId: row.orgId,
      flyMachineId: null,
      updatedAt: row.updatedAt,
      status: { in: ['provisioning', 'error', 'starting'] },
    },
    data: {
      status: 'provisioning',
      errorMessage: null,
      updatedAt: new Date(),
    },
  })
  if (claimed.count !== 1) {
    const current = await getAgent(row.orgId, row.id)
    if (!current) throw new Error('cloud_instance_missing')
    return toAgentDto(current)
  }

  const claimedRow = await getAgent(row.orgId, row.id)
  if (!claimedRow) throw new Error('cloud_instance_missing')

  try {
    return await provisionClaimedInstance(claimedRow, org, user, planSize)
  } catch (error) {
    return markProvisionError(row.id, error)
  }
}

/**
 * Create DB row + provision Fly app/machine. Returns with
 * status=provisioning|starting|online|error. Fly work is awaited in-request.
 */
export async function createAndProvisionAgent(args: {
  org: Org
  user: Pick<User, 'id' | 'privyDid'>
  name: string
  size?: unknown
  model?: string | null
}): Promise<AgentDto> {
  const size = parseCloudSize(args.size)
  const spec = CLOUD_SIZES[size]
  const name = args.name.trim().slice(0, 64) || 'Agent'
  const slug = slugify(name)
  const flyAppName = flyAppNameForSlug(slug)
  const region = process.env.FLY_REGION || 'gru'

  const row = await prisma.agentInstance.create({
    data: {
      orgId: args.org.id,
      name,
      slug,
      size,
      model: args.model?.trim() || null,
      status: 'provisioning',
      flyAppName,
      flyRegion: region,
      cpus: spec.cpus,
      memoryMb: spec.memoryMb,
      diskGb: spec.diskGb,
      maxSessions: spec.maxSessions,
      priceRunningUsd: spec.priceRunningUsd,
      priceStoppedUsd: spec.priceStoppedUsd,
      dashboardGatewayState: 'unknown',
    },
  })

  try {
    return await provisionClaimedInstance(row, args.org, args.user)
  } catch (error) {
    return markProvisionError(row.id, error)
  }
}

async function listOrgCloudRefs(orgId: string): Promise<CloudInstanceRef[]> {
  return prisma.agentInstance.findMany({
    where: { orgId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      status: true,
      flyMachineId: true,
      updatedAt: true,
      size: true,
    },
  })
}

async function resolveEnsuredModel(args: {
  org: Org
  user: Pick<User, 'id' | 'privyDid'>
  model?: string | null
}): Promise<string> {
  const catalog = await fetchAnnotatedModelsForOrg({
    org: args.org,
    user: args.user,
  })
  if (!('error' in catalog)) {
    return resolveProvisionModel(catalog, args.model)
  }
  const explicit = args.model?.trim()
  return explicit || HOUSE_MODEL_ID
}

function flyErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error && 'status' in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}

async function flyMachineState(
  appName: string,
  machineId: string,
): Promise<string | 'missing'> {
  try {
    const machine = await getMachine(appName, machineId)
    return (machine.state ?? '').toLowerCase()
  } catch (error) {
    if (flyErrorStatus(error) === 404) return 'missing'
    throw error
  }
}

/**
 * Stop the Fly machine and keep the row, app, and volume.
 * A missing machine still parks the row. A hard failure leaves status
 * `error` with the machine id so the next Free ensure tries again.
 */
export async function parkOrgCloudInstance(row: AgentInstance): Promise<AgentDto> {
  assertFlyApiToken(process.env.FLY_API_TOKEN)
  if ((row.status ?? '').toLowerCase() === 'parked') return toAgentDto(row)
  if (!row.flyAppName || !row.flyMachineId) {
    return markProvisionError(row.id, new Error('Instância sem máquina Fly'))
  }
  const appName = row.flyAppName
  const machineId = row.flyMachineId
  try {
    const state = await flyMachineState(appName, machineId)
    const running = state === 'started' || state === 'starting'
    if (running) await drainAgentGateway(row)
    if (state !== 'missing' && state !== 'stopped') {
      await stopMachine(appName, machineId)
    }
    const updated = await prisma.agentInstance.update({
      where: { id: row.id },
      data: {
        status: 'parked',
        stoppedAt: new Date(),
        dashboardGatewayState: 'down',
        errorMessage: null,
      },
    })
    return toAgentDto(updated)
  } catch (error) {
    return markProvisionError(row.id, error)
  }
}

async function restoreParked(
  row: AgentInstance,
  errorMessage: string,
): Promise<AgentDto> {
  const updated = await prisma.agentInstance.update({
    where: { id: row.id },
    data: {
      status: 'parked',
      stoppedAt: new Date(),
      dashboardGatewayState: 'down',
      errorMessage: errorMessage.slice(0, 500),
    },
  })
  return toAgentDto(updated)
}

/**
 * Start a machine parked on Free. A failed wake stays `parked` so the
 * next paid ensure retries. A user stop is not this path.
 */
export async function wakeParkedCloudInstance(
  row: AgentInstance,
): Promise<AgentDto> {
  if ((row.status ?? '').toLowerCase() !== 'parked') return toAgentDto(row)
  if (!row.flyAppName || !row.flyMachineId) {
    return markProvisionError(row.id, new Error('Instância sem máquina Fly'))
  }
  const appName = row.flyAppName
  const machineId = row.flyMachineId
  try {
    const started = await startAgent(row)
    if (started.status === 'online') return started
    const state = await flyMachineState(appName, machineId)
    if (state === 'started' || state === 'starting') return started
    return restoreParked(
      row,
      started.errorMessage || 'A instância ainda não ficou online.',
    )
  } catch (error) {
    try {
      const state = await flyMachineState(appName, machineId)
      if (state === 'started' || state === 'starting') {
        const current = await getAgent(row.orgId, row.id)
        return toAgentDto(current ?? row)
      }
    } catch {
      // Keep the parked row so the next paid ensure can retry.
    }
    const msg = error instanceof Error ? error.message : 'wake failed'
    return restoreParked(row, msg)
  }
}

/**
 * Create the org's single Cloud VM, resume one whose Fly machine never
 * landed, resize one whose size no longer matches the paid plan, park one
 * when the org returns to Free, or wake a parked machine on the next paid
 * plan. Free with no VM refuses. POST /api/agents must not call this.
 */
export async function ensureOrgCloudInstance(args: {
  org: Org
  user: Pick<User, 'id' | 'privyDid'>
  name?: string | null
  model?: string | null
}): Promise<
  | { ok: false; error: 'paid_plan_required' }
  | { ok: true; created: boolean; agent: AgentDto }
> {
  let resumedAgent: AgentDto | null = null
  let resizedAgent: AgentDto | null = null
  let parkedAgent: AgentDto | null = null
  let wokenAgent: AgentDto | null = null
  const result: CloudEnsureResult<CloudInstanceRef> = await ensureOrgCloudInstanceWith({
    tierId: args.org.subscriptionTierId,
    name: args.name,
    list: () => listOrgCloudRefs(args.org.id),
    create: async ({ size, name }) => {
      // Missing token must not insert an error row that occupies the slot.
      assertFlyApiToken(process.env.FLY_API_TOKEN)
      const model = await resolveEnsuredModel(args)
      const agent = await createAndProvisionAgent({
        org: args.org,
        user: args.user,
        name,
        size,
        model,
      })
      return {
        id: agent.id,
        createdAt: agent.createdAt,
        status: agent.status,
      }
    },
    resume: async (instance) => {
      const row = await getAgent(args.org.id, instance.id)
      if (!row) throw new Error('cloud_instance_missing')
      const agent = await finishUnbornCloudInstance(
        row,
        args.org,
        args.user,
        cloudSizeForTier(args.org.subscriptionTierId),
      )
      resumedAgent = agent
      return {
        id: agent.id,
        createdAt: row.createdAt,
        status: agent.status,
        flyMachineId: row.flyMachineId,
        updatedAt: row.updatedAt,
        size: row.size,
      }
    },
    resize: async (instance, size) => {
      const row = await getAgent(args.org.id, instance.id)
      if (!row) throw new Error('cloud_instance_missing')
      const agent = await resizeOrgCloudInstance(row, size)
      resizedAgent = agent
      return {
        id: agent.id,
        createdAt: row.createdAt,
        status: agent.status,
        flyMachineId: row.flyMachineId,
        updatedAt: row.updatedAt,
        size,
      }
    },
    park: async (instance) => {
      const row = await getAgent(args.org.id, instance.id)
      if (!row) throw new Error('cloud_instance_missing')
      const agent = await parkOrgCloudInstance(row)
      parkedAgent = agent
      return {
        id: agent.id,
        createdAt: row.createdAt,
        status: agent.status,
        flyMachineId: row.flyMachineId,
        updatedAt: row.updatedAt,
        size: row.size,
      }
    },
    wake: async (instance) => {
      const row = await getAgent(args.org.id, instance.id)
      if (!row) throw new Error('cloud_instance_missing')
      const agent = await wakeParkedCloudInstance(row)
      wokenAgent = agent
      return {
        id: agent.id,
        createdAt: row.createdAt,
        status: agent.status,
        flyMachineId: row.flyMachineId,
        updatedAt: row.updatedAt,
        size: row.size,
      }
    },
  })

  if (!result.ok) return result

  const stamp = async (agent: AgentDto): Promise<AgentDto> => {
    const row = await getAgent(args.org.id, agent.id)
    if (row) await syncCloudScaleToZero(row)
    return agent
  }

  if (resizedAgent) {
    return { ok: true, created: false, agent: await stamp(resizedAgent) }
  }

  if (resumedAgent) {
    return { ok: true, created: false, agent: await stamp(resumedAgent) }
  }

  if (parkedAgent) {
    return { ok: true, created: false, agent: await stamp(parkedAgent) }
  }

  if (wokenAgent) {
    return { ok: true, created: false, agent: await stamp(wokenAgent) }
  }

  if (result.created) {
    const row = await getAgent(args.org.id, result.instance.id)
    if (!row) throw new Error('cloud_instance_missing')
    return { ok: true, created: true, agent: await stamp(toAgentDto(row)) }
  }

  const row = await getAgent(args.org.id, result.instance.id)
  if (!row) throw new Error('cloud_instance_missing')
  await syncCloudScaleToZero(row)
  return { ok: true, created: false, agent: toAgentDto(row) }
}

export async function stopAgent(row: AgentInstance): Promise<AgentDto> {
  if (!row.flyAppName || !row.flyMachineId) {
    const updated = await prisma.agentInstance.update({
      where: { id: row.id },
      data: { status: 'stopped', stoppedAt: new Date(), dashboardGatewayState: 'down' },
    })
    return toAgentDto(updated)
  }
  await drainAgentGateway(row)
  await stopMachine(row.flyAppName, row.flyMachineId)
  const updated = await prisma.agentInstance.update({
    where: { id: row.id },
    data: {
      status: 'stopped',
      stoppedAt: new Date(),
      dashboardGatewayState: 'down',
    },
  })
  return toAgentDtoLive(updated)
}

async function syncCloudScaleToZero(row: AgentInstance): Promise<void> {
  if (!row.flyAppName || !row.flyMachineId || !row.dashboardUrl) return
  try {
    await syncMachineScaleToZero({
      appName: row.flyAppName,
      machineId: row.flyMachineId,
    })
  } catch (error) {
    console.warn(
      `scale-to-zero sync failed app=${row.flyAppName} machine=${row.flyMachineId}`,
      error,
    )
  }
}

/**
 * Start the Fly machine. If the machine still runs an older golden image,
 * roll the image in-place first (same volume / history) — Cursor/Claude-style
 * silent upgrade on wake, without delete+recreate.
 */
export async function startAgent(row: AgentInstance): Promise<AgentDto> {
  if (!row.flyAppName || !row.flyMachineId) {
    throw new Error('Instância sem máquina Fly')
  }
  await prisma.agentInstance.update({
    where: { id: row.id },
    data: { status: 'starting', dashboardGatewayState: 'unknown' },
  })
  await syncCloudScaleToZero(row)

  const target = agentImage()
  const machine = await getMachine(row.flyAppName, row.flyMachineId)
  const currentImage = imageFromMachine(machine) || ''
  const needsImageRoll =
    !currentImage || !imagesMatch(currentImage, target)

  if (needsImageRoll) {
    if (!row.flyVolumeId) {
      throw new Error(
        'Volume em falta — não é seguro atualizar a image sem /opt/data',
      )
    }
    await prisma.agentInstance.update({
      where: { id: row.id },
      data: { status: 'updating', dashboardGatewayState: 'unknown' },
    })
    // Machine is stopped on the start path; skip_launch=false boots with new image.
    await rollMachineImage({
      appName: row.flyAppName,
      machineId: row.flyMachineId,
      expectedVolumeId: row.flyVolumeId,
      targetImage: target,
      skip_launch: false,
    })
  } else {
    await startMachine(row.flyAppName, row.flyMachineId)
  }

  try {
    await waitMachine(row.flyAppName, row.flyMachineId, 'started', 60)
  } catch {
    // list/detail refresh reconciles Fly state when wait times out.
  }
  return refreshAgentStatus(
    (await prisma.agentInstance.findUnique({ where: { id: row.id } })) ?? row,
  )
}

/**
 * In-place golden-image update. Preserves the Fly app + volume (`/opt/data`):
 * sessions, memory, skills, and config survive. Never calls deleteFlyApp.
 *
 * Online → drain → roll image → wait started.
 * Stopped → roll image with skip_launch (stays stopped, ready on next Iniciar).
 */
export async function updateAgentImage(row: AgentInstance): Promise<AgentDto> {
  if (!row.flyAppName || !row.flyMachineId) {
    throw new Error('Instância sem máquina Fly')
  }
  if (!row.flyVolumeId) {
    throw new Error(
      'Volume em falta — não é seguro atualizar sem preservar /opt/data',
    )
  }

  const target = agentImage()
  const machine = await getMachine(row.flyAppName, row.flyMachineId)
  const state = (machine.state || '').toLowerCase()
  const currentImage = imageFromMachine(machine) || ''
  if (currentImage && imagesMatch(currentImage, target)) {
    // Already on pin — nothing to do (history untouched).
    return toAgentDto(row, { runningImage: currentImage })
  }

  const wasOnline = state === 'started' || row.status === 'online'
  await prisma.agentInstance.update({
    where: { id: row.id },
    data: {
      status: 'updating',
      dashboardGatewayState: wasOnline ? 'unknown' : row.dashboardGatewayState,
      errorMessage: null,
    },
  })

  try {
    if (wasOnline) {
      await drainAgentGateway(row)
    }
    const rolled = await rollMachineImage({
      appName: row.flyAppName,
      machineId: row.flyMachineId,
      expectedVolumeId: row.flyVolumeId,
      targetImage: target,
      skip_launch: !wasOnline,
    })
    if (!rolled.changed) {
      const updated = await prisma.agentInstance.update({
        where: { id: row.id },
        data: {
          status: wasOnline ? 'online' : 'stopped',
          dashboardGatewayState: wasOnline ? 'active' : 'down',
        },
      })
      return toAgentDto(updated, { runningImage: rolled.nextImage })
    }
    if (wasOnline) {
      try {
        await waitMachine(row.flyAppName, row.flyMachineId, 'started', 60)
      } catch {
        // refresh reconciles
      }
      return refreshAgentStatus(
        (await prisma.agentInstance.findUnique({ where: { id: row.id } })) ??
          row,
      )
    }
    const updated = await prisma.agentInstance.update({
      where: { id: row.id },
      data: { status: 'stopped', dashboardGatewayState: 'down' },
    })
    return toAgentDto(updated, { runningImage: rolled.nextImage })
  } catch (e) {
    const msg =
      e instanceof Error ? e.message.slice(0, 500) : 'update image failed'
    const updated = await prisma.agentInstance.update({
      where: { id: row.id },
      data: {
        status: 'error',
        dashboardGatewayState: 'down',
        errorMessage: msg,
      },
    })
    return toAgentDto(updated, { runningImage: currentImage || null })
  }
}

export async function deleteAgent(row: AgentInstance): Promise<void> {
  await prisma.agentInstance.update({
    where: { id: row.id },
    data: { status: 'deleting' },
  })
  try {
    if (row.flyAppName && row.flyMachineId) {
      await drainAgentGateway(row)
      await destroyMachine(row.flyAppName, row.flyMachineId)
    }
    if (row.flyAppName) {
      await deleteFlyApp(row.flyAppName)
    }
  } finally {
    await prisma.agentInstance.delete({ where: { id: row.id } })
  }
}

export async function refreshAgentStatus(
  row: AgentInstance,
): Promise<AgentDto> {
  if (!row.flyAppName || !row.flyMachineId) {
    return toAgentDto(row)
  }
  try {
    const m = await getMachine(row.flyAppName, row.flyMachineId)
    const state = (m.state || '').toLowerCase()
    const runningImage = imageFromMachine(m)
    let status = row.status
    let gateway = row.dashboardGatewayState
    const mapped = cloudStatusForFlyState(row.status, state)
    if (mapped) {
      status = mapped.status
      gateway = mapped.gateway
    }
    const patch: {
      status: string
      dashboardGatewayState: string
      errorMessage: null
      startedAt?: Date
      stoppedAt?: Date | null
    } = { status, dashboardGatewayState: gateway, errorMessage: null }
    if (status === 'online' && !row.startedAt) {
      patch.startedAt = new Date()
      patch.stoppedAt = null
    }
    const updated = await prisma.agentInstance.update({
      where: { id: row.id },
      data: patch,
    })
    return toAgentDto(updated, { runningImage })
  } catch {
    return toAgentDto(row, { runningImage: await probeRunningImage(row) })
  }
}

export function cloudSizeCatalog() {
  return (Object.keys(CLOUD_SIZES) as CloudSizeId[]).map((id) => ({
    ...CLOUD_SIZES[id],
  }))
}
