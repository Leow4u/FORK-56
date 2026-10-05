// @ts-nocheck — desktop parity port; web shims pending.
import { type FC, type ReactNode } from 'react'

import { SCAFFOLD_LABEL_CLASS, SCAFFOLD_META_CLASS, ScaffoldRow } from '@/components/chat/scaffold-row'
import { FadeText } from '@/components/ui/fade-text'
import { useI18n } from '@/i18n'
import { formatWorkedDuration, workedForLabel } from '@/lib/turn-fold'
import { cn } from '@/lib/utils'

/**
 * The one line a settled turn leaves behind, saying what the turn did —
 * "Explored 8 files, ran 3 commands, created resumo.md · 1m 30s". The work
 * list sits behind it; the answer and what the turn delivered stay outside.
 * A turn that only talked along the way has no calls to name, and says how
 * long it worked instead.
 */
export const WorkedForDisclosure: FC<{
  children?: ReactNode
  durationS?: number
  /** Steps that failed along the way. They sit in the work, so the line says so. */
  failed?: number
  onToggle: () => void
  open: boolean
  /** What the turn did, in the run-summary words; '' when it made no calls. */
  summary?: string
}> = ({ children, durationS, failed = 0, onToggle, open, summary = '' }) => {
  const { t } = useI18n()
  const failures = failed > 0 ? (failed === 1 ? t.assistant.tool.failedOne : t.assistant.tool.failedMany(failed)) : ''
  const work = summary || workedForLabel(durationS, t.assistant.thread)
  const label = failures ? `${work} · ${failures}` : work
  // With a summary the duration trails as meta; "Worked for 1m" already says it.
  const duration = summary && durationS !== undefined && durationS >= 1 ? formatWorkedDuration(durationS) : ''

  return (
    <div
      className="text-[length:var(--conversation-tool-font-size)] text-(--ui-text-tertiary)"
      data-slot="aui_worked-for"
    >
      {/* The mark sits on the header, not the block: the diary rows under it
          carry their own, and each should lift only when it is the one hovered. */}
      <div data-conversation-scaffold="">
        <ScaffoldRow onToggle={onToggle} open={open}>
          <FadeText className={cn(SCAFFOLD_LABEL_CLASS, 'truncate')}>{label}</FadeText>
          {duration && <span className={SCAFFOLD_META_CLASS}>{duration}</span>}
        </ScaffoldRow>
      </div>
      {open && children ? <div className="mt-0.5 grid min-w-0 max-w-full gap-(--tool-row-gap)">{children}</div> : null}
    </div>
  )
}
