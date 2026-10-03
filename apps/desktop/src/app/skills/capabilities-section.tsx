import type { ReactNode } from 'react'

/** A titled group inside a Capabilities list: label plus the item count. The
 *  count lives here, not on the tab pill, so every tab reads the same way. */
export function CapabilitiesSection({ children, count, label }: { children: ReactNode; count?: number; label: string }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="flex items-center gap-2 px-1 text-[0.72rem] font-medium text-(--ui-text-tertiary)">
        {label}
        {typeof count === 'number' && (
          <span className="rounded bg-(--ui-bg-tertiary) px-1.5 py-0.5 text-[0.65rem] leading-none text-(--ui-text-secondary) tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {children}
    </section>
  )
}
