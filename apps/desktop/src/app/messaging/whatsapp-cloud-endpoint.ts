// Pure helpers around the WhatsApp Cloud API webhook listener: the callback
// URL Meta must call, whether the bind is reachable from other machines, and
// the verify token the setup can generate. Mirrors the backend's resolution
// (the live test reports the same callback).

import type { MessagingEnvVarInfo } from '@/types/work4you'

export const WHATSAPP_CLOUD_DEFAULT_PATH = '/whatsapp/webhook'
export const WHATSAPP_CLOUD_DEFAULT_PORT = '8090'
export const WHATSAPP_CLOUD_LOCAL_HOST = '127.0.0.1'
export const WHATSAPP_CLOUD_NETWORK_HOST = '0.0.0.0'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const ALL_INTERFACES = new Set(['0.0.0.0', '::', '*'])

export function whatsappCloudEnvValue(envVars: MessagingEnvVarInfo[], key: string): string {
  return envVars.find(field => field.key === key)?.value?.trim() || ''
}

/** The webhook path Meta POSTs to — the saved override, else the adapter default. */
export function whatsappCloudWebhookPath(envVars: MessagingEnvVarInfo[]): string {
  const raw = whatsappCloudEnvValue(envVars, 'WHATSAPP_CLOUD_WEBHOOK_PATH') || WHATSAPP_CLOUD_DEFAULT_PATH

  return raw.startsWith('/') ? raw : `/${raw}`
}

/** The callback URL to paste into Meta's webhook dialog — public HTTPS origin
 *  wins, else the local bind (which Meta itself can never reach). */
export function whatsappCloudCallbackUrl(envVars: MessagingEnvVarInfo[]): string {
  const publicUrl = whatsappCloudEnvValue(envVars, 'WHATSAPP_CLOUD_PUBLIC_URL').replace(/\/+$/, '')
  const path = whatsappCloudWebhookPath(envVars)

  if (publicUrl) {
    return `${publicUrl}${path}`
  }

  const host = whatsappCloudEnvValue(envVars, 'WHATSAPP_CLOUD_WEBHOOK_HOST') || WHATSAPP_CLOUD_LOCAL_HOST
  const port = whatsappCloudEnvValue(envVars, 'WHATSAPP_CLOUD_WEBHOOK_PORT') || WHATSAPP_CLOUD_DEFAULT_PORT
  const displayHost = ALL_INTERFACES.has(host) ? WHATSAPP_CLOUD_LOCAL_HOST : host

  return `http://${displayHost}:${port}${path}`
}

/** The callback for an origin typed in the setup, before anything is saved:
 *  the public origin, else this machine (what the setup binds to). */
export function whatsappCloudCallbackFor(publicUrl: string, envVars: MessagingEnvVarInfo[]): string {
  const origin = publicUrl.trim().replace(/\/+$/, '')
  const path = whatsappCloudWebhookPath(envVars)
  const port = whatsappCloudEnvValue(envVars, 'WHATSAPP_CLOUD_WEBHOOK_PORT') || WHATSAPP_CLOUD_DEFAULT_PORT

  return origin ? `${origin}${path}` : `http://${WHATSAPP_CLOUD_LOCAL_HOST}:${port}${path}`
}

/** True when a saved host is reachable from other machines. An unset host is
 *  treated as localhost here because the setup writes an explicit bind. */
export function whatsappCloudIsNetworkExposed(envVars: MessagingEnvVarInfo[]): boolean {
  const host = whatsappCloudEnvValue(envVars, 'WHATSAPP_CLOUD_WEBHOOK_HOST').toLowerCase()

  return Boolean(host) && !LOOPBACK_HOSTS.has(host)
}

/** 32 random bytes as hex — the same shape `work4you whatsapp-cloud` writes
 *  for an auto-generated verify token. */
export function generateWhatsappCloudVerifyToken(): string {
  const bytes = new Uint8Array(32)

  crypto.getRandomValues(bytes)

  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Who Meta confirmed, as the live test words it ("Meta confirmed the access
 *  token for +55 11 99999-3977 (Work4You)."): the number and its verified
 *  name, or null when the message says something else. */
export function whatsappCloudConfirmedNumber(message: string): null | { name: string; number: string } {
  const match = /Meta confirmed the access token for (.+?)\.(?:\s|$)/.exec(message)

  if (!match) {
    return null
  }

  const named = /^(.*?)\s*\((.+)\)$/.exec(match[1])

  return named ? { name: named[2], number: named[1] } : { name: '', number: match[1] }
}
