import { useStore } from '@nanostores/react'

import { composerFloatingPill } from '@/components/chat/composer-dock'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { FolderOpen } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $projectTree } from '@/store/projects'

import { emptyWorkspaceChipLabel } from './workspace-chip-label'
import { WorkspaceSelectMenu } from './workspace-select-menu'

export function WorkspaceChipRow({ cwd, messagesEmpty }: { cwd?: null | string; messagesEmpty: boolean }) {
  const { t } = useI18n()
  const selectLabel = t.commandCenter.selectWorkspace
  useStore($projectTree)
  const path = (cwd ?? '').trim()
  const label = emptyWorkspaceChipLabel(path, selectLabel)
  const tip = path ? `${label} — ${displayPath(path)}` : selectLabel

  if (!messagesEmpty) {
    return null
  }

  return (
    <WorkspaceSelectMenu side="top" tooltip={tip}>
      <button
        aria-label={selectLabel}
        className={cn(
          composerFloatingPill,
          'min-w-0 max-w-48',
          'data-[state=open]:bg-(--chrome-action-hover) data-[state=open]:text-foreground'
        )}
        data-slot="workspace-chip"
        type="button"
      >
        <FolderOpen aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    </WorkspaceSelectMenu>
  )
}
