// Pure helpers around the Teams bot listener: where Azure must send messages
// and whether the bind is reachable from other machines. Mirrors the
// backend's endpoint resolution (the live test reports the same URL).

import type { MessagingEnvVarInfo } from '@/types/work4you'

export const TEAMS_WEBHOOK_PATH = '/api/messages'
export const TEAMS_DEFAULT_PORT = '3978'
export const TEAMS_LOCAL_HOST = '127.0.0.1'
export const TEAMS_NETWORK_HOST = '0.0.0.0'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const ALL_INTERFACES = new Set(['0.0.0.0', '::', '*'])

export function teamsEnvValue(envVars: MessagingEnvVarInfo[], key: string): string {
  return envVars.find(field => field.key === key)?.value?.trim() || ''
}

/** The URL Azure registers as the bot messaging endpoint — public HTTPS origin
 *  wins, else the local bind (which Teams itself can never reach). */
export function teamsMessagingEndpoint(envVars: MessagingEnvVarInfo[]): string {
  const publicUrl = teamsEnvValue(envVars, 'TEAMS_PUBLIC_URL').replace(/\/+$/, '')

  if (publicUrl) {
    return `${publicUrl}${TEAMS_WEBHOOK_PATH}`
  }

  const host = teamsEnvValue(envVars, 'TEAMS_HOST') || TEAMS_LOCAL_HOST
  const port = teamsEnvValue(envVars, 'TEAMS_PORT') || TEAMS_DEFAULT_PORT
  const displayHost = ALL_INTERFACES.has(host) ? TEAMS_LOCAL_HOST : host

  return `http://${displayHost}:${port}${TEAMS_WEBHOOK_PATH}`
}

/** True when a saved host is reachable from other machines. An unset host is
 *  treated as localhost here because the setup writes an explicit bind. */
export function teamsIsNetworkExposed(envVars: MessagingEnvVarInfo[]): boolean {
  const host = teamsEnvValue(envVars, 'TEAMS_HOST').toLowerCase()

  return Boolean(host) && !LOOPBACK_HOSTS.has(host)
}

/** The endpoint for an origin typed in the setup, before anything is saved:
 *  the public origin, else this machine (what the setup binds to). */
export function teamsEndpointFor(publicUrl: string, port: string): string {
  const origin = publicUrl.trim().replace(/\/+$/, '')

  return origin
    ? `${origin}${TEAMS_WEBHOOK_PATH}`
    : `http://${TEAMS_LOCAL_HOST}:${port || TEAMS_DEFAULT_PORT}${TEAMS_WEBHOOK_PATH}`
}
