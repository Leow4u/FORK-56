// Pure helpers around the OpenAI-compatible API server: the key Work4You makes
// for it, the base URL and model name another tool needs, whether the bind
// reaches the network, and the address the live test proved answering.

import type { MessagingEnvVarInfo } from '@/types/work4you'

export const OPEN_WEBUI_GUIDE_URL = 'https://work4you.ai/docs/user-guide/messaging/open-webui'

const LOOPBACK_HOSTS = new Set(['', '127.0.0.1', 'localhost', '::1'])

const savedValue = (envVars: MessagingEnvVarInfo[], key: string) =>
  envVars.find(field => field.key === key)?.value?.trim() || ''

/** 32-char URL-safe random key (24 bytes, base64url) — comfortably above the
 *  adapter's 16-char startup guard and free of padding/quoting hazards. */
export function generateApiServerKey(): string {
  const bytes = new Uint8Array(24)

  crypto.getRandomValues(bytes)

  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

/** Base URL an OpenAI-compatible client should point at, from the saved
 *  (non-secret) env values with the adapter's defaults filled in. */
export function apiServerBaseUrl(envVars: MessagingEnvVarInfo[]): string {
  const host = savedValue(envVars, 'API_SERVER_HOST') || '127.0.0.1'
  const port = savedValue(envVars, 'API_SERVER_PORT') || '8642'
  const displayHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host

  return `http://${displayHost}:${port}/v1`
}

/** True when the saved bind address makes the listener reachable from other
 *  machines — the key then guards terminal-capable access over the network. */
export function apiServerIsNetworkExposed(envVars: MessagingEnvVarInfo[]): boolean {
  return !LOOPBACK_HOSTS.has(savedValue(envVars, 'API_SERVER_HOST').toLowerCase())
}

/** The model name the endpoint advertises on /v1/models, picked the way the
 *  adapter picks it: the saved name, else the profile's own name (so each
 *  profile is a model of its own), else "work4you". */
export function apiServerModelName(envVars: MessagingEnvVarInfo[], profile: null | string): string {
  const explicit = savedValue(envVars, 'API_SERVER_MODEL_NAME')

  if (explicit) {
    return explicit
  }

  const name = (profile ?? '').trim()

  return name && name !== 'default' && name !== 'custom' ? name : 'work4you'
}

/** The base URL the live test reached with the key ("API server is live at
 *  <url> and the key is valid."); null when the test did not reach a running
 *  endpoint (the gateway was down, or the test failed). */
export function apiServerLiveUrl(message: null | string | undefined): null | string {
  const match = /\bis live at (\S+) and the key is valid/.exec(message ?? '')

  return match ? match[1] : null
}
