import { isSilentTool, isStayOutCardTool } from '@/lib/tool-render-class'

/**
 * Product-mode settle fold: classify a finished turn's parts so the
 * transcript can keep one "Worked for" diary, the final answer, and the
 * cards the user still has to see.
 *
 * Live / Technical keep painting every part. This module only answers
 * *what* a settled Product turn is allowed to show — not how.
 */

export type TurnFoldRole = 'answer' | 'card' | 'diary' | 'silent'

export interface FoldPart {
  index: number
  part: unknown
  role: TurnFoldRole
}

export interface ClassifyTurnOptions {
  /** Every text part is process talk — sealed `message.interim` bubbles. */
  interim?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function partType(part: unknown): string {
  return isRecord(part) && typeof part.type === 'string' ? part.type : ''
}

export function partToolName(part: unknown): string {
  return isRecord(part) && typeof part.toolName === 'string' ? part.toolName : ''
}

export function partText(part: unknown): string {
  return isRecord(part) && typeof part.text === 'string' ? part.text : ''
}

export function partIsError(part: unknown): boolean {
  return isRecord(part) && part.isError === true
}

export function messageContentParts(message: { content?: unknown; parts?: unknown }): unknown[] {
  const value = Array.isArray(message.parts) ? message.parts : message.content

  return Array.isArray(value) ? value : []
}

/**
 * Last non-silent tool in the part list. Text after this index is the
 * answer; text at or before it is process talk.
 */
export function lastAnswerBoundaryIndex(parts: readonly unknown[]): number {
  let last = -1

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]

    if (partType(part) === 'tool-call' && !isSilentTool(partToolName(part))) {
      last = index
    }
  }

  return last
}

export function classifyPart(part: unknown, index: number, lastToolIndex: number): TurnFoldRole {
  const type = partType(part)

  if (type === 'text') {
    return index > lastToolIndex ? 'answer' : 'diary'
  }

  if (type === 'reasoning') {
    return 'diary'
  }

  if (type !== 'tool-call') {
    return 'diary'
  }

  const toolName = partToolName(part)

  if (isSilentTool(toolName) && !partIsError(part)) {
    return 'silent'
  }

  if (partIsError(part) || isStayOutCardTool(toolName)) {
    return 'card'
  }

  return 'diary'
}

export function classifyTurnParts(parts: readonly unknown[], options: ClassifyTurnOptions = {}): FoldPart[] {
  const lastToolIndex = options.interim ? Number.POSITIVE_INFINITY : lastAnswerBoundaryIndex(parts)

  return parts.map((part, index) => ({
    index,
    part,
    role: classifyPart(part, index, lastToolIndex)
  }))
}

function diaryIsWork(entry: FoldPart): boolean {
  if (entry.role !== 'diary') {
    return false
  }

  const type = partType(entry.part)

  if (type === 'tool-call') {
    return true
  }

  return type === 'text' && partText(entry.part).trim().length > 0
}

/** Fold when the turn did work — tools or process prose. Thought-only stays a Thought row. */
export function shouldFoldTurn(classified: readonly FoldPart[]): boolean {
  return classified.some(diaryIsWork)
}

export function classifiedByRole(classified: readonly FoldPart[], role: TurnFoldRole): FoldPart[] {
  return classified.filter(entry => entry.role === role)
}

export function formatWorkedDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))

  if (whole < 60) {
    return `${Math.max(1, whole)}s`
  }

  const minutes = Math.floor(whole / 60)
  const rest = whole % 60

  if (minutes < 60) {
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function workedForLabel(
  durationS: number | undefined,
  copy: { worked: string; workedFor: (duration: string) => string }
): string {
  if (durationS === undefined || durationS < 1) {
    return copy.worked
  }

  return copy.workedFor(formatWorkedDuration(durationS))
}

export function isMessageInLastTurn(roles: readonly string[], index: number): boolean {
  let lastUser = -1

  for (let i = 0; i < roles.length; i++) {
    if (roles[i] === 'user') {
      lastUser = i
    }
  }

  return index > lastUser
}

export function isLastAssistantInTurn(roles: readonly string[], index: number): boolean {
  if (roles[index] !== 'assistant') {
    return false
  }

  for (let i = index + 1; i < roles.length && roles[i] !== 'user'; i++) {
    if (roles[i] === 'assistant') {
      return false
    }
  }

  return true
}

export function assistantTurnSlice<T extends { id: string; role?: string }>(
  messages: readonly T[],
  messageId: string
): T[] {
  const index = messages.findIndex(message => message.id === messageId)

  if (index < 0) {
    return []
  }

  let start = index

  while (start > 0 && messages[start].role !== 'user') {
    start -= 1
  }

  if (messages[start]?.role === 'user') {
    start += 1
  }

  let end = index + 1

  while (end < messages.length && messages[end].role !== 'user') {
    end += 1
  }

  return messages.slice(start, end).filter(message => message.role === 'assistant')
}

export function messageIsInterim(message: { metadata?: { custom?: { interim?: unknown } } }): boolean {
  return message.metadata?.custom?.interim === true
}

export function messageDurationS(message: { metadata?: { custom?: { durationS?: unknown } } }): number | undefined {
  const value = message.metadata?.custom?.durationS

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function turnDurationS<T extends { metadata?: { custom?: { durationS?: unknown } } }>(
  messages: readonly T[]
): number | undefined {
  let best: number | undefined

  for (const message of messages) {
    const duration = messageDurationS(message)

    if (duration !== undefined && (best === undefined || duration > best)) {
      best = duration
    }
  }

  return best
}
