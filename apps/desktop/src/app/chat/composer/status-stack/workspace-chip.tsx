import { useStore } from '@nanostores/react'

import { SELECT_WORKSPACE_PAGE } from '@/app/command-palette/workspace-palette'
import { StatusRow } from '@/components/chat/status-row'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { FolderOpen } from '@/lib/icons'
import { openCommandPalettePage } from '@/store/command-palette'
import { $projectTree } from '@/store/projects'

import { workspaceChipLabel } from './workspace-chip-label'

export function WorkspaceChipRow({ cwd }: { cwd?: null | string }) {
  const { t } = useI18n()
  const homeLabel = t.sidebar.projects.home
  const selectLabel = t.commandCenter.selectWorkspace
  useStore($projectTree)
  const label = workspaceChipLabel(cwd, homeLabel)
  const path = (cwd ?? '').trim()
  const tip = path ? `${selectLabel} — ${displayPath(path)}` : selectLabel

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
          <span className="truncate">{label}</span>
        </button>
      </Tip>
    </StatusRow>
  )
}
