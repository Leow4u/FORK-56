import { useStore } from '@nanostores/react'

import { SELECT_WORKSPACE_PAGE } from '@/app/command-palette/workspace-palette'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { openCommandPalettePage } from '@/store/command-palette'
import { $activeConnectionId, $connectionsRegistry } from '@/store/connections'
import { $projectTree } from '@/store/projects'

import { workspaceChipLabel } from './workspace-chip-label'
import { workspaceConnectionLabel } from './workspace-connection-label'

export function ContextDot() {
  return (
    <span aria-hidden className="shrink-0 select-none text-muted-foreground/45">
      ·
    </span>
  )
}

export function WorkspaceNameButton({ cwd }: { cwd?: null | string }) {
  const { t } = useI18n()
  const homeLabel = t.sidebar.projects.home
  const selectLabel = t.commandCenter.selectWorkspace
  useStore($projectTree)
  const name = workspaceChipLabel(cwd, homeLabel)
  const path = (cwd ?? '').trim()
  const tip = path ? `${selectLabel} — ${displayPath(path)}` : selectLabel

  return (
    <Tip label={tip} side="top">
      <button
        aria-label={selectLabel}
        className="min-w-0 max-w-36 truncate rounded-md px-0.5 text-xs font-normal text-muted-foreground/92 hover:bg-(--chrome-action-hover) hover:text-foreground"
        data-slot="workspace-name"
        onClick={event => {
          event.stopPropagation()
          openCommandPalettePage(SELECT_WORKSPACE_PAGE)
        }}
        type="button"
      >
        {name}
      </button>
    </Tip>
  )
}

export function WorkspaceConnectionSegment() {
  const registry = useStore($connectionsRegistry)
  const activeConnectionId = useStore($activeConnectionId)
  const active = registry?.connections.find(connection => connection.id === activeConnectionId)
  const label = workspaceConnectionLabel(registry?.connections.length ?? 0, active?.label)

  if (!label) {
    return null
  }

  return (
    <>
      <ContextDot />
      <span
        className="min-w-0 max-w-28 truncate text-xs font-normal text-muted-foreground/92"
        data-slot="workspace-connection"
        title={label}
      >
        {label}
      </span>
    </>
  )
}
