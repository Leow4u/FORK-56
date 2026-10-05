import type { ToolFallback } from '@/components/assistant-ui/tool/fallback'
import type { ToolPart } from '@/components/assistant-ui/tool/fallback-model'

/**
 * A stored or live content part, read as a tool call. The turn views draw
 * calls lifted out of their bubbles, so they rebuild the props a bubble's own
 * part renderer would have been handed.
 */
export function asToolPart(part: unknown): ToolPart {
  const record = part && typeof part === 'object' ? (part as Record<string, unknown>) : {}

  return {
    args: record.args,
    completedAt: typeof record.completedAt === 'number' ? record.completedAt : undefined,
    isError: record.isError === true,
    result: record.result,
    timestamp: typeof record.timestamp === 'number' ? record.timestamp : undefined,
    toolCallId: typeof record.toolCallId === 'string' ? record.toolCallId : '',
    toolName: typeof record.toolName === 'string' ? record.toolName : '',
    type: 'tool-call'
  }
}

export function toolPartProps(part: ToolPart) {
  return {
    args: part.args ?? {},
    argsText: '',
    completedAt: part.completedAt,
    isError: Boolean(part.isError),
    result: part.result,
    timestamp: part.timestamp,
    toolCallId: part.toolCallId ?? '',
    toolName: part.toolName
  } as Parameters<typeof ToolFallback>[0]
}
