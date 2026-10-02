import { cn } from '@/lib/utils'
import type { ProfileBackendState } from '@/store/profile'

const STATE_DOT: Record<ProfileBackendState, string> = {
  running: 'bg-emerald-500',
  waking: 'animate-pulse bg-amber-400',
  asleep: 'border border-(--ui-text-quaternary) bg-background'
}

/** Backend liveness badge for a profile mark: green = warm, pulsing amber =
 *  waking, hollow = asleep. Absolutely positioned; the parent is `relative`. */
export function ProfileStateDot({
  className,
  label,
  state
}: {
  className?: string
  label?: string
  state: ProfileBackendState
}) {
  return (
    <span
      aria-label={label}
      className={cn(
        'pointer-events-none absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background',
        STATE_DOT[state],
        className
      )}
      data-slot="profile-state-dot"
      data-state={state}
      role={label ? 'img' : undefined}
    />
  )
}
