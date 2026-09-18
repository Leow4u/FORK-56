import type { DesktopRegistryConnection, Work4YouConnection } from '@/global'

export type ComposerRunTarget = 'cloud' | 'local'

export type ComposerRunTargetIntent =
  | { connectionId: string; type: 'select' }
  | { type: 'noop' }
  | { type: 'settings' }

type RegistryRow = Pick<DesktopRegistryConnection, 'id' | 'kind'>

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
  const active = args.connections.find(connection => connection.id === args.activeConnectionId)

  if (active?.kind === 'cloud' || active?.kind === 'local') {
    return active.kind
  }

  if (args.connection?.remoteKind === 'cloud') {
    return 'cloud'
  }

  if (args.connection?.mode === 'local') {
    return 'local'
  }

  return null
}

/**
 * Composer Local / Cloud click. `select` reuses `selectConnection`. Cloud with
 * no registry row opens Settings → Gateways — the same deep-link the statusbar
 * switcher already uses when a source is missing.
 */
export function composerRunTargetIntent(
  target: ComposerRunTarget,
  connections: readonly RegistryRow[],
  activeConnectionId: string | null
): ComposerRunTargetIntent {
  const match = pickConnectionByKind(connections, target)

  if (!match) {
    return target === 'cloud' ? { type: 'settings' } : { type: 'noop' }
  }

  if (match.id === activeConnectionId) {
    return { type: 'noop' }
  }

  return { connectionId: match.id, type: 'select' }
}
