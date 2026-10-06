import { useStore } from '@nanostores/react'
import { type FC, useMemo } from 'react'

import { useComposerScope } from '@/app/chat/composer/scope'
import { useSessionView } from '@/app/chat/session-view'
import { deriveChangedFiles } from '@/components/assistant-ui/thread/changed-files'
import { DiffCount } from '@/components/ui/diff-count'
import { FadeScroll } from '@/components/ui/fade-scroll'
import { FileTypeIcon } from '@/components/ui/file-type-icon'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { ChevronRight, FileDiff } from '@/lib/icons'
import { openReviewForPath, revealReview } from '@/store/review'

// ~5 rows. A turn that rewrites twenty files should still read as one card in
// the transcript, not a wall the user has to scroll past to reach the composer.
const MAX_ROWS_HEIGHT = '8.75rem'

const ROW_CLASS = 'row-hover flex h-7 w-full shrink-0 cursor-pointer items-center gap-2 px-3 text-start'

const CHEVRON = <ChevronRight className="size-3.5 shrink-0 text-(--ui-text-tertiary) rtl:-scale-x-100" />

/**
 * Claude-style "Edited N files" card closing out the newest assistant turn:
 * a summary row with the turn's total +/- that opens the diff pane (⌘G), then
 * one row per file it edited with that file's +/-, which opens that file's
 * diff. Both sides of a count always show (`+12 −0`), as a list of changes
 * reads.
 *
 * A hairline list rather than a `WIDGET_SHELL_CLASS` panel: it indexes what
 * the reply did, at the reply's own type size, and lines up with its text.
 */
export const ChangedFilesCard: FC<{ parts: readonly unknown[] }> = ({ parts }) => {
  const { t } = useI18n()
  const copy = t.assistant.thread
  const files = useMemo(() => deriveChangedFiles(parts), [parts])

  const total = useMemo(
    () =>
      files.reduce((sum, file) => ({ added: sum.added + file.added, removed: sum.removed + file.removed }), {
        added: 0,
        removed: 0
      }),
    [files]
  )

  // Review THIS surface's repo: a tile transcript pins the pane to the tile's
  // worktree; the primary passes null (follow the active session, as before).
  const view = useSessionView()
  const viewCwd = useStore(view.$cwd)
  const scopeCwd = view.kind === 'primary' ? null : viewCwd || null
  const composerScope = useComposerScope()

  if (files.length === 0) {
    return null
  }

  return (
    <div
      className="ms-(--message-text-indent) mt-3 overflow-hidden rounded-(--card-radius) border border-(--ui-stroke-tertiary) py-1 text-[length:var(--conversation-text-font-size)] leading-5"
      data-slot="aui_changed-files"
    >
      <button
        className={ROW_CLASS}
        data-slot="aui_changed-files-summary"
        onClick={() => revealReview(scopeCwd, composerScope.target)}
        title={copy.reviewChanges}
        type="button"
      >
        <FileDiff className="size-3.5 shrink-0 text-(--ui-text-secondary)" />
        <span className="min-w-0 flex-1 truncate text-(--ui-text-primary)">{copy.filesChanged(files.length)}</span>
        <DiffCount added={total.added} removed={total.removed} showZero />
        {CHEVRON}
      </button>
      <FadeScroll className="flex flex-col" maxHeight={MAX_ROWS_HEIGHT}>
        {files.map(file => (
          <button
            className={ROW_CLASS}
            key={file.path}
            onClick={() => void openReviewForPath(file.path, scopeCwd, composerScope.target)}
            title={displayPath(file.path)}
            type="button"
          >
            <FileTypeIcon className="shrink-0 text-(--ui-text-secondary)" path={file.path} size="0.875rem" />
            <span className="min-w-0 flex-1 truncate text-(--ui-text-primary)">{file.name}</span>
            <DiffCount added={file.added} removed={file.removed} showZero />
            {CHEVRON}
          </button>
        ))}
      </FadeScroll>
    </div>
  )
}
