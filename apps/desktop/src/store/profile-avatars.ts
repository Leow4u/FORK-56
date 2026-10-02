import { atom } from 'nanostores'

import { isBackfilledFacePng } from '@/lib/bot-avatar'

// A profile's avatar IMAGE (an uploaded photo, a generated picture, a pet)
// lives in the profile's asset store on the gateway, not in the profile list.
// This cache holds what the gateway answered per profile so every face on
// screen (rail, cards, Manage) asks once.
//
//   name → data URL   a real picture: draw it
//   name → null       checked: no picture, or only the roster's 160px snapshot
//                     of the vector face (for notices; the live face is better)
//   absent            not checked yet
//
// Fetching goes through the gateway socket, which this module reaches lazily
// so a store that renders faces never drags the socket registry in at import.

export const $profileAvatars = atom<Record<string, null | string>>({})

const inflight = new Map<string, Promise<void>>()
// A failed probe (socket gone, older gateway) is retried only after a pause,
// so a wall of faces cannot hammer a backend that is still coming up.
const missAt = new Map<string, number>()
const MISS_TTL_MS = 30_000

/** Fetch the profile's avatar once and cache the answer. Safe to call from
 *  every render of every face: it is a no-op for a cached, in-flight or
 *  recently-failed name. */
export function ensureProfileAvatar(name: string): Promise<void> {
  const key = name.trim()

  if (!key || key in $profileAvatars.get()) {
    return Promise.resolve()
  }

  const pending = inflight.get(key)

  if (pending) {
    return pending
  }

  if (Date.now() - (missAt.get(key) ?? 0) < MISS_TTL_MS) {
    return Promise.resolve()
  }

  const run = (async () => {
    try {
      const { $gateway } = await import('@/store/gateway')
      const gateway = $gateway.get()

      if (!gateway) {
        missAt.set(key, Date.now())

        return
      }

      const asset = await gateway.request<{ data?: string; found?: boolean }>('profiles.get_asset', {
        asset: 'avatar',
        name: key
      })

      const image = asset?.found && asset.data && !isBackfilledFacePng(asset.data) ? asset.data : null

      $profileAvatars.set({ ...$profileAvatars.get(), [key]: image })
    } catch {
      // Older gateway (no profiles.* RPCs) or a transient failure: the
      // vector face is always a correct drawing, so leave it unchecked and
      // let a later mount try again after the pause.
      missAt.set(key, Date.now())
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, run)

  return run
}

/** Forget a profile's cached answer so the next face asks again (after an
 *  upload, a clear, a rename). */
export function invalidateProfileAvatar(name: string): void {
  const key = name.trim()
  const current = $profileAvatars.get()

  if (!(key in current)) {
    return
  }

  const next = { ...current }

  delete next[key]
  $profileAvatars.set(next)
  missAt.delete(key)
}

/** Drop cached pictures the profile list no longer vouches for: a profile
 *  that is gone, or one whose asset was cleared (`has_avatar` false). A
 *  profile that newly reports an avatar is simply unchecked, so its next
 *  face fetches. */
export function reconcileProfileAvatars(profiles: ReadonlyArray<{ has_avatar?: boolean; name: string }>): void {
  const current = $profileAvatars.get()
  const live = new Map(profiles.map(profile => [profile.name.trim(), Boolean(profile.has_avatar)]))
  const next: Record<string, null | string> = {}
  let changed = false

  for (const [key, image] of Object.entries(current)) {
    if (live.get(key)) {
      next[key] = image
    } else {
      changed = true
      missAt.delete(key)
    }
  }

  if (changed) {
    $profileAvatars.set(next)
  }
}
