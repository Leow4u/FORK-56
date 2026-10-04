// Pure helpers around the A2A channel: the Agent Card URL peers fetch, the
// bind the adapter really uses (a network host is ignored until a token is
// set), a strong token, and the facts the live test reports about the
// listener.

import type { MessagingEnvVarInfo } from '@/types/work4you'

import { generateApiServerKey } from './api-server-endpoint'

const LOOPBACK_HOSTS = new Set(['', '127.0.0.1', 'localhost', '::1'])

function envValue(envVars: MessagingEnvVarInfo[], key: string): string {
  return envVars.find(field => field.key === key)?.value?.trim() || ''
}

function envIsSet(envVars: MessagingEnvVarInfo[], key: string): boolean {
  return Boolean(envVars.find(field => field.key === key)?.is_set)
}

/** Agent Card URL peers fetch — the public URL wins, else the local bind
 *  (a wildcard bind is reached on loopback from this machine). */
export function a2aCardUrlFor({ host, port, publicUrl }: { host: string; port: string; publicUrl: string }): string {
  const origin = publicUrl.trim().replace(/\/+$/, '')

  if (origin) {
    return `${origin}/.well-known/agent-card.json`
  }

  const bind = host.trim() || '127.0.0.1'
  const displayHost = bind === '0.0.0.0' || bind === '::' || bind === '*' ? '127.0.0.1' : bind

  return `http://${displayHost}:${port.trim() || '9900'}/.well-known/agent-card.json`
}

/** The Agent Card URL of what is saved. */
export function a2aCardUrl(envVars: MessagingEnvVarInfo[]): string {
  return a2aCardUrlFor({
    host: envValue(envVars, 'A2A_HOST'),
    port: envValue(envVars, 'A2A_PORT'),
    publicUrl: envValue(envVars, 'A2A_PUBLIC_URL')
  })
}

/** True when a saved token exists so a non-loopback bind is honored. */
export function a2aHasInboundToken(envVars: MessagingEnvVarInfo[]): boolean {
  return envIsSet(envVars, 'A2A_BEARER_TOKEN') || envIsSet(envVars, 'A2A_PEER_TOKENS')
}

/** True when the saved host is reachable from other machines. */
export function a2aIsNetworkExposed(envVars: MessagingEnvVarInfo[]): boolean {
  return !LOOPBACK_HOSTS.has(envValue(envVars, 'A2A_HOST').toLowerCase())
}

/** True when the adapter will stay on loopback (no token, or a loopback host). */
export function a2aIsLocalhostOnly(envVars: MessagingEnvVarInfo[]): boolean {
  return !a2aHasInboundToken(envVars) || !a2aIsNetworkExposed(envVars)
}

export function generateA2AToken(): string {
  return generateApiServerKey()
}

/** What the live test says about a listener that answered: its port, whether
 *  remote peers can reach it (with a token), and the Agent Card it serves.
 *  Null when the test did not reach a running listener. */
export function a2aListenerFacts(
  message: null | string | undefined
): null | { cardUrl: string; port: string; remote: boolean } {
  const match = /Listener is up on port (\d+) \((remote \(bearer auth\)|localhost-only)\)\. Agent Card: (\S+)\. /.exec(
    message ?? ''
  )

  return match ? { cardUrl: match[3], port: match[1], remote: match[2].startsWith('remote') } : null
}
