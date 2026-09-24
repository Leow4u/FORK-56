import { startGateway, stopGateway } from '@/api/system'
import type { DesktopCloudDiscoverResult, DesktopConnectionsRegistry } from '@/global'

import {
  $messagingListenConnectionId,
  $messagingListenerOnDevice,
  claimMessagingListener,
  messagingListenerPlan
} from './listener-home'

export interface MessagingListenerDesktop {
  cloud: {
    discover: (org?: string) => Promise<DesktopCloudDiscoverResult>
    status: () => Promise<{ signedIn: boolean }>
  }
  connections: {
    list: () => Promise<DesktopConnectionsRegistry>
  }
}

function entitlement(discovered: DesktopCloudDiscoverResult): boolean | null {
  if (!('agents' in discovered) || typeof discovered.entitlement?.canUseCloud !== 'boolean') {
    return null
  }

  return discovered.entitlement.canUseCloud
}

/** One messaging gateway. Paid starts the VM and stops the device gateway. Free does the opposite. */
export async function ensureMessagingListener(desktop: MessagingListenerDesktop): Promise<void> {
  const status = await desktop.cloud.status()

  if (!status.signedIn) {
    $messagingListenerOnDevice.set(null)
    $messagingListenConnectionId.set(null)

    return
  }

  const discovered = await desktop.cloud.discover()
  const canUseCloud = entitlement(discovered)
  const registry = await desktop.connections.list()
  const plan = messagingListenerPlan(canUseCloud, registry.connections)

  if (!plan) {
    $messagingListenerOnDevice.set(null)
    $messagingListenConnectionId.set(null)

    return
  }

  $messagingListenerOnDevice.set(plan.device)
  $messagingListenConnectionId.set(plan.listenId)

  if (!claimMessagingListener(plan)) {
    return
  }

  await startGateway(plan.listenId).catch(() => undefined)

  for (const id of plan.releaseIds) {
    await stopGateway(id).catch(() => undefined)
  }
}
