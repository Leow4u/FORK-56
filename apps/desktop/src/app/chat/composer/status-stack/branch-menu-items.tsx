import type { ReactNode } from 'react'

import { type ActionItemSpec, type MenuKit, renderActionItem } from '@/components/ui/actions-menu'
import type { Work4YouGitWorktree, Work4YouRepoStatus } from '@/global'

// Tiny uppercase section header, matching the composer "+" menu's labels.
const MENU_SECTION = 'text-[0.625rem] font-semibold uppercase tracking-wider text-(--ui-text-tertiary)'

export interface BranchMenuLabels {
  branchOffFrom: (base: string) => string
  convertBranch: string
  newBranch: string
  startWork: string
  switchTo: (branch: string) => string
  worktrees: string
}

export interface BranchMenuOptions {
  labels: BranchMenuLabels
  /** Jump into an existing worktree. Omitted hides the worktree rows. */
  onOpenWorktree?: (path: string) => void
  /** Open the worktree dialog based on `base` (a branch name; undefined = HEAD). */
  onStartBranch: (base: string | undefined) => void
  /** Switch the checkout to the trunk. Omitted hides the row. */
  onSwitchBranch?: (branch: string) => void
  /** Offer "Convert a branch…" (the dialog's existing-branch picker). */
  showConvertBranch?: boolean
  status: Work4YouRepoStatus
  worktrees: readonly Work4YouGitWorktree[]
}

interface BranchTarget {
  base: string | undefined
  label: string
}

/**
 * The branch targets a repo menu offers: the current branch first (the 99%
 * "branch off where I am"), then the trunk just below it, deduped so "on main"
 * shows a single trunk entry. Falls back to a plain off-HEAD branch when no
 * trunk is detected.
 */
export function branchTargets(status: Work4YouRepoStatus, labels: BranchMenuLabels): BranchTarget[] {
  const current = status.detached ? null : status.branch
  const targets: BranchTarget[] = []

  if (current) {
    targets.push({ base: current, label: labels.branchOffFrom(current) })
  }

  if (status.defaultBranch && status.defaultBranch !== current) {
    targets.push({ base: status.defaultBranch, label: labels.branchOffFrom(status.defaultBranch) })
  }

  if (targets.length === 0) {
    targets.push({ base: undefined, label: labels.newBranch })
  }

  return targets
}

/**
 * The branch / worktree actions, rendered identically by the coding strip's
 * kebab and right-click menu and by the empty-chat branch chip, so the three
 * never drift. Pure function of the repo status; every side effect is a
 * callback the caller owns.
 */
export function renderBranchMenuItems(kit: MenuKit, options: BranchMenuOptions): ReactNode {
  const { labels, onOpenWorktree, onStartBranch, onSwitchBranch, showConvertBranch, status, worktrees } = options
  const current = status.detached ? null : status.branch

  const switchTarget =
    onSwitchBranch && current && status.defaultBranch && status.defaultBranch !== current ? status.defaultBranch : null

  // Other worktrees to jump into — everything except the one we're already in
  // (matched by its checked-out branch) and the bare/main placeholder entry.
  const otherWorktrees = onOpenWorktree
    ? worktrees.filter(w => w.path && !w.detached && w.branch && w.branch !== current)
    : []

  const branchItems: ActionItemSpec[] = branchTargets(status, labels).map(target => ({
    key: target.base ?? '__head__',
    label: <span className="truncate">{target.label}</span>,
    onSelect: () => onStartBranch(target.base)
  }))

  const worktreeItems: ActionItemSpec[] = otherWorktrees.map(worktree => ({
    key: worktree.path,
    label: <span className="truncate">{worktree.branch}</span>,
    onSelect: () => onOpenWorktree?.(worktree.path)
  }))

  return (
    <>
      <kit.Label className={MENU_SECTION}>{labels.newBranch}</kit.Label>
      {branchItems.map(item => renderActionItem(kit, item))}
      {switchTarget &&
        renderActionItem(kit, {
          key: '__switch__',
          label: <span className="truncate">{labels.switchTo(switchTarget)}</span>,
          onSelect: () => onSwitchBranch?.(switchTarget)
        })}
      <kit.Separator />
      <kit.Label className={MENU_SECTION}>{labels.worktrees}</kit.Label>
      {worktreeItems.map(item => renderActionItem(kit, item))}
      {/* Create a fresh worktree off the current HEAD (the generic "spin up a
          worktree here", mirroring the sidebar's + button). */}
      {renderActionItem(kit, {
        key: '__start__',
        label: <span className="truncate">{labels.startWork}</span>,
        onSelect: () => onStartBranch(undefined)
      })}
      {showConvertBranch &&
        renderActionItem(kit, {
          key: '__convert__',
          label: <span className="truncate">{labels.convertBranch}</span>,
          onSelect: () => onStartBranch(undefined)
        })}
    </>
  )
}
