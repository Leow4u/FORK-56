import { atom } from 'nanostores'

import type {
  DesktopConnectionConfig,
  DesktopConnectionConfigInput,
  DesktopRegistryConnection,
  Work4YouConnection
} from '@/global'

export type ComposerRunTarget = 'cloud' | 'local'

export type ComposerCloudApplySource = {
  cloudOrg?: string
  remoteUrl: string
}

export type ComposerRunTargetIntent =
  | { payload: DesktopConnectionConfigInput; type: 'apply' }
  | { type: 'noop' }
  | { type: 'preparing' }
  | { type: 'settings' }
  | { type: 'upgrade' }

/** Portal snapshot for a Cloud click that does not already have a dashboard URL. */
export type ComposerCloudPortal =
  | { source: ComposerCloudApplySource; status: 'ready' }
  | { status: 'choose-org' }
  | { status: 'preparing' }
  | { status: 'signin' }
  | { status: 'upgrade' }

type ComposerCloudDiscoverAgent = {
  createdAt?: string | null
  dashboardUrl?: string | null
  id?: string
  status?: string | null
}

/** Subset of `desktop.cloud.discover` the composer needs. GET only — never creates. */
export type ComposerCloudDiscoverView =
  | {
      agents?: readonly ComposerCloudDiscoverAgent[]
      entitlement?: { canUseCloud?: boolean } | null
      needsOrgSelection?: false
      org?: { id?: string | null; slug?: string | null } | null
    }
  | { needsOrgSelection: true }

type RegistryRow = Pick<DesktopRegistryConnection, 'id' | 'kind'>

type SavedGateway = Pick<DesktopConnectionConfig, 'cloudOrg' | 'mode' | 'remoteUrl'>

/** Destination kept on the composer while the gateway reconnects. */
export const $heldRunTarget = atom<ComposerRunTarget | null>(null)

/** Last Cloud dashboard the composer (or Settings) already applied this session. */
let rememberedCloud: ComposerCloudApplySource | null = null

export function rememberComposerCloudApply(source: ComposerCloudApplySource | null): ComposerCloudApplySource | null {
  const remoteUrl = source?.remoteUrl.trim() ?? ''

  if (!remoteUrl) {
    return rememberedCloud
  }

  const cloudOrg = source?.cloudOrg?.trim() || undefined

  rememberedCloud = cloudOrg ? { cloudOrg, remoteUrl } : { remoteUrl }

  return rememberedCloud
}

export function readRememberedComposerCloudApply(): ComposerCloudApplySource | null {
  return rememberedCloud
}

/** @internal */
export function _resetComposerRunTargetForTests(): void {
  rememberedCloud = null
  $heldRunTarget.set(null)
}

/** First Local or Cloud row in the existing registry. Remote / SSH are ignored. */
export function pickConnectionByKind(
  connections: readonly RegistryRow[],
  kind: ComposerRunTarget
): RegistryRow | undefined {
  return connections.find(connection => connection.kind === kind)
}

/** Which of the two composer rows is the live backend, if either. */
export function resolveComposerRunTarget(args: {
  activeConnectionId: string | null
  connection: null | Pick<Work4YouConnection, 'mode' | 'remoteKind'>
  connections: readonly RegistryRow[]
}): ComposerRunTarget | null {
  // v1 apply does not always stamp a registry id. Prefer the live descriptor
  // so a Cloud session is not painted (or no-op'd) as Local.
  if (args.connection?.remoteKind === 'cloud') {
    return 'cloud'
  }

  if (args.connection?.mode === 'local') {
    return 'local'
  }

  const active = args.connections.find(connection => connection.id === args.activeConnectionId)

  if (active?.kind === 'cloud' || active?.kind === 'local') {
    return active.kind
  }

  return null
}

/**
 * Last Work4You Cloud dashboard URL the composer can re-apply.
 * Prefers the v1 cloud block, then the live Cloud descriptor, then the
 * in-session remember — Local apply wipes v1 cloud provenance on purpose.
 */
export function lastCloudApplySource(args: {
  connection: null | Pick<Work4YouConnection, 'baseUrl' | 'remoteKind'>
  remembered?: ComposerCloudApplySource | null
  saved?: null | SavedGateway
}): ComposerCloudApplySource | null {
  const savedUrl = args.saved?.mode === 'cloud' ? args.saved.remoteUrl.trim() : ''

  if (savedUrl) {
    const cloudOrg = args.saved?.cloudOrg.trim() || undefined

    return cloudOrg ? { cloudOrg, remoteUrl: savedUrl } : { remoteUrl: savedUrl }
  }

  const liveUrl = args.connection?.remoteKind === 'cloud' ? args.connection.baseUrl.trim() : ''

  if (liveUrl) {
    const cloudOrg = args.saved?.cloudOrg.trim() || undefined

    return cloudOrg ? { cloudOrg, remoteUrl: liveUrl } : { remoteUrl: liveUrl }
  }

  const rememberedUrl = args.remembered?.remoteUrl.trim() ?? ''

  if (rememberedUrl) {
    const cloudOrg = args.remembered?.cloudOrg?.trim() || undefined

    return cloudOrg ? { cloudOrg, remoteUrl: rememberedUrl } : { remoteUrl: rememberedUrl }
  }

  return null
}

export function composerCloudApplyPayload(source: ComposerCloudApplySource): DesktopConnectionConfigInput {
  return {
    mode: 'cloud',
    remoteAuthMode: 'oauth',
    remoteUrl: source.remoteUrl,
    ...(source.cloudOrg ? { cloudOrg: source.cloudOrg } : {})
  }
}

export function isCloudLoginError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'needsCloudLogin' in error)
}

function cloudOrgRef(org: { id?: string | null; slug?: string | null } | null | undefined): string | undefined {
  const slug = org?.slug?.trim() ?? ''

  if (slug) {
    return slug
  }

  const id = org?.id?.trim() ?? ''

  return id || undefined
}

function createdAtRank(createdAt: string | null | undefined): number {
  const parsed = Date.parse(createdAt ?? '')

  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

/**
 * Oldest subscription instance that already has a dashboard address.
 * Self-hosted rows are not the plan VM. A machine parked after a return
 * to Free is not a connect target. A stopped or online URL still applies.
 */
export function composerCloudSourceFromDiscover(view: ComposerCloudDiscoverView): ComposerCloudApplySource | null {
  if (view.needsOrgSelection) {
    return null
  }

  const usable = (view.agents ?? []).filter(agent => {
    const url = agent.dashboardUrl?.trim() ?? ''
    const status = (agent.status ?? '').toLowerCase()

    return url.length > 0 && status !== 'self_hosted' && status !== 'parked'
  })

  if (usable.length === 0) {
    return null
  }

  const oldest = [...usable].sort((a, b) => {
    const byTime = createdAtRank(a.createdAt) - createdAtRank(b.createdAt)

    if (byTime !== 0) {
      return byTime
    }

    return (a.id ?? '').localeCompare(b.id ?? '')
  })[0]

  const remoteUrl = oldest?.dashboardUrl?.trim() ?? ''

  if (!remoteUrl) {
    return null
  }

  const cloudOrg = cloudOrgRef(view.org)

  return cloudOrg ? { cloudOrg, remoteUrl } : { remoteUrl }
}

/**
 * What a Cloud click should do once discovery has answered.
 * Free stays locked even when an older machine still has an address.
 * Paid with no address yet is still being prepared. A dashboard URL on a
 * paid plan applies. Missing entitlement does not invent a plan — sign-in
 * stays on the existing gateway door.
 */
export function composerCloudPortalFromDiscover(view: ComposerCloudDiscoverView): ComposerCloudPortal {
  if (view.needsOrgSelection) {
    return { status: 'choose-org' }
  }

  if (view.entitlement?.canUseCloud === false) {
    return { status: 'upgrade' }
  }

  const source = composerCloudSourceFromDiscover(view)

  if (source) {
    return { source, status: 'ready' }
  }

  if (view.entitlement?.canUseCloud === true) {
    return { status: 'preparing' }
  }

  return { status: 'signin' }
}

export type PaidCloudLoginConnection =
  { source: ComposerCloudApplySource; type: 'apply' } | { type: 'choose-org' } | { type: 'stay' }

/**
 * Account login connects Cloud only for a paid plan that already has one
 * addressable machine. Free stays where it is. Several orgs wait for a
 * choice. A paid machine with no address yet is still being prepared.
 */
export function paidCloudLoginConnection(view: ComposerCloudDiscoverView): PaidCloudLoginConnection {
  if (view.needsOrgSelection) {
    return { type: 'choose-org' }
  }

  if (view.entitlement?.canUseCloud !== true) {
    return { type: 'stay' }
  }

  const source = composerCloudSourceFromDiscover(view)

  if (!source) {
    return { type: 'stay' }
  }

  return { source, type: 'apply' }
}

/** Skip a second apply when this dashboard is already the saved Cloud connection. */
export function paidCloudLoginShouldApply(currentCloudUrl: string, source: ComposerCloudApplySource): boolean {
  const current = currentCloudUrl.trim().replace(/\/+$/, '').toLowerCase()
  const next = source.remoteUrl.trim().replace(/\/+$/, '').toLowerCase()

  return next.length > 0 && current !== next
}

/**
 * Composer Local / Cloud click. Local and a paid Cloud dashboard that already
 * has an address reuse Settings' `applyConnectionConfig` door. Free is locked
 * and does not navigate. A paid machine that is not addressable yet does not
 * navigate. Sign-in and multi-org open Settings → Billing, where the account lives.
 */
export function composerRunTargetIntent(
  target: ComposerRunTarget,
  args: {
    active: ComposerRunTarget | null
    cloud: ComposerCloudApplySource | null
    portal?: ComposerCloudPortal | null
  }
): ComposerRunTargetIntent {
  if (args.active === target) {
    return { type: 'noop' }
  }

  if (target === 'local') {
    return { payload: { mode: 'local' }, type: 'apply' }
  }

  if (args.portal?.status === 'upgrade') {
    return { type: 'upgrade' }
  }

  const discovered = args.portal?.status === 'ready' && args.portal.source.remoteUrl.trim() ? args.portal.source : null
  const known = args.cloud?.remoteUrl.trim() ? args.cloud : discovered

  if (known) {
    return { payload: composerCloudApplyPayload(known), type: 'apply' }
  }

  if (args.portal?.status === 'preparing') {
    return { type: 'preparing' }
  }

  return { type: 'settings' }
}
