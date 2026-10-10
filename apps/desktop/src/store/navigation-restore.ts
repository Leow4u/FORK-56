import { atom } from 'nanostores'

import { appViewForPath, isNewChatRoute, isOverlayView, NEW_CHAT_ROUTE } from '@/app/routes'
import { persistString, storedString } from '@/lib/storage'
import { normalizeProfileKey } from '@/store/profile-identity'
import { getRememberedRoute, getRememberedSessionId } from '@/store/session'
import { isAuxiliaryWindow } from '@/store/windows'

// Whether the launch-time navigation restore (use-desktop-integrations) is
// still going to move this window off the new-chat route. The empty-chat
// layout reads it on the FIRST frame: with nothing to restore, the composer
// is born on the midline with the intro above it; with a remembered chat it
// stays docked at the bottom until that chat loads, instead of climbing to the
// midline on the fresh draft and dropping back when the restore navigates.
//
// The remembered route and session id are keyed per profile, and the primary
// profile is only adopted after the backend connects. So the profile the main
// window last booted as is remembered here, in its own key, and read back
// synchronously at module load: one launch's restore decision seeds the next
// launch's first frame. A missing key reads as the default profile, which is
// also what a fresh install boots as.
const BOOT_PROFILE_KEY = 'work4you.desktop.boot-profile'

export function rememberedBootProfile(): string {
  return normalizeProfileKey(storedString(BOOT_PROFILE_KEY))
}

export function rememberBootProfile(profile: null | string | undefined): void {
  persistString(BOOT_PROFILE_KEY, normalizeProfileKey(profile))
}

/**
 * Pure: will the launch-time restore navigate away from the new-chat route?
 * Mirrors the restore's own order (a remembered page or session route first,
 * then the remembered session id) without its ownership check — the session
 * list is not loaded yet when this is asked, and a stale entry only costs the
 * same one-time move to the midline the app makes today.
 */
export function navigationRestoreExpected(input: {
  pathname: string
  rememberedRoute: null | string
  rememberedSessionId: null | string
}): boolean {
  // A deep link or a session route already names the destination.
  if (!isNewChatRoute(input.pathname)) {
    return false
  }

  const route = input.rememberedRoute

  if (route && route !== NEW_CHAT_ROUTE && !isOverlayView(appViewForPath(route))) {
    return true
  }

  return Boolean(input.rememberedSessionId?.trim())
}

// HashRouter: the route lives in the hash. Before React mounts, an empty hash
// is the new-chat route.
function currentHashPathname(): string {
  try {
    return window.location.hash.replace(/^#/, '') || NEW_CHAT_ROUTE
  } catch {
    return NEW_CHAT_ROUTE
  }
}

function initialRestorePending(): boolean {
  // Helper windows (HUD, session pop-outs) never run the restore.
  if (typeof window === 'undefined' || isAuxiliaryWindow()) {
    return false
  }

  const profile = rememberedBootProfile()

  return navigationRestoreExpected({
    pathname: currentHashPathname(),
    rememberedRoute: getRememberedRoute(profile),
    rememberedSessionId: getRememberedSessionId(profile)
  })
}

/** True from load until the restore has decided (navigated, or found nothing
 *  valid to restore). Read by the empty-chat layout; settled by the restore. */
export const $navigationRestorePending = atom<boolean>(initialRestorePending())

export function settleNavigationRestore(): void {
  if ($navigationRestorePending.get()) {
    $navigationRestorePending.set(false)
  }
}

/** @internal Re-seed the flag for tests (recomputed from storage when omitted). */
export function _resetNavigationRestoreForTests(pending?: boolean): void {
  $navigationRestorePending.set(pending ?? initialRestorePending())
}
