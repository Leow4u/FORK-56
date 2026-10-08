import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { FileDiffPanel } from '@/components/chat/diff-lines'
import { DiffSkeleton } from '@/components/chat/skeletons'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DiffCount } from '@/components/ui/diff-count'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { FileTypeIcon } from '@/components/ui/file-type-icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Tip } from '@/components/ui/tooltip'
import type { Work4YouReviewFile } from '@/global'
import { useDelayedTrue } from '@/hooks/use-delayed-true'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { copyFilePath } from '@/store/file-actions'
import { notifyError } from '@/store/notifications'
import {
  $reviewDiff,
  $reviewDiffError,
  $reviewDiffLoading,
  $reviewDiffPart,
  $reviewLoading,
  $reviewScope,
  requestRevert,
  selectReviewDirectory,
  selectReviewFile,
  setReviewDiffPart,
  stageReviewFile,
  unstageReviewFile
} from '@/store/review'

import { openReviewFile, reviewAbsolutePath } from './file-actions'

interface ReviewFilePanelProps {
  file: Work4YouReviewFile
}

export function ReviewFilePanel({ file }: ReviewFilePanelProps) {
  const { t } = useI18n()
  const c = t.statusStack.coding
  const scope = useStore($reviewScope)
  const part = useStore($reviewDiffPart)
  const diff = useStore($reviewDiff)
  const error = useStore($reviewDiffError)
  const loading = useStore($reviewDiffLoading)
  const refreshing = useStore($reviewLoading)
  const [collapsed, setCollapsed] = useState(false)
  const skeleton = useDelayedTrue(loading)
  const directory = file.kind === 'directory'

  // A partially staged file can be text in the index and binary in the worktree.
  const binaryDiff = diff?.trim()
    ? /^(?:Binary files .+ differ|GIT binary patch)\r?$/m.test(diff)
    : Boolean(file.binary)

  const partial = scope === 'uncommitted' && file.staged && file.unstaged
  const stagedPart = scope === 'staged' || (scope === 'uncommitted' && part === 'staged')
  const added = partial ? ((stagedPart ? file.stagedAdded : file.unstagedAdded) ?? file.added) : file.added
  const removed = partial ? ((stagedPart ? file.stagedRemoved : file.unstagedRemoved) ?? file.removed) : file.removed
  const canMutate = scope !== 'branch' && !refreshing
  const canStage = canMutate && (file.unstaged ?? !file.staged)
  const canUnstage = canMutate && file.staged

  const openFile = () =>
    void openReviewFile(file.path).catch(reason => notifyError(reason, t.rightSidebar.previewUnavailable))

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" data-review-file="">
      <div
        className="flex min-h-10 shrink-0 items-center gap-1.5 border-b border-(--ui-stroke-tertiary) px-3"
        data-suppress-pane-reveal-side=""
      >
        {directory ? <Codicon name="folder" /> : <FileTypeIcon path={file.path} />}
        <span className="min-w-0 flex-1 truncate text-xs" title={displayPath(reviewAbsolutePath(file.path))}>
          {displayPath(file.path)}
        </span>
        {!directory && <DiffCount added={added} removed={removed} />}
        <Tip label={c.openFile}>
          <Button
            aria-label={c.openFile}
            disabled={file.status === 'D'}
            onClick={openFile}
            size="icon-xs"
            variant="ghost"
          >
            <Codicon name="go-to-file" />
          </Button>
        </Tip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={c.fileActions} size="icon-xs" variant="ghost">
              <Codicon name="ellipsis" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void copyFilePath(reviewAbsolutePath(file.path))}>
              {t.fileMenu.copyPath}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={file.status === 'D'} onSelect={openFile}>
              {c.openFile}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setCollapsed(value => !value)}>
              {collapsed ? c.expandFile : c.collapseFile}
            </DropdownMenuItem>
            {scope !== 'branch' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!canStage}
                  onSelect={() => void stageReviewFile(file.path).catch(reason => notifyError(reason, c.stage))}
                >
                  <Codicon name="add" />
                  {c.stage}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canUnstage}
                  onSelect={() => void unstageReviewFile(file.path).catch(reason => notifyError(reason, c.unstage))}
                >
                  <Codicon name="remove" />
                  {c.unstage}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canMutate} onSelect={() => requestRevert(file.path)} variant="destructive">
                  <Codicon name="discard" />
                  {c.revert}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {partial && !collapsed && (
        <div aria-label={c.partialChanges} className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2">
          <SegmentedControl
            onChange={setReviewDiffPart}
            options={[
              { id: 'unstaged', label: `${c.unstaged} +${file.unstagedAdded ?? 0} −${file.unstagedRemoved ?? 0}` },
              { id: 'staged', label: `${c.staged} +${file.stagedAdded ?? 0} −${file.stagedRemoved ?? 0}` }
            ]}
            value={part}
          />
        </div>
      )}
      {collapsed ? (
        <div className="flex min-h-0 flex-1 items-start p-3">
          <Button onClick={() => setCollapsed(false)} size="xs" variant="text">
            {c.expandFile}
          </Button>
        </div>
      ) : directory ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4">
          <EmptyState description={c.untrackedDirectoryBody} title={c.untrackedDirectory} />
          <Button onClick={() => void selectReviewDirectory(file.path)} size="sm" variant="secondary">
            <Codicon name="folder-opened" />
            {c.browseDirectory}
          </Button>
        </div>
      ) : loading ? (
        skeleton ? (
          <DiffSkeleton />
        ) : (
          <div className="min-h-0 flex-1" />
        )
      ) : error ? (
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-4">
          <ErrorState
            description={<p className="break-words text-xs text-muted-foreground">{error}</p>}
            title={<p className="text-sm font-medium">{c.diffError}</p>}
          >
            <Button onClick={() => void selectReviewFile(file)} size="sm" variant="secondary">
              {t.rightSidebar.tryAgain}
            </Button>
          </ErrorState>
        </div>
      ) : binaryDiff ? (
        <EmptyState className="flex-1 px-4" title={c.binaryDiff} />
      ) : diff ? (
        <FileDiffPanel
          className="mx-0 mb-0 min-h-0 max-h-none flex-1 rounded-none border-0"
          diff={diff}
          path={file.path}
          showLineNumbers
        />
      ) : (
        <EmptyState className="flex-1 px-4" title={c.emptyFileDiff} />
      )}
    </section>
  )
}
