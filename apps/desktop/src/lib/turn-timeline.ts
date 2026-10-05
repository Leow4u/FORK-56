import { reasoningHeadline } from '@/lib/reasoning-blocks'
import { isSilentToolCall, isStayOutCardTool } from '@/lib/tool-render-class'
import {
  classifyTurnParts,
  messageContentParts,
  messageIsInterim,
  partIsError,
  partText,
  partToolName,
  partType
} from '@/lib/turn-fold'

/**
 * One turn's work as a single list, in the order it happened — what the
 * activity block draws when it is opened, live or settled.
 *
 * A turn reaches the transcript spread over several bubbles (every note the
 * agent writes along the way seals one), and each bubble used to draw its own
 * thoughts and its own runs of calls. That is where the staircase came from:
 * Thought, Explored 2 files, Thought, Explored 1 file, a grey paragraph, and so
 * on down the page. Read as one list instead, the turn is three kinds of row —
 * a thought, a call, a note — and the block decides how much of it to show.
 */

/** Where a part lives, so a row can render inside its own message's context. */
export interface PartRef {
  messageIndex: number
  partIndex: number
}

export type TimelineItem =
  /** Consecutive reasoning, merged — one row however many chunks it arrived in. */
  | { key: string; kind: 'thought'; refs: PartRef[]; text: string; title: string }
  /** An activity call: a read, a command, an edit — failed ones included. */
  | { key: string; kind: 'tool'; part: unknown; ref: PartRef }
  /** Prose the agent wrote along the way — commentary, not the answer. */
  | { key: string; kind: 'note'; ref: PartRef; text: string }

export interface TurnCard {
  key: string
  part: unknown
  ref: PartRef
}

export interface TurnAnswer {
  key: string
  ref: PartRef
}

export interface TurnTimeline {
  /** Text after the turn's last call: the reply itself, never folded. */
  answers: TurnAnswer[]
  /** Calls that ask for something or show what was asked for — never folded. */
  cards: TurnCard[]
  /** The work, in order. Silent calls are not in it: they leave nothing on screen. */
  items: TimelineItem[]
}

export interface IndexedTurnMessage {
  /** Position in the thread, which is what message providers address. */
  index: number
  message: {
    content?: unknown
    id: string
    metadata?: { custom?: { interim?: unknown } }
    parts?: unknown
  }
}

function partKey(messageId: string, index: number, part: unknown): string {
  const record = part && typeof part === 'object' ? (part as Record<string, unknown>) : {}

  return typeof record.toolCallId === 'string' && record.toolCallId ? record.toolCallId : `${messageId}:${index}`
}

export function buildTurnTimeline(messages: readonly IndexedTurnMessage[]): TurnTimeline {
  const answers: TurnAnswer[] = []
  const cards: TurnCard[] = []
  const items: TimelineItem[] = []
  // The thought still taking chunks. Anything that shows on screen ends it; a
  // silent call between two chunks doesn't, since it shows nothing.
  let thought: Extract<TimelineItem, { kind: 'thought' }> | null = null

  for (const { index: messageIndex, message } of messages) {
    const classified = classifyTurnParts(messageContentParts(message), { interim: messageIsInterim(message) })

    for (const { index: partIndex, part, role } of classified) {
      const ref = { messageIndex, partIndex }
      const type = partType(part)

      if (type === 'reasoning') {
        const text = partText(part).trim()

        if (!text) {
          continue
        }

        if (thought) {
          thought.refs.push(ref)
          thought.text = `${thought.text}\n\n${text}`
          thought.title = reasoningHeadline(text) || thought.title
        } else {
          thought = { key: partKey(message.id, partIndex, part), kind: 'thought', refs: [ref], text, title: '' }
          thought.title = reasoningHeadline(text)
          items.push(thought)
        }

        continue
      }

      if (type === 'text') {
        const text = partText(part).trim()

        if (!text) {
          continue
        }

        thought = null

        const key = partKey(message.id, partIndex, part)

        if (role === 'answer') {
          answers.push({ key, ref })
        } else {
          items.push({ key, kind: 'note', ref, text })
        }

        continue
      }

      if (type !== 'tool-call') {
        continue
      }

      const toolName = partToolName(part)

      if (isSilentToolCall({ isError: partIsError(part), toolName })) {
        continue
      }

      thought = null

      const key = partKey(message.id, partIndex, part)

      if (isStayOutCardTool(toolName)) {
        cards.push({ key, part, ref })
      } else {
        items.push({ key, kind: 'tool', part, ref })
      }
    }
  }

  return { answers, cards, items }
}

function hasResult(part: unknown): boolean {
  return Boolean(part && typeof part === 'object' && (part as { result?: unknown }).result !== undefined)
}

/** Calls that have come back — what the turn has done so far. */
export function finishedTools(items: readonly TimelineItem[]): unknown[] {
  return items.flatMap(item => (item.kind === 'tool' && hasResult(item.part) ? [item.part] : []))
}

export function failedToolCount(tools: readonly unknown[]): number {
  return tools.filter(partIsError).length
}

/** The newest note: the balanced block keeps it on screen as one line. */
export function latestNote(items: readonly TimelineItem[]): Extract<TimelineItem, { kind: 'note' }> | null {
  const note = items.findLast(item => item.kind === 'note')

  return note?.kind === 'note' ? note : null
}

/** The heading of the newest thought that has one, '' when none does. */
export function latestThoughtTitle(items: readonly TimelineItem[]): string {
  const thought = items.findLast(item => item.kind === 'thought' && item.title)

  return thought?.kind === 'thought' ? thought.title : ''
}

/**
 * A note as one line of plain text: its prose with the markdown marks that
 * would show as stray symbols taken out. The full note opens beneath it.
 */
export function noteLine(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/(\*\*|\*|`)(?=\S)([^\n]*?\S)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim()
}
