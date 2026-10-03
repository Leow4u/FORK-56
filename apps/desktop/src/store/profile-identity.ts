import { atom } from 'nanostores'

import type { ProfileInfo } from '@/types/work4you'

/**
 * Profile identity — the atoms and key helpers every surface compares profiles
 * with. A leaf on purpose: no REST client, no gateway, no import-time
 * subscriptions. `@/store/profile` re-exports all of this (one address for
 * importers) and owns the behavior around it — routing REST to the live
 * profile, switching gateways, the rail. Stores that only need to READ which
 * profile is live (onboarding, for one) import from here, so loading them
 * never drags the routing side effects along — and a test that stubs the REST
 * client never has to know about them either.
 */

// Canonical key for a profile: trimmed, empty → "default". Used everywhere we
// compare a session's owning profile against the live gateway's profile.
export function normalizeProfileKey(name: string | null | undefined): string {
  const value = (name ?? '').trim()

  return value || 'default'
}

// Presentation-only label: the display_name from profile.yaml when set (e.g. a
// renamed default profile), else the canonical name. Never used for
// comparison or routing — canonical `name` remains the identity everywhere.
export function profileLabel(profile: Pick<ProfileInfo, 'display_name' | 'name'>): string {
  return (profile.display_name ?? '').trim() || profile.name
}

// Presentation name for the default profile when it carries no display name
// of its own: the product name, never the canonical id ("default") and never
// a "(default)" suffix. The id stays "default" for routing and comparison.
export const DEFAULT_PROFILE_LABEL = 'Work4You'

// The profile the running local backend is actually scoped to (mirrors
// /api/profiles/active `current`). "default" is the root ~/.work4you. This is the
// display source of truth for the statusbar pill; the desktop's *stored*
// preference (which may be unset) lives in the Electron main process.
export const $activeProfile = atom<string>('default')

// Cached profile list for the picker. Refreshed lazily; the dropdown also
// re-fetches on open so a profile created elsewhere shows up.
export const $profiles = atom<ProfileInfo[]>([])

// The profile the live gateway WebSocket is currently connected to. Initialized
// to the primary (window) backend's profile on boot. The gateway registry
// mirrors its own route into this atom via the onActiveRouteChanged callback
// (wired in use-gateway-boot's configureGatewayRegistry), so registry-internal
// eviction fallbacks (idle reap, connection removal, profile delete) can never
// leave this naming a profile the active socket no longer serves (#89206).
// `@/store/profile` subscribes to it to route profile-scoped REST.
export const $activeGatewayProfile = atom<string>('default')
