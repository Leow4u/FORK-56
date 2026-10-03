import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { composerContextBar, composerPanelCard } from '@/components/chat/composer-dock'
import { DROPDOWN_KIT } from '@/components/ui/actions-menu'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { comparisonPath } from '@/lib/path-compare'
import { cn } from '@/lib/utils'
import {
  openWorktreeDialog,
  refreshRepoStatus,
  registerRepoStatusCwd,
  repoStatusForCwd,
  repoWorktreesForCwd
} from '@/store/coding-status'
import { notifyError } from '@/store/notifications'
import { retargetDraftWorkspace, switchBranchInRepo } from '@/store/projects'

import { useComposerMenuSide } from '../use-composer-menu-side'

import { renderBranchMenuItems } from './branch-menu-items'

/**
 * Empty-chat branch chip: sits beside Select project when the draft's folder is
 * a git repo, naming the current branch and opening the same branch / worktree
 * menu the occupied chat hides behind the coding strip's kebab. Hidden while
 * the repo probe has nothing (no folder, not a repo, probe pending). Never
 * shows ahead/behind or ± — there is nothing to review on an empty chat.
 *
 * Picking a worktree re-targets the draft at that folder (the project chip
 * stays put: same project, other checkout). New branch / New worktree open the
 * shared worktree dialog, which creates the worktree and anchors a session there.
 */
export function WorkspaceBranchChip({ cwd }: { cwd?: null | string }) {
  const { t } = useI18n()
  const s = t.statusStack.coding
  const p = t.sidebar.projects
  const path = (cwd ?? '').trim()
  const status = useStore(repoStatusForCwd(path || undefined))
  const worktrees = useStore(repoWorktreesForCwd(path || undefined))
  const hostRef = useRef<HTMLDivElement>(null)
  const menuSide = useComposerMenuSide(hostRef)
  const [open, setOpen] = useState(false)

  // Keep this folder in the coding-status refresh set while the chip is up, so
  // focus / turn-settle edges re-probe it like the coding strip does.
  useEffect(() => registerRepoStatusCwd(path || undefined), [path])

  if (!path || !status) {
    return null
  }

  const label = status.detached ? s.detached : status.branch || s.noBranch
  // The draft sits in a linked worktree (not the main checkout): swap the glyph
  // so the chip reads "worktree <branch>" rather than "branch".
  const target = comparisonPath(path)
  const inLinkedWorktree = worktrees.some(w => !w.isMain && w.path && comparisonPath(w.path) === target)

  const startBranch = (base: string | undefined) => {
    void openWorktreeDialog({ base, repoPath: path })
  }

  const switchBranch = async (branch: string) => {
    try {
      await switchBranchInRepo(path, branch)
      await refreshRepoStatus(path)
    } catch (err) {
      notifyError(err, s.switchFailed(branch))
    }
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <div className="contents" ref={hostRef}>
        <Tip label={`${label} — ${displayPath(path)}`} side={menuSide === 'bottom' ? 'top' : 'bottom'}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={s.branchChip}
              className={cn(composerContextBar, 'max-w-64')}
              data-slot="workspace-branch-chip"
              data-worktree={inLinkedWorktree ? '' : undefined}
              type="button"
            >
              <Codicon
                aria-hidden
                className="shrink-0 text-(--ui-green)"
                name={inLinkedWorktree ? 'repo-forked' : 'git-branch'}
                size="0.8rem"
              />
              <span className="truncate">{label}</span>
              <Codicon aria-hidden className="shrink-0 text-(--ui-text-tertiary)" name="chevron-down" size="0.7rem" />
            </button>
          </DropdownMenuTrigger>
        </Tip>
      </div>
      <DropdownMenuContent
        align="start"
        className={cn('w-60', composerPanelCard)}
        data-composer-menu=""
        data-slot="workspace-branch-menu"
        side={menuSide}
        sideOffset={8}
      >
        {renderBranchMenuItems(DROPDOWN_KIT, {
          labels: {
            branchOffFrom: s.branchOffFrom,
            convertBranch: p.convertBranch,
            newBranch: s.newBranch,
            startWork: p.startWork,
            switchTo: s.switchTo,
            worktrees: s.worktrees
          },
          onOpenWorktree: retargetDraftWorkspace,
          onStartBranch: startBranch,
          onSwitchBranch: branch => void switchBranch(branch),
          showConvertBranch: true,
          status,
          worktrees
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
