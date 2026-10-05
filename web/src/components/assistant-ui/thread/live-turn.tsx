// @ts-nocheck — desktop parity port; web shims pending.
import { useAuiState } from '@assistant-ui/react'
import { type FC, useMemo, useRef } from 'react'

import { useStatusHint, useThreadSessionStatus } from '@/components/assistant-ui/thread/status'
import { asToolPart } from '@/components/assistant-ui/thread/turn-parts'
import { TurnStream } from '@/components/assistant-ui/thread/turn-work'
import { APPROVAL_TOOLS, PendingToolApproval } from '@/components/assistant-ui/tool/approval'
import { toolLineTitle } from '@/components/assistant-ui/tool/fallback-model'
import { useElapsedSeconds } from '@/components/chat/activity-timer'
import { ActivityTimerText } from '@/components/chat/activity-timer-text'
import { SCAFFOLD_LABEL_CLASS, SCAFFOLD_META_CLASS } from '@/components/chat/scaffold-row'
import { StatusPulse } from '@/components/ui/status-pulse'
import { useI18n } from '@/i18n'
import { buildLiveTurnModel, liveTurnMessages, type LiveTurnModel, liveTurnSignature } from '@/lib/live-turn'
import { latestSessionTodos, todoStep } from '@/lib/todos'
import { cn } from '@/lib/utils'

/**
 * The turn in progress, as one block instead of a line per event.
 *
 * What the agent says to the user along the way stays on screen as prose, in
 * order, and under each sentence one line says what the work after it did —
 * "Created index.html", which opens into the rows. One status line, always
 * last, says what is happening now. However long the turn runs, the work
 * between two sentences never takes more than its line.
 *
 * The block is hosted by the turn's FIRST assistant message, which exists from
 * the moment the turn starts and never moves. Every note the agent writes seals
 * a bubble and opens another, and a block that followed the newest bubble
 * would unmount and remount — replaying its entrance — each time. Parts from
 * the other bubbles render here inside their own message (see TurnStream), so
 * a question or an approval in the streaming bubble still answers to it.
 */
export const LiveTurn: FC = () => {
  const model = useLiveTurnModel()

  return (
    <>
      <TurnStream answers={model.answers} segments={model.segments} />
      {model.pending && <LiveApproval part={model.pending.part} />}
      <NowLine model={model} />
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
const NowLine: FC<{ model: LiveTurnModel }> = ({ model }) => {
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
    return null
  }

  const label =
    hint ||
    pendingTitle ||
    (model.tail === 'text' ? t.assistant.thread.writing : '') ||
    model.thinkingAbout ||
    t.assistant.thread.thinking

  return (
    <div className="min-w-0 max-w-full" data-slot="aui_turn-now">
      <div
        aria-label={label}
        aria-live="polite"
        className="flex min-w-0 max-w-full items-center gap-1.5 leading-(--conversation-line-height)"
        data-conversation-scaffold=""
        role="status"
      >
        <StatusPulse
          aria-hidden="true"
          className="dither inline-block size-3 shrink-0 rounded-[2px] text-midground/80"
          kind="opacity"
        />
        <span className={cn(SCAFFOLD_LABEL_CLASS, 'shimmer min-w-0 truncate')}>{label}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {step && <span className={SCAFFOLD_META_CLASS}>{t.assistant.thread.stepOf(step.step, step.total)}</span>}
          <ActivityTimerText seconds={elapsed} />
        </span>
      </div>
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
