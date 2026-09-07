import type {
  A2AAgentCreatePayload,
  A2AAgentInfo,
  A2AAgentsResponse,
  MessagingPlatformsResponse,
  MessagingPlatformTestResponse,
  MessagingPlatformUpdate,
  PairingResponse,
  PairingUser,
  SlackManifestResponse,
  TelegramOnboardingApplyResponse,
  TelegramOnboardingStartResponse,
  TelegramOnboardingStatusResponse,
  WebhookCreatePayload,
  WebhookCreateResponse,
  WebhookEnableResponse,
  WebhooksResponse,
  WhatsAppOnboardingApplyResponse,
  WhatsAppOnboardingMode,
  WhatsAppOnboardingStatusResponse
} from '@/types/work4you'

import { profileScoped, work4youApi } from './client'

export function getMessagingPlatforms(profile?: null | string): Promise<MessagingPlatformsResponse> {
  return work4youApi<MessagingPlatformsResponse>({
    ...profileScoped(profile),
    path: '/api/messaging/platforms'
  })
}

export function updateMessagingPlatform(
  platformId: string,
  body: MessagingPlatformUpdate,
  profile?: null | string
): Promise<{ ok: boolean; platform: string }> {
  return work4youApi<{ ok: boolean; platform: string }>({
    ...profileScoped(profile),
    path: `/api/messaging/platforms/${encodeURIComponent(platformId)}`,
    method: 'PUT',
    body
  })
}

export function testMessagingPlatform(
  platformId: string,
  profile?: null | string
): Promise<MessagingPlatformTestResponse> {
  return work4youApi<MessagingPlatformTestResponse>({
    ...profileScoped(profile),
    path: `/api/messaging/platforms/${encodeURIComponent(platformId)}/test`,
    method: 'POST'
  })
}

// -- Slack manifest-first onboarding ------------------------------------------
// The manifest is generated from the backend's command registry (slash
// commands change with the install), so it cannot be built client-side. Not
// profile-scoped: the manifest describes the app, not any profile's state.

export function getSlackManifest(): Promise<SlackManifestResponse> {
  return work4youApi<SlackManifestResponse>({
    path: '/api/messaging/slack/manifest'
  })
}

// -- Telegram QR onboarding ---------------------------------------------------
// The pairing session itself is in-memory on the backend (no profile), but the
// final apply writes credentials, so it must carry the settings scope — the
// endpoint reads the profile off the body first, then the query string.

export function startTelegramOnboarding(botName?: string): Promise<TelegramOnboardingStartResponse> {
  return work4youApi<TelegramOnboardingStartResponse>({
    path: '/api/messaging/telegram/onboarding/start',
    method: 'POST',
    body: botName ? { bot_name: botName } : {}
  })
}

export function getTelegramOnboardingStatus(pairingId: string): Promise<TelegramOnboardingStatusResponse> {
  return work4youApi<TelegramOnboardingStatusResponse>({
    path: `/api/messaging/telegram/onboarding/${encodeURIComponent(pairingId)}`
  })
}

export function applyTelegramOnboarding(
  pairingId: string,
  allowedUserIds: string[],
  profile?: null | string
): Promise<TelegramOnboardingApplyResponse> {
  return work4youApi<TelegramOnboardingApplyResponse>({
    ...profileScoped(profile),
    path: `/api/messaging/telegram/onboarding/${encodeURIComponent(pairingId)}/apply`,
    method: 'POST',
    body: { allowed_user_ids: allowedUserIds, ...profileScoped(profile) }
  })
}

export function cancelTelegramOnboarding(pairingId: string): Promise<{ ok: boolean }> {
  return work4youApi<{ ok: boolean }>({
    path: `/api/messaging/telegram/onboarding/${encodeURIComponent(pairingId)}`,
    method: 'DELETE'
  })
}

// -- WhatsApp QR onboarding ---------------------------------------------------
// The backend spawns the bundled Node.js bridge for Linked Devices pairing.
// Start/apply read the profile off the body (the session dir and the saved
// credentials are both profile-scoped); status/cancel key on the pairing id.

export function startWhatsAppOnboarding(
  mode: WhatsAppOnboardingMode,
  allowedUsers: string,
  profile?: null | string
): Promise<WhatsAppOnboardingStatusResponse> {
  return work4youApi<WhatsAppOnboardingStatusResponse>({
    ...profileScoped(profile),
    path: '/api/messaging/whatsapp/onboarding/start',
    method: 'POST',
    // The endpoint resolves the session directory from the body's profile.
    body: { mode, allowed_users: allowedUsers, ...profileScoped(profile) }
  })
}

export function getWhatsAppOnboardingStatus(pairingId: string): Promise<WhatsAppOnboardingStatusResponse> {
  return work4youApi<WhatsAppOnboardingStatusResponse>({
    path: `/api/messaging/whatsapp/onboarding/${encodeURIComponent(pairingId)}`
  })
}

export function applyWhatsAppOnboarding(
  pairingId: string,
  body: { allowed_users?: string; mode?: WhatsAppOnboardingMode },
  profile?: null | string
): Promise<WhatsAppOnboardingApplyResponse> {
  return work4youApi<WhatsAppOnboardingApplyResponse>({
    ...profileScoped(profile),
    path: `/api/messaging/whatsapp/onboarding/${encodeURIComponent(pairingId)}/apply`,
    method: 'POST',
    body: { ...body, ...profileScoped(profile) }
  })
}

export function cancelWhatsAppOnboarding(pairingId: string): Promise<{ ok: boolean }> {
  return work4youApi<{ ok: boolean }>({
    path: `/api/messaging/whatsapp/onboarding/${encodeURIComponent(pairingId)}`,
    method: 'DELETE'
  })
}

// -- Pairing (who may DM the bot) --------------------------------------------
// Unknown DMers get a one-time code and land in `pending` until an admin
// approves them. Approval grants on the row's `request_id`, never on the code:
// the code is the requester's proof that the channel is theirs and is never
// returned by the API, while an authenticated admin is only ever identifying
// a row they can already see.

export function getPairing(profile?: null | string): Promise<PairingResponse> {
  return work4youApi<PairingResponse>({
    ...profileScoped(profile),
    path: '/api/pairing'
  })
}

export function approvePairing(
  platform: string,
  requestId: string,
  profile?: null | string
): Promise<{ ok: boolean; user: PairingUser }> {
  return work4youApi<{ ok: boolean; user: PairingUser }>({
    ...profileScoped(profile),
    path: '/api/pairing/approve',
    method: 'POST',
    // These endpoints read the profile off the body, not the query string —
    // `profileScoped()` alone would approve into the wrong profile's store.
    body: { platform, request_id: requestId, ...profileScoped(profile) }
  })
}

export function revokePairing(platform: string, userId: string, profile?: null | string): Promise<{ ok: boolean }> {
  return work4youApi<{ ok: boolean }>({
    ...profileScoped(profile),
    path: '/api/pairing/revoke',
    method: 'POST',
    body: { platform, user_id: userId, ...profileScoped(profile) }
  })
}

// -- Webhooks (subscription CRUD) --------------------------------------------
// The webhook receiver is its own gateway platform; subscriptions live in a
// shared JSON store the CLI/dashboard also drive. Enable mutates config and
// best-effort restarts the gateway; subscription changes hot-reload.

export function getWebhooks(): Promise<WebhooksResponse> {
  return work4youApi<WebhooksResponse>({
    ...profileScoped(),
    path: '/api/webhooks'
  })
}

export function enableWebhooks(): Promise<WebhookEnableResponse> {
  return work4youApi<WebhookEnableResponse>({
    ...profileScoped(),
    path: '/api/webhooks/enable',
    method: 'POST'
  })
}

export function createWebhook(body: WebhookCreatePayload): Promise<WebhookCreateResponse> {
  return work4youApi<WebhookCreateResponse>({
    ...profileScoped(),
    path: '/api/webhooks',
    method: 'POST',
    body
  })
}

export function deleteWebhook(name: string): Promise<{ ok: boolean }> {
  return work4youApi<{ ok: boolean }>({
    ...profileScoped(),
    path: `/api/webhooks/${encodeURIComponent(name)}`,
    method: 'DELETE'
  })
}

export function setWebhookEnabled(
  name: string,
  enabled: boolean
): Promise<{ enabled: boolean; name: string; ok: boolean }> {
  return work4youApi<{ enabled: boolean; name: string; ok: boolean }>({
    ...profileScoped(),
    path: `/api/webhooks/${encodeURIComponent(name)}/enabled`,
    method: 'PUT',
    body: { enabled }
  })
}

// -- A2A outbound peers -------------------------------------------------------
// Named peers live in the profile's config.yaml (a2a_agents). Tokens are
// write-only: list/create responses expose has_auth only.

export function getA2AAgents(profile?: null | string): Promise<A2AAgentsResponse> {
  return work4youApi<A2AAgentsResponse>({
    ...profileScoped(profile),
    path: '/api/a2a/agents'
  })
}

export function createA2AAgent(body: A2AAgentCreatePayload, profile?: null | string): Promise<A2AAgentInfo> {
  return work4youApi<A2AAgentInfo>({
    ...profileScoped(profile),
    path: '/api/a2a/agents',
    method: 'POST',
    body: { ...body, ...(profile ? { profile } : {}) }
  })
}

export function deleteA2AAgent(name: string, profile?: null | string): Promise<{ name: string; ok: boolean }> {
  return work4youApi<{ name: string; ok: boolean }>({
    ...profileScoped(profile),
    path: `/api/a2a/agents/${encodeURIComponent(name)}`,
    method: 'DELETE'
  })
}
