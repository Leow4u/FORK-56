// Pure helpers around the Microsoft Graph webhook listener: the notification
// URL Graph registers, the bind, the clientState secret Work4You makes, and
// the facts the live test reports about a listener that answered.

import type { MessagingEnvVarInfo } from '@/types/work4you'

export const MSGRAPH_GUIDE_URL = 'https://work4you.ai/docs/user-guide/messaging/msgraph-webhook'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const ALL_INTERFACES = new Set(['0.0.0.0', '::', '*'])

function envValue(envVars: MessagingEnvVarInfo[], key: string): string {
  return envVars.find(field => field.key === key)?.value?.trim() || ''
}

/** Notification URL Graph registers — the public HTTPS origin wins, else the
 *  local bind (a wildcard bind is reached on loopback from this machine). */
export function msgraphNotificationUrlFor({
  host,
  port,
  publicUrl
}: {
  host: string
  port: string
  publicUrl: string
}): string {
  const origin = publicUrl.trim().replace(/\/+$/, '')

  if (origin) {
    return `${origin}/msgraph/webhook`
  }

  const bind = host.trim() || '127.0.0.1'

  return `http://${ALL_INTERFACES.has(bind) ? '127.0.0.1' : bind}:${port.trim() || '8646'}/msgraph/webhook`
}

/** The notification URL of what is saved. */
export function msgraphNotificationUrl(envVars: MessagingEnvVarInfo[]): string {
  return msgraphNotificationUrlFor({
    host: envValue(envVars, 'MSGRAPH_WEBHOOK_HOST'),
    port: envValue(envVars, 'MSGRAPH_WEBHOOK_PORT'),
    publicUrl: envValue(envVars, 'MSGRAPH_WEBHOOK_PUBLIC_URL')
  })
}

/** True when a saved host is reachable from other machines. The steps always
 *  save a host, so an unset one reads as this machine here. */
export function msgraphIsNetworkExposed(envVars: MessagingEnvVarInfo[]): boolean {
  const host = envValue(envVars, 'MSGRAPH_WEBHOOK_HOST').toLowerCase()

  return Boolean(host) && !LOOPBACK_HOSTS.has(host)
}

export function msgraphIsLocalhostOnly(envVars: MessagingEnvVarInfo[]): boolean {
  return !msgraphIsNetworkExposed(envVars)
}

/** 32 random bytes as hex — same shape as `openssl rand -hex 32`. */
export function generateMsgraphClientState(): string {
  const bytes = new Uint8Array(32)

  crypto.getRandomValues(bytes)

  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

/** What the live test says about a listener that answered /health: its port,
 *  whether it is bound to the network, and the URL to register. Null when
 *  the test did not reach it (or only reached it through the CIDR gate). */
export function msgraphListenerFacts(
  message: null | string | undefined
): null | { network: boolean; notifyUrl: string; port: string } {
  const match = /Listener is up on port (\d+) \((network-exposed|localhost-only)\)\. Register (\S+) with Graph\./.exec(
    message ?? ''
  )

  return match ? { network: match[2] === 'network-exposed', notifyUrl: match[3], port: match[1] } : null
}

/** True when the live test proved the listener's process up: /health
 *  answered, or answered 403 behind the source-IP allowlist. */
export function msgraphListenerUp(message: null | string | undefined): boolean {
  return Boolean(msgraphListenerFacts(message)) || /The process is up\./.test(message ?? '')
}
