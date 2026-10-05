import { useAuiState } from '@assistant-ui/react'
import { useStore } from '@nanostores/react'
import { type FC, useMemo, useRef } from 'react'

import { TurnStream } from '@/components/assistant-ui/thread/turn-work'
import { WorkedForDisclosure } from '@/components/assistant-ui/thread/worked-for'
import { summarizeToolRun, type ToolCallLike } from '@/components/assistant-ui/tool/run-summary'
import {
  isFirstAssistantInTurn,
  isLastAssistantInTurn,
  isMessageInLastTurn,
  messageContentParts,
  messageDurationS,
  turnDurationS
} from '@/lib/turn-fold'
import { buildTurnTimeline, failedToolCount, finishedTools, segmentTurn, type TurnTimeline } from '@/lib/turn-timeline'
import type { ActivityDensity } from '@/store/activity-density'
import { $toolDisclosureOpen, setToolDisclosureOpen } from '@/store/tool-view'

const PASSTHROUGH = { kind: 'passthrough' } as const
const HIDE = { kind: 'hide' } as const
const LIVE = { kind: 'live' } as const

/**
 * How one assistant message draws itself, decided for its whole turn.
 *
 * - `passthrough`: its own parts, as they come — Detailed, and turns with no
 *   work to fold (a thought and a reply).
 * - `live`: the activity block for the turn in progress. Only the turn's first
 *   assistant message hosts it; see `LiveTurn`.
 * - `host`: a settled turn, folded behind one line. The LAST assistant message
 *   hosts it, since the reply's footer and actions belong to that message.
 * - `hide`: every other bubble of a live or folded turn.
 */
export type TurnView =
  | typeof HIDE
  | typeof LIVE
  | typeof PASSTHROUGH
  | {
      durationS?: number
      kind: 'host'
      /**
       * The newest turn stays open until the next message — at Balanced.
       * Only the turns before it fold on their own; nothing the user was just
       * watching disappears when the turn ends.
       */
      openByDefault: boolean
      parts: unknown[]
      timeline: TurnTimeline
    }

type ThreadFoldMessage = {
  content: unknown
  id: string
  metadata?: { custom?: { durationS?: unknown; interim?: unknown } }
  parts?: unknown
  role: string
  status?: { type?: string }
}

export function useTurnView(density: ActivityDensity): TurnView {
  const cache = useRef<{ signature: string; value: TurnView } | null>(null)

  return useAuiState(state => {
    if (density === 'detailed') {
      return PASSTHROUGH
    }

    const message = state.message as ThreadFoldMessage
    const messages = state.thread.messages as unknown as ThreadFoldMessage[]
    const index = messages.findIndex(entry => entry.id === message.id)
    const roles = messages.map(entry => entry.role)

    // The turn is live while the app says it is working, or while the thread's
    // tail is an assistant bubble still streaming — the first turn of a new
    // chat streams a flush before the busy flag catches up. A bubble left
    // streaming under a later note (a steer, with the runtime idle) is not.
    const tail = messages.at(-1)
    const tailStreaming = tail?.role === 'assistant' && tail.status?.type === 'running'

    if (isMessageInLastTurn(roles, index) && (state.thread.isRunning || tailStreaming)) {
      return isFirstAssistantInTurn(roles, index) ? LIVE : HIDE
    }

    // A bubble left streaming in an earlier turn (a turn that ended without its
    // settle event) draws itself rather than borrowing a live block.
    if (message.status?.type === 'running') {
      return PASSTHROUGH
    }

    const assistants = turnAssistants(messages, index)

    const signature = assistants
      .map(({ message: entry }) => `${entry.id}:${messageContentParts(entry).length}:${messageDurationS(entry) ?? ''}`)
      .concat(String(isLastAssistantInTurn(roles, index)), String(isMessageInLastTurn(roles, index)), density)
      .join('|')

    if (cache.current?.signature === signature) {
      return cache.current.value
    }

    const timeline = buildTurnTimeline(assistants)

    // A turn that only thought before replying keeps its Thought row: there is
    // no work to fold, and one line standing in for one line saves nothing.
    if (!timeline.items.some(item => item.kind !== 'thought')) {
      cache.current = { signature, value: PASSTHROUGH }

      return PASSTHROUGH
    }

    const value: TurnView = isLastAssistantInTurn(roles, index)
      ? {
          durationS: turnDurationS(assistants.map(entry => entry.message)),
          kind: 'host',
          openByDefault: density === 'balanced' && isMessageInLastTurn(roles, index),
          parts: assistants.flatMap(entry => messageContentParts(entry.message)),
          timeline
        }
      : HIDE

    cache.current = { signature, value }

    return value
  })
}

/** The assistant messages of the turn around `index`, with their thread positions. */
function turnAssistants(messages: readonly ThreadFoldMessage[], index: number) {
  let start = index

  while (start > 0 && messages[start - 1].role !== 'user') {
    start -= 1
  }

  const turn: { index: number; message: ThreadFoldMessage }[] = []

  for (let at = start; at < messages.length && messages[at].role !== 'user'; at++) {
    if (messages[at].role === 'assistant') {
      turn.push({ index: at, message: messages[at] })
    }
  }

  return turn
}

// Closed, a settled turn keeps only what the user still has to see: every
// row goes behind the line, and the cards and the reply stay out.
const behindTheLine = () => true

/**
 * A finished turn: one line for the whole of it, and the reply. Opened, it
 * reads the way it did while it ran — the sentences in their places, a line of
 * work under each — and Balanced leaves the newest turn that way until the
 * next message, so the turn the user just watched doesn't fold up under them.
 */
export const SettledProductTurn: FC<{
  durationS?: number
  messageId: string
  openByDefault?: boolean
  timeline: TurnTimeline
}> = ({ durationS, messageId, openByDefault = false, timeline }) => {
  const disclosureId = `turn-work:${messageId}`
  const persistedOpen = useStore($toolDisclosureOpen(disclosureId))
  const open = persistedOpen ?? openByDefault

  const { failed, summary } = useMemo(() => {
    const finished = finishedTools(timeline.items)

    return {
      failed: failedToolCount(finished),
      summary: finished.length > 0 ? summarizeToolRun(finished as ToolCallLike[], false) : ''
    }
  }, [timeline.items])

  const segments = useMemo(() => segmentTurn(timeline, open ? undefined : behindTheLine), [open, timeline])

  // A turn that said nothing along the way is one run of work, and the line
  // above already sums it up: a second line saying the same would be all that
  // opening it showed. Its rows come straight out instead.
  const said = segments.some(segment => segment.kind === 'sentence')

  return (
    <>
      <WorkedForDisclosure
        durationS={durationS}
        failed={failed}
        onToggle={() => setToolDisclosureOpen(disclosureId, !open)}
        open={open}
        summary={summary}
      />
      <TurnStream answers={timeline.answers} openWork={!said} segments={segments} />
    </>
  )
}
