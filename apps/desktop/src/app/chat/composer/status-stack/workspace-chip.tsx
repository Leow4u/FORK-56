import { useStore } from '@nanostores/react'

import { composerContextBar, composerContextShell } from '@/components/chat/composer-dock'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { FolderOpen } from '@/lib/icons'
import { isUnderPath } from '@/lib/path-compare'
import { cn } from '@/lib/utils'
import { $projectScope, $projectTree, ALL_PROJECTS, clearActiveWorkspace, projectRootCwd } from '@/store/projects'

import { ComposerRunTargetMenu } from './run-target-menu'
import { emptyWorkspaceChipLabel } from './workspace-chip-label'
import { WorkspaceSelectMenu } from './workspace-select-menu'

export function WorkspaceChipRow({ cwd, messagesEmpty }: { cwd?: null | string; messagesEmpty: boolean }) {
  const { t } = useI18n()
  const selectLabel = t.commandCenter.selectWorkspace
  const tree = useStore($projectTree)
  const scope = useStore($projectScope)
  const path = (cwd ?? '').trim()
  const scopedProject = scope === ALL_PROJECTS ? undefined : tree.find(project => project.id === scope)
  const scopedRoot = projectRootCwd(scopedProject)
  const scopedHere = !path || Boolean(scopedRoot && isUnderPath(scopedRoot, path))
  const scopedLabel = scopedProject && !scopedProject.isNoProject && scopedHere ? scopedProject.label : null
  const label = emptyWorkspaceChipLabel(path, selectLabel, scopedLabel)
  const selected = label !== selectLabel
  const tip = path ? `${label} — ${displayPath(path)}` : selectLabel
  const clearLabel = t.commandCenter.clearActiveWorkspace

  if (!messagesEmpty) {
    return null
  }

  return (
    <div className={cn(composerContextShell, 'gap-1')} data-slot="composer-context-bar">
      <div className="flex min-w-0 flex-1 items-center">
        <WorkspaceSelectMenu cwd={path} tooltip={tip}>
          <button aria-label={selectLabel} className={composerContextBar} data-slot="workspace-chip" type="button">
            <FolderOpen aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </WorkspaceSelectMenu>
        {selected ? (
          <Tip label={clearLabel} side="top">
            <button
              aria-label={clearLabel}
              className="grid size-6 shrink-0 place-items-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground"
              data-slot="workspace-chip-clear"
              onClick={() => clearActiveWorkspace()}
              type="button"
            >
              <Codicon name="close" size="0.75rem" />
            </button>
          </Tip>
        ) : null}
      </div>
      <ComposerRunTargetMenu />
    </div>
  )
}
