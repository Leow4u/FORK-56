import type { DesktopCloudDiscoverResult, DesktopConnectionConfig, DesktopConnectionConfigInput } from '@/global'
import { translateNow } from '@/i18n/runtime'
import { notify } from '@/store/notifications'
import { noteSidebarCloudEntitlement } from '@/store/session-homes'

import { paidCloudLoginConnection, paidCloudLoginShouldApply } from '../chat/composer/status-stack/run-target'

export interface PaidCloudEntryDesktop {
  applyConnectionConfig: (payload: DesktopConnectionConfigInput) => Promise<DesktopConnectionConfig>
  getConnectionConfig: (profile?: null | string) => Promise<DesktopConnectionConfig>
  cloud: {
    agentSignIn: (dashboardUrl: string) => Promise<{ connected: boolean }>
    discover: (org?: string) => Promise<DesktopCloudDiscoverResult>
    status: () => Promise<{ signedIn: boolean }>
  }
}

let flight: Promise<DesktopConnectionConfig | null> | null = null

export function resetPaidCloudEntryForTests(): void {
  flight = null
}

function savedCloudUrl(config: Pick<DesktopConnectionConfig, 'mode' | 'remoteUrl'>): string {
  return config.mode === 'cloud' ? config.remoteUrl.trim().replace(/\/+$/, '').toLowerCase() : ''
}

function agentLabel(result: DesktopCloudDiscoverResult, remoteUrl: string): string {
  if (!('agents' in result)) {
    return remoteUrl
  }

  const want = remoteUrl.trim().replace(/\/+$/, '').toLowerCase()

  const agent = result.agents.find(row => (row.dashboardUrl ?? '').trim().replace(/\/+$/, '').toLowerCase() === want)

  return agent?.name.trim() || remoteUrl
}

async function connectPaidCloud(desktop: PaidCloudEntryDesktop, org?: string): Promise<DesktopConnectionConfig | null> {
  const status = await desktop.cloud.status()

  if (!status.signedIn) {
    return null
  }

  const discovered = await desktop.cloud.discover(org)

  noteSidebarCloudEntitlement('entitlement' in discovered ? discovered.entitlement?.canUseCloud : undefined)

  const decision = paidCloudLoginConnection(discovered)

  if (decision.type !== 'apply') {
    return null
  }

  const saved = await desktop.getConnectionConfig(null)

  if (!paidCloudLoginShouldApply(savedCloudUrl(saved), decision.source)) {
    return null
  }

  const signedIn = await desktop.cloud.agentSignIn(decision.source.remoteUrl)

  if (!signedIn.connected) {
    return null
  }

  const next = await desktop.applyConnectionConfig({
    cloudOrg: decision.source.cloudOrg,
    mode: 'cloud',
    remoteAuthMode: 'oauth',
    remoteUrl: decision.source.remoteUrl
  })

  notify({
    kind: 'success',
    message: translateNow('settings.gateway.cloudConnectedTo', agentLabel(discovered, decision.source.remoteUrl)),
    title: translateNow('settings.gateway.cloudConnectedTitle')
  })

  return next
}

/** Connect the paid canonical agent once per in-flight attempt. Free, parked, and an already-matching dashboard stay put. */
export function ensurePaidCloudConnection(
  desktop: PaidCloudEntryDesktop,
  org?: string
): Promise<DesktopConnectionConfig | null> {
  if (!flight) {
    flight = connectPaidCloud(desktop, org).finally(() => {
      flight = null
    })
  }

  return flight
}
