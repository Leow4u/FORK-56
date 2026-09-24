import { atom } from 'nanostores'

import type { SessionInfo } from '@/work4you'

/** Last plan answer. `false` hides Cloud rows. `null` has not been read yet. */
export const $sidebarCanUseCloud = atom<boolean | null>(null)

export function noteSidebarCloudEntitlement(canUseCloud: boolean | undefined): void {
  if (typeof canUseCloud === 'boolean') {
    $sidebarCanUseCloud.set(canUseCloud)
  }
}

/** Composer Cloud is one gateway mode, so the registry id stays the device id. */
export const CLOUD_LIST_HOME = 'cloud'

/**
 * Sidebar identity for the backend that just answered. Cloud keeps a stable
 * id even when the registry still has only the app-managed runtime.
 */
export function sessionListHomeId(
  connection: { connectionId?: string | null; mode?: string | null; remoteKind?: string | null } | null | undefined
): string {
  if (connection?.mode === 'remote' && connection.remoteKind === 'cloud') {
    return CLOUD_LIST_HOME
  }

  const id = connection?.connectionId?.trim()

  return id || 'local'
}

export function sessionOnCloudHome(
  connectionId: string | null | undefined,
  connections?: Array<{ id: string; kind?: string }>
): boolean {
  if (!connectionId) {
    return false
  }

  if (connectionId === CLOUD_LIST_HOME) {
    return true
  }

  return (connections ?? []).some(row => row.id === connectionId && row.kind === 'cloud')
}

/** The connection that produced the current sidebar page, for rows that arrived untagged. */
export const $sessionListHomeId = atom<string | null>(null)

export function tagSessionHome<T extends { connection_id?: string }>(session: T, homeId: string | null): T {
  if (session.connection_id || !homeId) {
    return session
  }

  return { ...session, connection_id: homeId }
}

export function tagSessionHomes<T extends { connection_id?: string }>(sessions: T[], homeId: string | null): T[] {
  if (!homeId) {
    return sessions
  }

  return sessions.map(session => tagSessionHome(session, homeId))
}

function recency(session: SessionInfo): number {
  return Math.max(session.last_active || 0, session.started_at || 0)
}

/** Keep chats that belong to a connection the incoming page did not refresh. */
export function retainForeignSessionHomes(previous: SessionInfo[], merged: SessionInfo[]): SessionInfo[] {
  const homes = new Set(merged.map(session => session.connection_id).filter((id): id is string => Boolean(id)))

  if (homes.size === 0) {
    return merged
  }

  const seen = new Set(merged.map(session => session.id))

  const foreign = previous.filter(
    session => session.connection_id && !homes.has(session.connection_id) && !seen.has(session.id)
  )

  if (!foreign.length) {
    return merged
  }

  return [...foreign, ...merged].sort((a, b) => recency(b) - recency(a))
}

export function cloudConnectionIds(connections: Array<{ id: string; kind?: string }> | undefined): Set<string> {
  const ids = new Set(
    (connections ?? []).filter(connection => connection.kind === 'cloud').map(connection => connection.id)
  )

  ids.add(CLOUD_LIST_HOME)

  return ids
}

/** Free keeps the device list. A missing entitlement does not hide rows. */
export function sidebarShowsSession(
  session: { connection_id?: string },
  cloudIds: Set<string>,
  canUseCloud: boolean | null
): boolean {
  if (canUseCloud !== false || !session.connection_id || !cloudIds.has(session.connection_id)) {
    return true
  }

  return false
}
