// @ts-nocheck — desktop parity port; web shims pending.
import { useAuiState } from '@assistant-ui/react'
import { useStore } from '@nanostores/react'
import { type FC, type ReactNode, useMemo, useRef } from 'react'

import { useStatusHint, useThreadSessionStatus } from '@/components/assistant-ui/thread/status'
import { asToolPart } from '@/components/assistant-ui/thread/turn-parts'
import { NoteRow, TurnAnswers, TurnCards, TurnWorkList } from '@/components/assistant-ui/thread/turn-work'
import { APPROVAL_TOOLS, PendingToolApproval } from '@/components/assistant-ui/tool/approval'
import { toolLineTitle } from '@/components/assistant-ui/tool/fallback-model'
import { summarizeToolRun, type ToolCallLike } from '@/components/assistant-ui/tool/run-summary'
import { useElapsedSeconds } from '@/components/chat/activity-timer'
import { ActivityTimerText } from '@/components/chat/activity-timer-text'
import { SCAFFOLD_LABEL_CLASS, SCAFFOLD_META_CLASS, ScaffoldRow } from '@/components/chat/scaffold-row'
import { FadeText } from '@/components/ui/fade-text'
import { StatusPulse } from '@/components/ui/status-pulse'
import { useI18n } from '@/i18n'
import { buildLiveTurnModel, liveTurnMessages, type LiveTurnModel, liveTurnSignature } from '@/lib/live-turn'
import { latestSessionTodos, todoStep } from '@/lib/todos'
import { cn } from '@/lib/utils'
import { $toolDisclosureOpen, setToolDisclosureOpen } from '@/store/tool-view'

/**
 * The turn in progress, as one block instead of a line per event.
 *
 * Balanced: what is done ("Explored 8 files, ran 3 commands"), the newest note
 * the agent wrote, anything that asks the user for something, the reply as it
 * streams, and one line for what is happening now. Compact keeps only the line
 * for now. However long the turn runs, that is all the work it puts on screen;
 * the rest is one click away, in order, under the first line.
 *
 * The block is hosted by the turn's FIRST assistant message, which exists from
 * the moment the turn starts and never moves. Every note the agent writes seals
 * a bubble and opens another, and a block that followed the newest bubble
 * would unmount and remount — replaying its entrance — each time. Parts from
 * the other bubbles render here inside their own message (see TurnWorkList),
 * so a question or an approval in the streaming bubble still answers to it.
 */
export const LiveTurn: FC<{ compact: boolean }> = ({ compact }) => {
  const { t } = useI18n()
  const model = useLiveTurnModel()
  const disclosureId = `turn-work:${model.turnKey}`
  const open = useStore($toolDisclosureOpen(disclosureId)) ?? false

  // The call in flight is the status line's to narrate; listing it as well
  // would say the same thing twice, one line apart.
  const items = useMemo(() => {
    const pending = model.pending?.ref

    return pending
      ? model.items.filter(
          item =>
            item.kind !== 'tool' ||
            item.ref.messageIndex !== pending.messageIndex ||
            item.ref.partIndex !== pending.partIndex
        )
      : model.items
  }, [model.items, model.pending])

  const canOpen = items.length > 0
  const onToggle = canOpen ? () => setToolDisclosureOpen(disclosureId, !open) : undefined
  const expanded = open && canOpen
  const failedCopy = t.assistant.tool

  const summary = useMemo(() => {
    if (model.finished.length === 0) {
      return ''
    }

    const work = summarizeToolRun(model.finished as ToolCallLike[], false)

    if (model.failed === 0) {
      return work
    }

    return `${work} · ${model.failed === 1 ? failedCopy.failedOne : failedCopy.failedMany(model.failed)}`
  }, [failedCopy, model.failed, model.finished])

  const approval = model.pending ? <LiveApproval part={model.pending.part} /> : null

  return (
    <>
      {compact ? (
        <NowLine model={model} onToggle={onToggle} open={expanded}>
          {expanded && <TurnWorkList items={items} />}
        </NowLine>
      ) : (
        summary && (
          <div className="grid min-w-0 max-w-full gap-(--tool-row-gap)" data-slot="aui_turn-work">
            <div data-conversation-scaffold="" data-tool-summary="">
              <ScaffoldRow onToggle={onToggle} open={expanded}>
                <FadeText className={cn(SCAFFOLD_LABEL_CLASS, 'truncate')}>{summary}</FadeText>
              </ScaffoldRow>
            </div>
            {expanded && <TurnWorkList items={items} />}
          </div>
        )
      )}
      {!compact && !expanded && model.note && <NoteRow noteKey={model.note.key} text={model.note.text} />}
      <TurnCards cards={model.cards} />
      {approval}
      <TurnAnswers answers={model.answers} />
      {!compact && <NowLine model={model} />}
    </>
  )
}

// assistant-ui runs selectors on every store update and compares by identity,
// so the model is rebuilt only when the turn's shape changes (see
// `liveTurnSignature`) — never per streamed token.
function useLiveTurnModel(): LiveTurnModel {
  const cache = useRef<{ signature: string; value: LiveTurnModel } | null>(null)

  return useAuiState(state => {
    const turn = liveTurnMessages(state.thread.messages as never, state.message.id)
    const signature = liveTurnSignature(turn)

    if (cache.current?.signature !== signature) {
      cache.current = { signature, value: buildLiveTurnModel(turn) }
    }

    return cache.current.value
  })
}

/**
 * What the turn is doing now, in one line: the call in flight ("Reading
 * brief.md"), else what the model says it is thinking about, else "Thinking" —
 * with the plan's step and the turn's clock. It covers every gap the turn
 * produces nothing in, so the transcript never goes quiet while the composer
 * says work is happening. It steps aside while the turn waits on the user:
 * the card asking for an answer is the line then.
 */
const NowLine: FC<{ children?: ReactNode; model: LiveTurnModel; onToggle?: () => void; open?: boolean }> = ({
  children,
  model,
  onToggle,
  open = false
}) => {
  const { t } = useI18n()
  const { awaitingInput, compacting, drafting, providerWait, turnStartedAt } = useThreadSessionStatus()
  const hint = useStatusHint(compacting, drafting, providerWait)
  const step = useTodoStep()
  const elapsed = useElapsedSeconds(!awaitingInput, undefined, turnStartedAt)

  const pendingTitle = useMemo(
    () => (model.pending ? toolLineTitle(asToolPart(model.pending.part)) : ''),
    [model.pending]
  )

  if (awaitingInput) {
    return children ? <div data-slot="aui_turn-work">{children}</div> : null
  }

  const label =
    hint ||
    pendingTitle ||
    (model.tail === 'text' ? t.assistant.thread.writing : '') ||
    model.thinkingAbout ||
    t.assistant.thread.thinking

  const meta = (
    <span className="flex shrink-0 items-center gap-1.5">
      {step && <span className={SCAFFOLD_META_CLASS}>{t.assistant.thread.stepOf(step.step, step.total)}</span>}
      <ActivityTimerText seconds={elapsed} />
    </span>
  )

  const pulse = (
    <StatusPulse
      aria-hidden="true"
      className="dither inline-block size-3 shrink-0 rounded-[2px] text-midground/80"
      kind="opacity"
    />
  )

  return (
    <div className="grid min-w-0 max-w-full gap-(--tool-row-gap)" data-slot="aui_turn-now">
      <div aria-label={label} aria-live="polite" data-conversation-scaffold="" role="status">
        {onToggle ? (
          <ScaffoldRow onToggle={onToggle} open={open} trailing={meta}>
            {pulse}
            <FadeText className={cn(SCAFFOLD_LABEL_CLASS, 'shimmer truncate')}>{label}</FadeText>
          </ScaffoldRow>
        ) : (
          <div className="flex min-w-0 max-w-full items-center gap-1.5 leading-(--conversation-line-height)">
            {pulse}
            <span className={cn(SCAFFOLD_LABEL_CLASS, 'shimmer min-w-0 truncate')}>{label}</span>
            {meta}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

// The web transcript keeps no todo store of its own: the plan is the newest
// `todo` call in the thread, which the parts protocol carries like any call.
function useTodoStep() {
  const step = useAuiState(state => {
    const todos = latestSessionTodos(state.thread.messages as never)
    const current = todos ? todoStep(todos) : null

    return current ? `${current.step}/${current.total}` : ''
  })

  return useMemo(() => {
    if (!step) {
      return null
    }

    const [current, total] = step.split('/').map(Number)

    return { step: current, total }
  }, [step])
}

const LiveApproval: FC<{ part: unknown }> = ({ part }) => {
  const toolPart = asToolPart(part)

  return APPROVAL_TOOLS.has(toolPart.toolName) ? <PendingToolApproval part={toolPart} /> : null
}
