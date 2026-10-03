import type { ReactNode } from 'react'

import { Codicon } from '@/components/ui/codicon'

/** One installed plugin in the Capabilities list — desktop or agent: icon,
 *  name with its tags, the description as the meta line, controls at the
 *  right. The same shape as the Skills rows. */
export function PluginListRow({
  controls,
  description,
  id,
  name,
  tags
}: {
  controls: ReactNode
  description?: ReactNode
  id?: string
  name: string
  tags?: ReactNode
}) {
  return (
    <div
      className="flex items-center gap-3 border-b border-(--ui-stroke-quaternary) px-1 py-2.5 last:border-b-0 hover:bg-(--ui-row-hover-background)"
      id={id}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-(--ui-stroke-tertiary) text-(--ui-text-secondary)">
        <Codicon name="extensions" size="1rem" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          {tags}
        </div>
        {description ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{description}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{controls}</div>
    </div>
  )
}
