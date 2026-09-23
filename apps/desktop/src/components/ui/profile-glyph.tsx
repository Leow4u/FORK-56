import { profileColorSoft } from '@/lib/profile-color'
import { cn } from '@/lib/utils'

import { Codicon } from './codicon'

/** A profile's mark, in one place: the default profile is the `home` icon (it
 *  has no color of its own and an initial would read as just another named
 *  profile); every other profile is a soft tint of its color carrying its
 *  initial. Presentational — callers resolve the color from `$profileColors`. */
const GLYPH_SIZE = {
  sm: { box: 'size-4', icon: '0.75rem', text: 'text-[0.5rem]', radius: 'rounded-[3px]' },
  md: { box: 'size-5', icon: '0.8rem', text: 'text-[0.62rem]', radius: 'rounded-full' },
  lg: { box: 'size-9', icon: '1.05rem', text: 'text-sm', radius: 'rounded-full' }
} as const

export function ProfileGlyph({
  className,
  color,
  isDefault,
  name,
  size = 'sm',
  ...props
}: Omit<React.ComponentProps<'span'>, 'color'> & {
  color: null | string
  isDefault: boolean
  name: string
  size?: keyof typeof GLYPH_SIZE
}) {
  const scale = GLYPH_SIZE[size]

  if (isDefault) {
    return (
      <span
        className={cn(
          'grid shrink-0 place-items-center text-(--ui-text-secondary)',
          scale.box,
          size === 'sm' ? 'text-(--ui-text-quaternary)' : 'rounded-full bg-(--ui-bg-quaternary)',
          className
        )}
        {...props}
      >
        <Codicon name="home" size={scale.icon} />
      </span>
    )
  }

  const initial = name.replace(/[^a-z0-9]/gi, '').charAt(0) || '?'

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center font-semibold uppercase leading-none',
        scale.box,
        scale.radius,
        scale.text,
        className
      )}
      style={{ backgroundColor: profileColorSoft(color ?? 'var(--ui-text-quaternary)', 22), color: color ?? undefined }}
      {...props}
    >
      {initial}
    </span>
  )
}
