import { LOCALE_META } from '@/i18n'
import { Globe } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface LanguageSwitcherProps {
  className?: string
  collapsed?: boolean
  dropUp?: boolean
}

export function LanguageSwitcher({ className, collapsed = false }: LanguageSwitcherProps) {
  const current = LOCALE_META.en

  // Appearance offers English only. The other locale bundles stay available
  // as fallbacks, but they are not listed here.
  return (
    <span
      className={cn(
        'inline-flex min-w-32 items-center gap-2 px-2.5 text-left text-sm text-muted-foreground',
        collapsed && 'min-w-0 px-2',
        className
      )}
    >
      <Globe className="size-3.5 shrink-0" />
      {!collapsed && <span className="truncate">{current.name}</span>}
    </span>
  )
}
