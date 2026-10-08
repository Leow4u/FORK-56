import { useStore } from '@nanostores/react'
import { memo, useEffect } from 'react'

import { PrTag } from '@/app/chat/pr-tag'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { CopyButton } from '@/components/ui/copy-button'
import { DiffCount } from '@/components/ui/diff-count'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { registerRepoStatusCwd, repoStatusForCwd } from '@/store/coding-status'
import { $pullRequestsByBranch, branchPrKey, refreshPullRequests } from '@/store/pull-requests'

import { WorkspaceConnectionSegment } from './workspace-context-parts'

interface CodingStatusRowProps {
  onOpen?: () => void
  repoPath?: null | string
  placement: 'changes' | 'identity'
}

/** Active-session Git context lives outside the prompt card. Changes opens the
 * current Git review; the branch beneath the card is identity and copy only. */
export const CodingStatusRow = memo(function CodingStatusRow({ onOpen, repoPath, placement }: CodingStatusRowProps) {
  const { t } = useI18n()
  const s = t.statusStack.coding
  const path = repoPath?.trim() || undefined
  const status = useStore(repoStatusForCwd(path))
  const prBranch = status?.detached ? null : status?.branch || null
  const pr = useStore($pullRequestsByBranch)[path && prBranch ? branchPrKey(path, prBranch) : '']

  useEffect(() => registerRepoStatusCwd(path), [path])
  useEffect(() => {
    if (placement === 'identity' && path && prBranch) {
      void refreshPullRequests({ [path]: [prBranch] })
    }
  }, [path, placement, prBranch])

  if (!status) {
    return null
  }

  if (placement === 'changes') {
    const hasLines = status.added > 0 || status.removed > 0

    return (
      <Button data-slot="composer-changes-chip" onClick={onOpen} size="xs" type="button" variant="chip">
        <Codicon name="diff" size="0.8rem" />
        {t.preview.newTab.review}
        {hasLines ? (
          <DiffCount added={status.added} removed={status.removed} />
        ) : status.changed > 0 ? (
          <span className="text-(--ui-text-tertiary)">{s.changed(status.changed)}</span>
        ) : null}
      </Button>
    )
  }

  const branchLabel = status.detached ? s.detached : status.branch || s.noBranch

  return (
    <div className="flex min-w-0 max-w-full items-center gap-1" data-slot="composer-branch-identity">
      <CopyButton
        appearance="inline"
        className="min-w-0 max-w-64"
        disabled={!status.branch || status.detached}
        iconClassName="hidden"
        label={s.copyBranch}
        side="top"
        text={status.branch || ''}
        title={`${s.copyBranch} — ${branchLabel}${path ? ` · ${displayPath(path)}` : ''}`}
      >
        <Codicon className="shrink-0" name="git-branch" size="0.8rem" />
        <span className="truncate">{branchLabel}</span>
      </CopyButton>
      {pr && <PrTag pr={pr} />}
      <WorkspaceConnectionSegment />
      {(status.ahead > 0 || status.behind > 0) && (
        <span className="flex shrink-0 items-center gap-1.5 text-[0.68rem] leading-4 text-muted-foreground tabular-nums">
          {status.ahead > 0 && <span aria-label={s.ahead(status.ahead)}>↑{status.ahead}</span>}
          {status.behind > 0 && <span aria-label={s.behind(status.behind)}>↓{status.behind}</span>}
        </span>
      )}
    </div>
  )
})
