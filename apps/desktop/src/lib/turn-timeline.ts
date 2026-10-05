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
 * activity block draws, live or settled.
 *
 * A turn reaches the transcript spread over several bubbles (every note the
 * agent writes seals one), and each bubble used to draw its own thoughts and
 * its own runs of calls. That is where the staircase came from: Thought,
 * Explored 2 files, Thought, Explored 1 file, a grey paragraph, and so on down
 * the page. Read as one list instead, the turn is three kinds of row — a
 * thought, a call, a note — and `segmentTurn` turns it into what the screen
 * shows: each note as prose, and the work between two notes behind one line.
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

/** A thought or a call: the rows a line of work opens into. */
export type WorkItem = Exclude<TimelineItem, { kind: 'note' }>

export interface TurnCard {
  /** How many items came before it, which is where it sits in the turn. */
  at: number
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
        cards.push({ at: items.length, key, part, ref })
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

/** The heading of the newest thought that has one, '' when none does. */
export function latestThoughtTitle(items: readonly TimelineItem[]): string {
  const thought = items.findLast(item => item.kind === 'thought' && item.title)

  return thought?.kind === 'thought' ? thought.title : ''
}

export type TurnSegment =
  /** Something the agent wrote along the way: prose, where it was said. */
  | { key: string; kind: 'sentence'; ref: PartRef }
  /** A question, an image, a delegation: in its place, never behind a line. */
  | { card: TurnCard; key: string; kind: 'card' }
  /** The thoughts and calls between two sentences, behind one line. */
  | { items: WorkItem[]; key: string; kind: 'work' }

/**
 * The turn the way the screen reads it: what the agent said to the user,
 * whole and in order, and under each sentence one line for the work that came
 * after it — "Created index.html", which opens into the rows.
 *
 * A sentence is the same part whether the turn is still running or has
 * settled, and whether it was the answer a moment ago: the text before a call
 * reads as the reply until the call arrives. It keeps the part's key, so the
 * prose already on screen stays where it is when that happens.
 *
 * `omit` leaves rows out without moving the cards — the live block hands the
 * status line the call in flight and the thought still arriving.
 */
export function segmentTurn(
  timeline: Pick<TurnTimeline, 'cards' | 'items'>,
  omit?: (item: TimelineItem) => boolean
): TurnSegment[] {
  const { cards, items } = timeline
  const segments: TurnSegment[] = []
  let nextCard = 0

  const placeCards = (upTo: number) => {
    for (; nextCard < cards.length && cards[nextCard].at <= upTo; nextCard++) {
      const card = cards[nextCard]

      segments.push({ card, key: card.key, kind: 'card' })
    }
  }

  for (const [index, item] of items.entries()) {
    placeCards(index)

    if (omit?.(item)) {
      continue
    }

    if (item.kind === 'note') {
      segments.push({ key: item.key, kind: 'sentence', ref: item.ref })

      continue
    }

    const last = segments.at(-1)

    // Keyed by its first row, so a row landing at the end leaves it in place.
    if (last?.kind === 'work') {
      last.items.push(item)
    } else {
      segments.push({ items: [item], key: `work:${item.key}`, kind: 'work' })
    }
  }

  placeCards(items.length)

  return segments
}
