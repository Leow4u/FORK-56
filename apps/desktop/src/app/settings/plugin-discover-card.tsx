import type { ReactNode } from 'react'

/** A bundled plugin nobody enabled yet: name, what it does, its tags, and one
 *  action at the right. The same card as the MCP Discover grid. */
export function PluginDiscoverCard({
  action,
  description,
  id,
  name,
  tags
}: {
  action: ReactNode
  description?: string
  id?: string
  name: string
  tags?: ReactNode
}) {
  return (
    <div
      className="flex min-w-0 items-start gap-2.5 rounded-xl border border-(--ui-stroke-quaternary) px-3 py-2.5 focus-within:bg-(--ui-sidebar-surface-background) hover:bg-(--ui-sidebar-surface-background)"
      id={id}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.82rem] font-medium text-foreground/85">{name}</div>
        {description ? (
          <p className="mt-0.5 line-clamp-2 text-[0.68rem] text-muted-foreground/70">{description}</p>
        ) : null}
        {tags ? <div className="mt-1 flex flex-wrap items-center gap-1">{tags}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">{action}</div>
    </div>
  )
}
