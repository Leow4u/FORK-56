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
  { payload: DesktopConnectionConfigInput; type: 'apply' } | { type: 'noop' } | { type: 'settings' }

type RegistryRow = Pick<DesktopRegistryConnection, 'id' | 'kind'>

type SavedGateway = Pick<DesktopConnectionConfig, 'cloudOrg' | 'mode' | 'remoteUrl'>

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

/**
 * Composer Local / Cloud click. Local and a previously connected Cloud reuse
 * Settings' `applyConnectionConfig` door. Cloud with no dashboard URL opens
 * Settings → Gateways — first-time connect still lives there.
 */
export function composerRunTargetIntent(
  target: ComposerRunTarget,
  args: {
    active: ComposerRunTarget | null
    cloud: ComposerCloudApplySource | null
  }
): ComposerRunTargetIntent {
  if (args.active === target) {
    return { type: 'noop' }
  }

  if (target === 'local') {
    return { payload: { mode: 'local' }, type: 'apply' }
  }

  if (!args.cloud?.remoteUrl.trim()) {
    return { type: 'settings' }
  }

  return { payload: composerCloudApplyPayload(args.cloud), type: 'apply' }
}
