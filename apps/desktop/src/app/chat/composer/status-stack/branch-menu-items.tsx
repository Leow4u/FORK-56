import type { ReactNode } from 'react'

import { composerMenuLabel } from '@/components/chat/composer-dock'
import { type MenuKit } from '@/components/ui/actions-menu'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import type { Work4YouGitWorktree, Work4YouRepoStatus } from '@/global'
import { displayPath } from '@/lib/display-path'
import { isUnderPath } from '@/lib/path-compare'

export interface BranchMenuLabels {
  currentFolder: string
  otherWorktrees: string
  createContext: string
  newBranchWorktree: string
  existingBranchWorktree: string
  switchTo: (branch: string) => string
}

export interface BranchMenuOptions {
  labels: BranchMenuLabels
  onOpenWorktree?: (path: string) => void
  onStartBranch: (base: string | undefined) => void
  onExistingBranch?: () => void
  onSwitchBranch?: (branch: string) => void
  repoPath: string
  status: Work4YouRepoStatus
  worktrees: readonly Work4YouGitWorktree[]
}

/** Workspace choices identify the folder first. Creating a new branch always
 * creates a worktree, while switching the current folder remains explicit. */
export function renderBranchMenuItems(kit: MenuKit, options: BranchMenuOptions): ReactNode {
  const { labels, onOpenWorktree, onStartBranch, onExistingBranch, onSwitchBranch, repoPath, status, worktrees } =
    options

  const current = status.detached ? null : status.branch
  const switchTarget = onSwitchBranch && current && status.defaultBranch !== current ? status.defaultBranch : null

  const currentWorktree = worktrees
    .filter(worktree => worktree.path && isUnderPath(worktree.path, repoPath))
    .sort((a, b) => b.path.length - a.path.length)[0]

  const otherWorktrees = onOpenWorktree
    ? worktrees.filter(worktree => worktree.path && worktree !== currentWorktree)
    : []

  return (
    <>
      <kit.Label className={composerMenuLabel}>{labels.currentFolder}</kit.Label>
      <Tip label={displayPath(repoPath)} side="right">
        <kit.Item onSelect={() => undefined}>
          <Codicon name="git-branch" size="0.8rem" />
          <span className="truncate">{status.branch || 'HEAD'}</span>
          <Codicon className="ml-auto shrink-0" name="check" size="0.8rem" />
        </kit.Item>
      </Tip>
      {switchTarget && (
        <kit.Item onSelect={() => onSwitchBranch?.(switchTarget)}>
          <Codicon name="git-branch" size="0.8rem" />
          <span className="truncate">{labels.switchTo(switchTarget)}</span>
        </kit.Item>
      )}
      {otherWorktrees.length > 0 && (
        <>
          <kit.Separator />
          <kit.Label className={composerMenuLabel}>{labels.otherWorktrees}</kit.Label>
          {otherWorktrees.map(worktree => (
            <Tip key={worktree.path} label={displayPath(worktree.path)} side="right">
              <kit.Item onSelect={() => onOpenWorktree?.(worktree.path)}>
                <Codicon name="repo-forked" size="0.8rem" />
                <span className="truncate">{worktree.branch || worktree.path.split(/[\\/]/).pop()}</span>
              </kit.Item>
            </Tip>
          ))}
        </>
      )}
      <kit.Separator />
      <kit.Label className={composerMenuLabel}>{labels.createContext}</kit.Label>
      <kit.Item onSelect={() => onStartBranch(current || undefined)}>
        <Codicon name="add" size="0.8rem" />
        {labels.newBranchWorktree}
      </kit.Item>
      {onExistingBranch && (
        <kit.Item onSelect={onExistingBranch}>
          <Codicon name="repo-forked" size="0.8rem" />
          {labels.existingBranchWorktree}
        </kit.Item>
      )}
    </>
  )
}
