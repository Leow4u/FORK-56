import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageTitleProps {
  /** Trailing content on the title's line, at the right (Artifacts' refresh). */
  aside?: ReactNode
  children: ReactNode
  className?: string
}

/** Title row of the library pages (Customize, Channels, Artifacts, Routines):
 *  the page's name as the sidebar spells it, 28px/600, with 28px of air to the
 *  page's first row. Pair with PAGE_HEADER_TOP on the page header for the
 *  standard distance from the title bar. */
export function PageTitle({ aside, children, className }: PageTitleProps) {
  return (
    <div className={cn('mb-7 flex items-center justify-between gap-3', className)}>
      <h1 className="min-w-0 text-[1.75rem] leading-8 font-semibold tracking-tight text-foreground">{children}</h1>
      {aside}
    </div>
  )
}
