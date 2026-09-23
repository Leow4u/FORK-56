import { useStore } from '@nanostores/react'

import { composerContextBar, composerContextShell } from '@/components/chat/composer-dock'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { FolderOpen } from '@/lib/icons'
import { isUnderPath } from '@/lib/path-compare'
import { cn } from '@/lib/utils'
import { $projectScope, $projectTree, ALL_PROJECTS, projectRootCwd } from '@/store/projects'

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
  const tip = path ? `${label} — ${displayPath(path)}` : selectLabel

  if (!messagesEmpty) {
    return null
  }

  return (
    <div className={cn(composerContextShell, 'gap-1')} data-slot="composer-context-bar">
      <div className="min-w-0 flex-1">
        <WorkspaceSelectMenu cwd={path} side="top" tooltip={tip}>
          <button aria-label={selectLabel} className={composerContextBar} data-slot="workspace-chip" type="button">
            <FolderOpen aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </WorkspaceSelectMenu>
      </div>
      <ComposerRunTargetMenu />
    </div>
  )
}
