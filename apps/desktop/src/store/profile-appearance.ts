import { computed } from 'nanostores'

import { type BotAppearance, botAppearance, botMetaOf } from '@/lib/bot-avatar'
import { $profileAvatars } from '@/store/profile-avatars'
import type { ProfileInfo } from '@/types/work4you'

import { $profileColors, $profiles, normalizeProfileKey } from './profile'

// How a profile looks when drawn as its bot, resolved once for every surface
// (the sidebar rail and hover panel, the all-profiles cards, Manage, the
// settings scope chips). One bot = one profile, so this is the same answer the
// WorkBots roster gives, from the same inputs:
//
//   - the look stored in the profile's `ui_meta['work4you-bots']` (shape,
//     color, whether the person customized it) — what the Bots editor saves;
//   - the rail's local color pick as a fallback when no color is stored
//     (older gateways, or a pick made before the rail wrote server-side);
//   - the profile's avatar picture, once `$profileAvatars` has fetched it.

export interface ProfileLook {
  appearance: BotAppearance
  /** The profile reports an avatar asset; the picture may still be loading. */
  hasAvatar: boolean
}

export function resolveProfileLook(
  name: null | string | undefined,
  profile: Pick<ProfileInfo, 'has_avatar' | 'ui_meta'> | undefined,
  colors: Record<string, string>,
  avatars: Record<string, null | string>
): ProfileLook {
  const key = normalizeProfileKey(name)
  const meta = botMetaOf(profile?.ui_meta)

  return {
    appearance: botAppearance(key, {
      ...meta,
      color: meta?.color ?? colors[key] ?? null,
      image: avatars[key] ?? null
    }),
    hasAvatar: Boolean(profile?.has_avatar)
  }
}

/** Every listed profile's look, keyed by profile name. */
export const $profileLooks = computed([$profiles, $profileColors, $profileAvatars], (profiles, colors, avatars) =>
  Object.fromEntries(
    profiles.map(profile => [
      normalizeProfileKey(profile.name),
      resolveProfileLook(profile.name, profile, colors, avatars)
    ])
  )
)
