import { SELECT_WORKSPACE_PAGE } from '@/app/command-palette/workspace-palette'
import { StatusRow } from '@/components/chat/status-row'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { FolderOpen } from '@/lib/icons'
import { openCommandPalettePage } from '@/store/command-palette'

export function WorkspaceChipRow({ cwd, messagesEmpty }: { cwd?: null | string; messagesEmpty: boolean }) {
  const { t } = useI18n()
  const selectLabel = t.commandCenter.selectWorkspace
  const path = (cwd ?? '').trim()
  const tip = path ? `${selectLabel} — ${displayPath(path)}` : selectLabel

  if (!messagesEmpty) {
    return null
  }

  return (
    <StatusRow className="min-h-7 rounded-t-[inherit] rounded-b-none border-b border-(--ui-stroke-tertiary) px-3.5 py-1.5 hover:bg-transparent">
      <Tip label={tip} side="top">
        <button
          aria-label={selectLabel}
          className="flex min-w-0 max-w-48 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-normal text-muted-foreground/92 hover:bg-(--chrome-action-hover) hover:text-foreground"
          data-slot="workspace-chip"
          onClick={() => openCommandPalettePage(SELECT_WORKSPACE_PAGE)}
          type="button"
        >
          <FolderOpen aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{selectLabel}</span>
        </button>
      </Tip>
    </StatusRow>
  )
}
