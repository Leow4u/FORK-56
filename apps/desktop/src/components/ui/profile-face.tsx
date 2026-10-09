import { useEffect } from 'react'

import type { BotMood } from '@/lib/bot-avatar'
import { useStoreSelector } from '@/lib/use-session-slice'
import { cn } from '@/lib/utils'
import { normalizeProfileKey, type ProfileBackendState } from '@/store/profile'
import { $profileLooks, resolveProfileLook } from '@/store/profile-appearance'
import { $profileAvatars, ensureProfileAvatar } from '@/store/profile-avatars'

import { BotFace } from './bot-face'

// A profile drawn as its bot, wherever the app shows a profile: the same face
// the WorkBots roster draws, from the same stored look. Resolves the look from
// the profile stores by name, fetches the profile's avatar picture once when
// it reports one, and leaves the drawing to `BotFace` (and its shared clock).
// Decorative: callers label the control around it.

export interface ProfileFaceProps {
  className?: string
  mood?: BotMood
  name: null | string | undefined
  size: number
}

/** A waking backend is a bot at work: the face leans in with thinking dots
 *  until it is up. Running and asleep both rest. */
export const moodForBackendState = (state: ProfileBackendState): BotMood => (state === 'waking' ? 'work' : 'idle')

const NONE: Record<string, never> = {}

export function ProfileFace({ className, mood = 'idle', name, size }: ProfileFaceProps) {
  const key = normalizeProfileKey(name)
  const look = useStoreSelector($profileLooks, looks => looks[key])
  const cached = useStoreSelector($profileAvatars, avatars => avatars[key])

  useEffect(() => {
    if (look?.hasAvatar && cached === undefined) {
      void ensureProfileAvatar(key)
    }
  }, [cached, key, look?.hasAvatar])

  // A name the list does not (yet) carry still draws: the name alone rolls a
  // shape and a hue, exactly as the roster does for an unconfigured bot.
  const { color, image, shape } = (look ?? resolveProfileLook(key, undefined, NONE, NONE)).appearance

  return (
    <span
      aria-hidden
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden', className)}
      data-slot="profile-face"
      style={{ height: size, width: size }}
    >
      <BotFace color={color} image={image} mood={mood} name={key} shape={shape} size={size} />
    </span>
  )
}
