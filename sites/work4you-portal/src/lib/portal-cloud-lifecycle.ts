import { cloudAgentChatUrl } from './cloud-agent-chat.ts'

/** Cloud chat / Fly VM is paid-only; Free → canUseCloud false from NAS entitlement. */

export function cloudAgentStatusHeadline(status: string): string {
  switch (status) {
    case 'online':
      return 'Agente'
    case 'starting':
    case 'provisioning':
    case 'updating':
      return 'A preparar…'
    case 'stopped':
    case 'parked':
      return 'Agente'
    case 'error':
      return 'Indisponível'
    default:
      return 'Agente'
  }
}

export function cloudAgentStatusDetail(status: string): string | null {
  switch (status) {
    case 'starting':
    case 'provisioning':
    case 'updating':
      return 'Só um momento.'
    case 'error':
      return 'Tente Instância Cloud.'
    default:
      return null
  }
}

export function canOpenCloudChat(args: {
  dashboardUrl: string | null | undefined
  status: string
  canUseCloud: boolean
}): {
  allowed: boolean
  chatUrl: string | null
  wakeOnOpen: boolean
  blockedReason: 'paid_plan_required' | null
} {
  const chatUrl = cloudAgentChatUrl(args.dashboardUrl)
  if (!args.canUseCloud) {
    return { allowed: false, chatUrl, wakeOnOpen: false, blockedReason: 'paid_plan_required' }
  }
  if (!chatUrl) {
    return { allowed: false, chatUrl, wakeOnOpen: false, blockedReason: null }
  }
  const s = args.status.toLowerCase()
  if (s === 'online' || s === 'starting') {
    return { allowed: true, chatUrl, wakeOnOpen: false, blockedReason: null }
  }
  if (s === 'stopped') {
    return { allowed: true, chatUrl, wakeOnOpen: true, blockedReason: null }
  }
  return { allowed: false, chatUrl, wakeOnOpen: false, blockedReason: null }
}
