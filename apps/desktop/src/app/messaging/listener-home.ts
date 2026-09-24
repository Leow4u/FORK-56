import { atom } from 'nanostores'

import type { SessionInfo } from '@/work4you'

export interface MessagingListenerConnection {
  id: string
  kind: string
}

export interface MessagingListenerPlan {
  device: boolean
  listenId: string
  releaseIds: string[]
}

/** Paid listens on the org VM. Free listens on this computer. Unknown entitlement does nothing. */
export function messagingListenerPlan(
  canUseCloud: boolean | null,
  connections: MessagingListenerConnection[]
): MessagingListenerPlan | null {
  if (canUseCloud == null) {
    return null
  }

  const cloud = connections.filter(row => row.kind === 'cloud')
  const local = connections.find(row => row.kind === 'local')

  if (canUseCloud) {
    const listen = cloud[0]

    if (!listen) {
      return null
    }

    return {
      device: false,
      listenId: listen.id,
      releaseIds: local && local.id !== listen.id ? [local.id] : []
    }
  }

  return {
    device: true,
    listenId: local?.id ?? 'local',
    releaseIds: cloud.map(row => row.id).filter(id => id !== (local?.id ?? 'local'))
  }
}

export function tagMessagingHomes(rows: SessionInfo[], homeId: string | null): SessionInfo[] {
  if (!homeId) {
    return rows
  }

  return rows.map(row => (row.connection_id ? row : { ...row, connection_id: homeId }))
}

/** Keep threads whose home is not in the page that just loaded. */
export function retainForeignMessaging(previous: SessionInfo[], incoming: SessionInfo[]): SessionInfo[] {
  const homes = new Set(incoming.map(row => row.connection_id).filter((id): id is string => Boolean(id)))
  const seen = new Set(incoming.map(row => row.id))
  const foreign = previous.filter(row => row.connection_id && !homes.has(row.connection_id) && !seen.has(row.id))

  return [...incoming, ...foreign].sort((a, b) => (b.last_active || 0) - (a.last_active || 0))
}

export function sessionOnCloud(connectionId: string | undefined, connections: MessagingListenerConnection[]): boolean {
  if (!connectionId) {
    return false
  }

  return connections.some(row => row.kind === 'cloud' && row.id === connectionId)
}

export const $messagingListenerOnDevice = atom<boolean | null>(null)
export const $messagingListenConnectionId = atom<string | null>(null)
export const $messagingListHomeId = atom<string | null>(null)

const appliedListenerKeys = new Set<string>()

export function resetMessagingListenerForTests(): void {
  appliedListenerKeys.clear()
  $messagingListenerOnDevice.set(null)
  $messagingListenConnectionId.set(null)
  $messagingListHomeId.set(null)
}

export function messagingListenerKey(plan: MessagingListenerPlan): string {
  return `${plan.device ? 'device' : 'cloud'}:${plan.listenId}:${plan.releaseIds.join(',')}`
}

export function claimMessagingListener(plan: MessagingListenerPlan): boolean {
  const key = messagingListenerKey(plan)

  if (appliedListenerKeys.has(key)) {
    return false
  }

  appliedListenerKeys.add(key)

  return true
}
