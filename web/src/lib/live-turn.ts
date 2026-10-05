import { reasoningHeadline } from '@/lib/reasoning-blocks'
import { isSilentToolCall } from '@/lib/tool-render-class'
import { messageContentParts, messageIsInterim, partIsError, partText, partToolName, partType } from '@/lib/turn-fold'
import {
  buildTurnTimeline,
  failedToolCount,
  finishedTools,
  type IndexedTurnMessage,
  latestNote,
  latestThoughtTitle,
  type PartRef,
  type TimelineItem,
  type TurnAnswer,
  type TurnCard
} from '@/lib/turn-timeline'

/**
 * What the activity block needs to know about the turn in progress.
 *
 * The block draws a turn while it is still arriving, so this is rebuilt as
 * parts land — but only when the turn's SHAPE changes: a call starts or comes
 * back, a bubble seals, a note lands, the model starts thinking about something
 * new. Streamed prose is not shape. The answer renders through its own part,
 * which streams on its own, and keeping its characters out of here is what
 * keeps a 30 Hz token stream from re-rendering the whole block.
 */

/** What the newest part of the turn is, which is what the status line narrates. */
export type LiveTail = 'other' | 'reasoning' | 'text'

export interface LiveTurnModel {
  answers: TurnAnswer[]
  cards: TurnCard[]
  failed: number
  /** Calls that came back, in order — the "what's done" line. */
  finished: unknown[]
  items: TimelineItem[]
  note: Extract<TimelineItem, { kind: 'note' }> | null
  /** The newest call still waiting on its result, in the bubble that is streaming. */
  pending: { part: unknown; ref: PartRef } | null
  tail: LiveTail
  /** The newest heading the model gave its reasoning, '' when it gave none. */
  thinkingAbout: string
  /** Stable for the life of the turn: its first assistant message. */
  turnKey: string
}

interface LiveMessage {
  content?: unknown
  id: string
  metadata?: { custom?: { interim?: unknown } }
  parts?: unknown
  role?: string
  status?: { type?: string }
}

/**
 * The assistant messages of the turn that `hostId` opens: from it up to the
 * next user message. The host is the first assistant message of the turn.
 */
export function liveTurnMessages(messages: readonly LiveMessage[], hostId: string): IndexedTurnMessage[] {
  const turn: IndexedTurnMessage[] = []
  const start = messages.findIndex(message => message.id === hostId)

  if (start < 0) {
    return turn
  }

  for (let index = start; index < messages.length && messages[index].role !== 'user'; index++) {
    if (messages[index].role === 'assistant') {
      turn.push({ index, message: messages[index] })
    }
  }

  return turn
}

function argsMark(args: unknown): number {
  if (typeof args === 'string') {
    return args.length
  }

  return args && typeof args === 'object' ? Object.keys(args).length : 0
}

/**
 * Everything the model reads, as a string that changes exactly when the model
 * would. Reasoning contributes its newest heading rather than its length: the
 * block shows a thought's title, and the text behind it is read on demand.
 */
export function liveTurnSignature(turn: readonly IndexedTurnMessage[]): string {
  const rows: string[] = []
  let reasoning = ''

  for (const { index, message } of turn) {
    const status = (message as LiveMessage).status?.type ?? ''

    rows.push(`m${index}:${message.id}:${messageIsInterim(message) ? 1 : 0}:${status}`)

    for (const part of messageContentParts(message)) {
      const type = partType(part)

      if (type === 'tool-call') {
        const record = part as Record<string, unknown>

        rows.push(
          `t${String(record.toolCallId ?? '')}:${partToolName(part)}:${record.result === undefined ? 0 : 1}:${
            partIsError(part) ? 1 : 0
          }:${argsMark(record.args)}`
        )
      } else if (type === 'reasoning') {
        reasoning = partText(part)
        rows.push(reasoning.trim() ? 'r' : 'r0')
      } else if (type === 'text') {
        rows.push(partText(part).trim() ? 'x' : 'x0')
      } else {
        rows.push(type)
      }
    }
  }

  rows.push(`h${reasoningHeadline(reasoning)}`)

  return rows.join('|')
}

function liveTail(parts: readonly unknown[]): LiveTail {
  const last = parts.at(-1)
  const type = partType(last)

  if (type === 'reasoning') {
    return 'reasoning'
  }

  return type === 'text' && partText(last).trim() ? 'text' : 'other'
}

export function buildLiveTurnModel(turn: readonly IndexedTurnMessage[]): LiveTurnModel {
  const { answers, cards, items } = buildTurnTimeline(turn)
  const finished = finishedTools(items)
  const last = turn.at(-1)
  const lastParts = last ? messageContentParts(last.message) : []
  let pending: LiveTurnModel['pending'] = null

  // A call in flight lives in the bubble that is streaming; one left without a
  // result in a sealed bubble is history, not something to narrate.
  for (let partIndex = lastParts.length - 1; last && partIndex >= 0; partIndex--) {
    const part = lastParts[partIndex]

    if (
      partType(part) !== 'tool-call' ||
      isSilentToolCall({ isError: partIsError(part), toolName: partToolName(part) })
    ) {
      continue
    }

    if ((part as { result?: unknown }).result === undefined) {
      pending = { part, ref: { messageIndex: last.index, partIndex } }

      break
    }
  }

  return {
    answers,
    cards,
    failed: failedToolCount(finished),
    finished,
    items,
    note: latestNote(items),
    pending,
    tail: liveTail(lastParts),
    thinkingAbout: latestThoughtTitle(items),
    turnKey: turn[0]?.message.id ?? ''
  }
}
