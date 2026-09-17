import { useStore } from '@nanostores/react'

import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
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

/** Occupied-chat identity only. Setup (Open folder / New project) stays
 *  on empty-chat Select workspace and Sidebar → Projects. */
export function WorkspaceNameButton({ cwd }: { cwd?: null | string }) {
  const { t } = useI18n()
  const homeLabel = t.sidebar.projects.home
  useStore($projectTree)
  const name = workspaceChipLabel(cwd, homeLabel)
  const path = (cwd ?? '').trim()

  return (
    <span
      className="min-w-0 max-w-36 truncate text-xs font-normal text-muted-foreground/92"
      data-slot="workspace-name"
      title={path ? displayPath(path) : name}
    >
      {name}
    </span>
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
