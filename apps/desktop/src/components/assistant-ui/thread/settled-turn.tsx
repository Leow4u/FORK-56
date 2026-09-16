import { useAuiState } from '@assistant-ui/react'
import { useStore } from '@nanostores/react'
import { type FC, type ReactNode, useRef } from 'react'

import { MarkdownTextContent } from '@/components/assistant-ui/markdown-text'
import { ChainToolFallback } from '@/components/assistant-ui/thread/message-parts'
import { WorkedForDisclosure } from '@/components/assistant-ui/thread/worked-for'
import { ToolFallback, splitRunItems } from '@/components/assistant-ui/tool/fallback'
import type { ToolPart } from '@/components/assistant-ui/tool/fallback-model'
import { summarizeToolRun } from '@/components/assistant-ui/tool/run-summary'
import { SCAFFOLD_LABEL_CLASS, ScaffoldRow } from '@/components/chat/scaffold-row'
import { FadeText } from '@/components/ui/fade-text'
import {
  assistantTurnSlice,
  classifiedByRole,
  classifyTurnParts,
  type FoldPart,
  isLastAssistantInTurn,
  isMessageInLastTurn,
  messageContentParts,
  messageDurationS,
  messageIsInterim,
  partText,
  partToolName,
  partType,
  shouldFoldTurn,
  turnDurationS
} from '@/lib/turn-fold'
import { cn } from '@/lib/utils'
import { $toolDisclosureOpen, setToolDisclosureOpen } from '@/store/tool-view'

const PASSTHROUGH = { kind: 'passthrough' } as const
const HIDE = { kind: 'hide' } as const

export type TurnFoldView =
  | typeof HIDE
  | typeof PASSTHROUGH
  | { classified: FoldPart[]; durationS?: number; kind: 'host'; parts: unknown[] }

type ThreadFoldMessage = {
  content: unknown
  id: string
  metadata?: { custom?: { durationS?: unknown; interim?: unknown } }
  parts?: unknown
  role: string
  status?: { type?: string }
}

function asToolPart(part: unknown): ToolPart {
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

function toolPartProps(part: ToolPart) {
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

function DiaryProse({ text }: { text: string }) {
  return (
    <div data-conversation-scaffold="" data-slot="aui_process-prose">
      <MarkdownTextContent
        containerClassName="text-xs leading-snug text-muted-foreground/85"
        disableArtifacts
        isRunning={false}
        text={text}
      />
    </div>
  )
}

function DiaryRun({ tools }: { tools: ToolPart[] }) {
  const disclosureId = `diary-run:${tools[0]?.toolCallId ?? tools[0]?.toolName ?? 'run'}`
  const persistedOpen = useStore($toolDisclosureOpen(disclosureId))
  const open = persistedOpen ?? false
  const summary = summarizeToolRun(tools, false)

  if (tools.length < 2) {
    return <ToolFallback {...toolPartProps(tools[0])} />
  }

  return (
    <div className="grid min-w-0 max-w-full gap-(--tool-row-gap)" data-slot="tool-block" data-tool-group="">
      <div data-conversation-scaffold="" data-tool-summary="">
        <ScaffoldRow onToggle={() => setToolDisclosureOpen(disclosureId, !open)} open={open}>
          <FadeText className={cn(SCAFFOLD_LABEL_CLASS, 'truncate')}>{summary}</FadeText>
        </ScaffoldRow>
      </div>
      {open
        ? tools.map(tool => <ToolFallback key={tool.toolCallId || tool.toolName} {...toolPartProps(tool)} />)
        : null}
    </div>
  )
}

function DiaryTools({ tools }: { tools: ToolPart[] }) {
  const items = splitRunItems(tools.map(tool => tool.toolName))

  return (
    <>
      {items.map(item =>
        item.kind === 'card' ? (
          <ToolFallback key={tools[item.index]?.toolCallId || item.index} {...toolPartProps(tools[item.index])} />
        ) : (
          <DiaryRun key={tools[item.start]?.toolCallId || item.start} tools={tools.slice(item.start, item.end + 1)} />
        )
      )}
    </>
  )
}

function renderDiary(entries: readonly FoldPart[]): ReactNode[] {
  const nodes: ReactNode[] = []
  let index = 0

  while (index < entries.length) {
    const part = entries[index].part
    const type = partType(part)

    if (type === 'reasoning') {
      const start = index
      const chunks: string[] = []

      while (index < entries.length && partType(entries[index].part) === 'reasoning') {
        const text = partText(entries[index].part).trim()

        if (text) {
          chunks.push(text)
        }

        index += 1
      }

      if (chunks.length > 0) {
        nodes.push(<DiaryProse key={`thought:${start}`} text={chunks.join('\n\n')} />)
      }

      continue
    }

    if (type === 'text') {
      const text = partText(part).trim()

      if (text) {
        nodes.push(<DiaryProse key={`text:${index}`} text={text} />)
      }

      index += 1
      continue
    }

    if (type === 'tool-call') {
      const start = index
      const tools: ToolPart[] = []

      while (index < entries.length && partType(entries[index].part) === 'tool-call') {
        tools.push(asToolPart(entries[index].part))
        index += 1
      }

      nodes.push(<DiaryTools key={`tools:${start}:${partToolName(part)}`} tools={tools} />)
      continue
    }

    index += 1
  }

  return nodes
}

export function useTurnFold(productMode: boolean): TurnFoldView {
  const cache = useRef<{ signature: string; value: TurnFoldView } | null>(null)

  return useAuiState(state => {
    if (!productMode) {
      return PASSTHROUGH
    }

    const message = state.message as ThreadFoldMessage
    const messages = state.thread.messages as unknown as ThreadFoldMessage[]
    const index = messages.findIndex(entry => entry.id === message.id)
    const roles = messages.map(entry => entry.role)
    const inLiveTurn = state.thread.isRunning && isMessageInLastTurn(roles, index)

    if (message.status?.type === 'running' || inLiveTurn) {
      return PASSTHROUGH
    }

    const assistants = assistantTurnSlice(messages, message.id)
    const signature = assistants
      .map(entry => `${entry.id}:${messageContentParts(entry).length}:${messageDurationS(entry) ?? ''}`)
      .join('|')

    if (cache.current?.signature === signature) {
      return cache.current.value
    }

    const classified: FoldPart[] = []
    const parts: unknown[] = []

    for (const assistant of assistants) {
      for (const entry of classifyTurnParts(messageContentParts(assistant), { interim: messageIsInterim(assistant) })) {
        classified.push(entry)
        parts.push(entry.part)
      }
    }

    if (!shouldFoldTurn(classified)) {
      cache.current = { signature, value: PASSTHROUGH }

      return PASSTHROUGH
    }

    const host = isLastAssistantInTurn(roles, index)
    const value: TurnFoldView = host
      ? { classified, durationS: turnDurationS(assistants), kind: 'host', parts }
      : HIDE

    cache.current = { signature, value }

    return value
  })
}

export const SettledProductTurn: FC<{
  classified: readonly FoldPart[]
  durationS?: number
  messageId: string
}> = ({ classified, durationS, messageId }) => {
  const disclosureId = `turn-work:${messageId}`
  const persistedOpen = useStore($toolDisclosureOpen(disclosureId))
  const open = persistedOpen ?? false
  const diary = classifiedByRole(classified, 'diary')
  const cards = classifiedByRole(classified, 'card')
  const answers = classifiedByRole(classified, 'answer')
    .map(entry => partText(entry.part).trim())
    .filter(Boolean)

  return (
    <>
      <WorkedForDisclosure
        durationS={durationS}
        onToggle={() => setToolDisclosureOpen(disclosureId, !open)}
        open={open}
      >
        {renderDiary(diary)}
      </WorkedForDisclosure>
      {cards.map((entry, index) => (
        <ChainToolFallback key={asToolPart(entry.part).toolCallId || `card:${index}`} {...toolPartProps(asToolPart(entry.part))} />
      ))}
      {answers.map((text, index) => (
        <MarkdownTextContent isRunning={false} key={`answer:${index}`} text={text} />
      ))}
    </>
  )
}
