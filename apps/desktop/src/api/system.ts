import { dictationLanguageHint } from '@/store/dictation-language'
import type {
  ActionResponse,
  ActionStatusResponse,
  AudioSpeakResponse,
  AudioTranscriptionResponse,
  BackendUpdateCheckResponse,
  CuratorStatusResponse,
  DebugShareResponse,
  ElevenLabsVoicesResponse,
  MemoryProviderConfig,
  MemoryProviderOAuthStatus,
  MemoryStatusResponse
} from '@/types/work4you'

import { capabilityScoped, type ProfileScope, profileScoped, work4youApi } from './client'

export const AUDIO_SPEAK_MIN_REQUEST_TIMEOUT_MS = 180_000
export const AUDIO_SPEAK_MAX_REQUEST_TIMEOUT_MS = 600_000
const AUDIO_SPEAK_TIMEOUT_MS_PER_CHAR = 35

export function audioSpeakRequestTimeoutMs(text: string): number {
  const estimated = Math.max(
    AUDIO_SPEAK_MIN_REQUEST_TIMEOUT_MS,
    Math.ceil(String(text || '').length * AUDIO_SPEAK_TIMEOUT_MS_PER_CHAR)
  )

  return Math.min(AUDIO_SPEAK_MAX_REQUEST_TIMEOUT_MS, estimated)
}

export const AUDIO_TRANSCRIBE_MIN_REQUEST_TIMEOUT_MS = 180_000
export const AUDIO_TRANSCRIBE_MAX_REQUEST_TIMEOUT_MS = 600_000
// The transcribe payload is the base64 audio data URL itself, so its string
// length tracks clip size. ~0.1ms/char keeps short clips at the floor while
// letting multi-minute recordings scale toward the cap (a base64 char is
// ~0.75 bytes, so at 128kbps ≈ 21k chars/s of audio this budgets ~2s of
// timeout per 1s of audio before the cap clamps it).
const AUDIO_TRANSCRIBE_TIMEOUT_MS_PER_CHAR = 0.1

export function audioTranscribeRequestTimeoutMs(dataUrl: string): number {
  const estimated = Math.max(
    AUDIO_TRANSCRIBE_MIN_REQUEST_TIMEOUT_MS,
    Math.ceil(String(dataUrl || '').length * AUDIO_TRANSCRIBE_TIMEOUT_MS_PER_CHAR)
  )

  return Math.min(AUDIO_TRANSCRIBE_MAX_REQUEST_TIMEOUT_MS, estimated)
}

// surface=declared serves the curated desktop schema; the dashboard consumes the raw plugin schema.
export function getMemoryProviderConfig(provider: string, profile?: null | string): Promise<MemoryProviderConfig> {
  return work4youApi<MemoryProviderConfig>({
    ...profileScoped(profile),
    path: `/api/memory/providers/${encodeURIComponent(provider)}/config?surface=declared`
  })
}

export function saveMemoryProviderConfig(
  provider: string,
  values: Record<string, string>,
  profile?: null | string
): Promise<{ ok: boolean }> {
  return work4youApi<{ ok: boolean }>({
    ...profileScoped(profile),
    path: `/api/memory/providers/${encodeURIComponent(provider)}/config?surface=declared`,
    method: 'PUT',
    body: { values }
  })
}

// Memory-provider OAuth connect (provider-keyed; 404s for providers without an
// OAuth flow). Profile-scoped: the grant lands in the active profile's config.
export function startMemoryProviderOAuth(
  provider: string,
  profile?: null | string
): Promise<MemoryProviderOAuthStatus> {
  return work4youApi<MemoryProviderOAuthStatus>({
    ...profileScoped(profile),
    path: `/api/memory/providers/${encodeURIComponent(provider)}/oauth/start`,
    method: 'POST'
  })
}

export function getMemoryProviderOAuthStatus(
  provider: string,
  profile?: null | string
): Promise<MemoryProviderOAuthStatus> {
  return work4youApi<MemoryProviderOAuthStatus>({
    ...profileScoped(profile),
    path: `/api/memory/providers/${encodeURIComponent(provider)}/oauth/status`
  })
}

// ---------------------------------------------------------------------------
// Memory data + curator (parity with `work4you memory` / `work4you curator`).
// ---------------------------------------------------------------------------

export function getMemoryStatus(): Promise<MemoryStatusResponse> {
  return work4youApi<MemoryStatusResponse>({
    ...profileScoped(),
    path: '/api/memory'
  })
}

export function resetMemory(target: 'all' | 'memory' | 'user'): Promise<{ ok: boolean; deleted: string[] }> {
  return work4youApi<{ ok: boolean; deleted: string[] }>({
    ...profileScoped(),
    path: '/api/memory/reset',
    method: 'POST',
    body: { target }
  })
}

export function getCuratorStatus(): Promise<CuratorStatusResponse> {
  return work4youApi<CuratorStatusResponse>({
    ...profileScoped(),
    path: '/api/curator'
  })
}

export function setCuratorPaused(paused: boolean): Promise<{ ok: boolean; paused: boolean }> {
  return work4youApi<{ ok: boolean; paused: boolean }>({
    ...profileScoped(),
    path: '/api/curator/paused',
    method: 'PUT',
    body: { paused }
  })
}

export function runCurator(): Promise<ActionResponse> {
  return work4youApi<ActionResponse>({
    ...profileScoped(),
    path: '/api/curator/run',
    method: 'POST',
    body: {}
  })
}

/** Restart `profile`'s gateway; without one, the app's active profile's. */
export function restartGateway(profile?: string): Promise<ActionResponse> {
  return work4youApi<ActionResponse>({
    ...profileScoped(profile),
    path: '/api/gateway/restart',
    method: 'POST'
  })
}

export function updateWork4You(): Promise<ActionResponse> {
  return work4youApi<ActionResponse>({
    ...profileScoped(),
    path: '/api/work4you/update',
    method: 'POST'
  })
}

/** Query the connected backend's own update state. In remote mode this is the
 *  authoritative source for the backend's behind-count + "what's changed",
 *  distinct from the Electron client clone's git state. */
export function checkWork4YouUpdate(force = false): Promise<BackendUpdateCheckResponse> {
  return work4youApi<BackendUpdateCheckResponse>({
    ...profileScoped(),
    path: `/api/work4you/update/check${force ? '?force=true' : ''}`
  })
}

export function getActionStatus(name: string, lines = 200, profile?: ProfileScope): Promise<ActionStatusResponse> {
  return window.work4youDesktop.api<ActionStatusResponse>({
    ...capabilityScoped(profile),
    path: `/api/actions/${encodeURIComponent(name)}/status?lines=${Math.max(1, lines)}`
  })
}

/** Carries the language the user speaks (Settings → Voice, the app language
 *  by default): without it the backend assumes English and Whisper translates. */
export function transcribeAudio(dataUrl: string, mimeType?: string): Promise<AudioTranscriptionResponse> {
  return work4youApi<AudioTranscriptionResponse>({
    path: '/api/audio/transcribe',
    method: 'POST',
    ...profileScoped(),
    body: {
      data_url: dataUrl,
      mime_type: mimeType,
      ...dictationLanguageHint()
    },
    // Transcription blocks until provider STT, file handling, and response
    // encoding finish. Remote providers and long clips regularly exceed the
    // default 15s Electron backend timeout.
    timeoutMs: audioTranscribeRequestTimeoutMs(dataUrl)
  })
}

/** `profile` defaults to the active one; Settings → Voice previews the
 *  voice of the profile it edits. */
export function speakText(text: string, profile?: null | string): Promise<AudioSpeakResponse> {
  return work4youApi<AudioSpeakResponse>({
    ...profileScoped(profile),
    path: '/api/audio/speak',
    method: 'POST',
    body: { text },
    // TTS blocks until provider synthesis, file read, and base64 encoding
    // finish. Remote providers and large messages regularly exceed the
    // default 15s Electron backend timeout.
    timeoutMs: audioSpeakRequestTimeoutMs(text)
  })
}

export function getElevenLabsVoices(profile?: ProfileScope): Promise<ElevenLabsVoicesResponse> {
  // capabilityScoped so a Capabilities remote pin lists THAT gateway's voices;
  // the string/undefined path is byte-identical to the former profileScoped call.
  return window.work4youDesktop.api<ElevenLabsVoicesResponse>({
    ...capabilityScoped(profile),
    path: '/api/audio/elevenlabs/voices'
  })
}

// ---------------------------------------------------------------------------
// GitHub CLI (`gh`) on the backend host — the Capabilities → MCP "GitHub CLI"
// connector. This is the credential the agent's terminal, git and the bundled
// github-* skills use; it is NOT the Work4You Apps (Composio) GitHub row.
// capabilityScoped so a remote Capabilities pin reports THAT host's gh.
// ---------------------------------------------------------------------------

export interface GhAuthStatus {
  /** `gh` binary found on the backend host. */
  available: boolean
  /** `gh auth status` succeeds for github.com. */
  authenticated: boolean
  /** GitHub username when authenticated and readable. */
  login: null | string
  host: string
}

export interface GhLoginStart {
  session_id: string
  /** The 8-char code the user types at `verification_url`. */
  user_code: string
  verification_url: string
  expires_in: number
  poll_interval: number
}

export type GhLoginStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'error'

export interface GhLoginPoll {
  session_id: string
  status: GhLoginStatus
  error_message: null | string
  login: null | string
  setup_git: boolean | null
}

/** Backend caches for 5 minutes; `refresh` bypasses (used right after a
 *  login or logout so the card flips immediately). */
export function getGhAuthStatus(profile?: ProfileScope, refresh = false): Promise<GhAuthStatus> {
  return window.work4youDesktop.api<GhAuthStatus>({
    ...capabilityScoped(profile),
    path: `/api/git/gh-auth${refresh ? '?refresh=true' : ''}`
  })
}

/** Start the GitHub device-code flow for the host's `gh`. 409 when `gh` is
 *  not installed there (`detail: "gh_missing"`). */
export function startGhLogin(profile?: ProfileScope): Promise<GhLoginStart> {
  return window.work4youDesktop.api<GhLoginStart>({
    ...capabilityScoped(profile),
    path: '/api/git/gh-auth/login',
    method: 'POST',
    body: {},
    timeoutMs: 30_000
  })
}

export function pollGhLogin(sessionId: string, profile?: ProfileScope): Promise<GhLoginPoll> {
  return window.work4youDesktop.api<GhLoginPoll>({
    ...capabilityScoped(profile),
    path: `/api/git/gh-auth/login/${encodeURIComponent(sessionId)}`
  })
}

export function cancelGhLogin(sessionId: string, profile?: ProfileScope): Promise<{ ok: boolean }> {
  return window.work4youDesktop.api<{ ok: boolean }>({
    ...capabilityScoped(profile),
    path: `/api/git/gh-auth/login/${encodeURIComponent(sessionId)}`,
    method: 'DELETE'
  })
}

/** `gh auth logout` on the backend host. */
export function ghLogout(profile?: ProfileScope): Promise<{ ok: boolean }> {
  return window.work4youDesktop.api<{ ok: boolean }>({
    ...capabilityScoped(profile),
    path: '/api/git/gh-auth/logout',
    method: 'POST',
    body: {},
    timeoutMs: 30_000
  })
}

// ---------------------------------------------------------------------------
// Maintenance operations (parity with `work4you doctor` / `work4you security
// audit` / `work4you backup` / `work4you debug share` and the dashboard System
// page). All except debug share are spawn-based background actions tailed via
// getActionStatus().
// ---------------------------------------------------------------------------

export function runDoctor(): Promise<ActionResponse> {
  return work4youApi<ActionResponse>({ path: '/api/ops/doctor', method: 'POST', body: {} })
}

export function runSecurityAudit(): Promise<ActionResponse> {
  return work4youApi<ActionResponse>({ path: '/api/ops/security-audit', method: 'POST', body: {} })
}

export function runBackup(): Promise<ActionResponse & { archive?: string }> {
  return work4youApi<ActionResponse & { archive?: string }>({
    path: '/api/ops/backup',
    method: 'POST',
    body: {}
  })
}

export function runDebugShare(): Promise<DebugShareResponse> {
  return work4youApi<DebugShareResponse>({
    path: '/api/ops/debug-share',
    method: 'POST',
    body: {},
    // Synchronous upload of report + logs to the paste service.
    timeoutMs: 120_000
  })
}
