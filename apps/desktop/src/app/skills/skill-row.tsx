import { Badge } from '@/components/ui/badge'
import { Codicon } from '@/components/ui/codicon'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import type { SkillInfo } from '@/types/work4you'

/** One installed skill in the Capabilities list: icon, name with its category,
 *  the description as the meta line, usage and the enable switch at the right. */
export function SkillRow({
  busy,
  category,
  onOpen,
  onToggle,
  skill,
  usage
}: {
  busy: boolean
  category: string
  onOpen: () => void
  onToggle: (enabled: boolean) => void
  skill: SkillInfo
  usage: number
}) {
  const { t } = useI18n()

  return (
    <div className="flex items-center gap-3 border-b border-(--ui-stroke-quaternary) px-1 py-2.5 last:border-b-0 hover:bg-(--ui-row-hover-background)">
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onOpen} type="button">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-(--ui-stroke-tertiary) text-(--ui-text-secondary)">
          <Codicon name="zap" size="1rem" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{skill.name}</span>
            <Badge className="normal-case" variant="muted">
              {category}
            </Badge>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {skill.description || t.skills.usageCount(usage)}
          </span>
        </span>
      </button>
      {usage > 0 && (
        <span className="shrink-0 text-xs text-(--ui-text-tertiary) tabular-nums">{t.skills.usageCount(usage)}</span>
      )}
      <Switch aria-label={skill.name} checked={skill.enabled} disabled={busy} onCheckedChange={onToggle} size="xs" />
    </div>
  )
}
