import { StatusRow } from '@/components/chat/status-row'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { FolderOpen } from '@/lib/icons'

import { WorkspaceSelectMenu } from './workspace-select-menu'

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
      <WorkspaceSelectMenu tooltip={tip}>
        <button
          aria-label={selectLabel}
          className="flex min-w-0 max-w-48 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-normal text-muted-foreground/92 hover:bg-(--chrome-action-hover) hover:text-foreground"
          data-slot="workspace-chip"
          type="button"
        >
          <FolderOpen aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{selectLabel}</span>
        </button>
      </WorkspaceSelectMenu>
    </StatusRow>
  )
}
