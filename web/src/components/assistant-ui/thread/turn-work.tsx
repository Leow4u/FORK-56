// @ts-nocheck — desktop parity port; web shims pending.
import { MessageByIndexProvider, PartByIndexProvider, useAuiState } from '@assistant-ui/react'
import { useStore } from '@nanostores/react'
import { type FC, useMemo } from 'react'

import { MarkdownText, MarkdownTextContent } from '@/components/assistant-ui/markdown-text'
import { ChainToolFallback } from '@/components/assistant-ui/thread/message-parts'
import { asToolPart, toolPartProps } from '@/components/assistant-ui/thread/turn-parts'
import { DisclosureRow } from '@/components/chat/disclosure-row'
import { SCAFFOLD_LABEL_CLASS, ScaffoldRow } from '@/components/chat/scaffold-row'
import { FadeText } from '@/components/ui/fade-text'
import { useI18n } from '@/i18n'
import { separateGluedReasoningBlocks } from '@/lib/reasoning-blocks'
import { messageContentParts, partText } from '@/lib/turn-fold'
import { noteLine, type PartRef, type TimelineItem, type TurnAnswer, type TurnCard } from '@/lib/turn-timeline'
import { cn } from '@/lib/utils'
import { $toolDisclosureOpen, setToolDisclosureOpen } from '@/store/tool-view'

/**
 * A turn's work, opened: every thought, call and note in the order it
 * happened, one line each. The same list sits behind the live block and behind
 * a settled turn's line, so opening either shows the same thing.
 *
 * Rows are drawn inside their OWN message, not the one hosting the list. A call
 * reads its message to know whether it is still running and to key its
 * disclosure, and a turn's calls are spread over every bubble it sealed.
 */
export const TurnWorkList: FC<{ items: readonly TimelineItem[] }> = ({ items }) => {
  const segments = useMemo(() => segmentByMessage(items), [items])

  return (
    <div className="grid min-w-0 max-w-full gap-(--tool-row-gap)" data-slot="aui_turn-work-list">
      {segments.map(segment => (
        <MessageByIndexProvider index={segment.messageIndex} key={segment.key}>
          {segment.items.map(item => (
            <WorkRow item={item} key={item.key} />
          ))}
        </MessageByIndexProvider>
      ))}
    </div>
  )
}

interface Segment {
  items: TimelineItem[]
  key: string
  messageIndex: number
}

function itemMessageIndex(item: TimelineItem): number {
  return item.kind === 'thought' ? (item.refs[0]?.messageIndex ?? 0) : item.ref.messageIndex
}

// Consecutive rows from one message share a provider. Keyed by the first row,
// so a row landing at the end of a segment leaves the segment where it is.
function segmentByMessage(items: readonly TimelineItem[]): Segment[] {
  const segments: Segment[] = []

  for (const item of items) {
    const messageIndex = itemMessageIndex(item)
    const last = segments.at(-1)

    if (last && last.messageIndex === messageIndex) {
      last.items.push(item)
    } else {
      segments.push({ items: [item], key: item.key, messageIndex })
    }
  }

  return segments
}

const WorkRow: FC<{ item: TimelineItem }> = ({ item }) => {
  if (item.kind === 'thought') {
    return <ThoughtRow item={item} />
  }

  if (item.kind === 'note') {
    return <NoteRow noteKey={item.key} text={item.text} />
  }

  return <ChainToolFallback {...toolPartProps(asToolPart(item.part))} />
}

/**
 * A thought, closed by default and named by its heading when the model gave
 * it one. Its text is read only once opened — reasoning is the longest thing
 * in a turn and nobody is reading it from here until they ask.
 */
const ThoughtRow: FC<{ item: Extract<TimelineItem, { kind: 'thought' }> }> = ({ item }) => {
  const { t } = useI18n()
  const disclosureId = `turn-thought:${item.key}`
  const open = useStore($toolDisclosureOpen(disclosureId)) ?? false

  return (
    <div
      className="text-[length:var(--conversation-tool-font-size)] text-(--ui-text-tertiary)"
      data-conversation-scaffold=""
      data-slot="aui_turn-thought"
    >
      <ScaffoldRow onToggle={() => setToolDisclosureOpen(disclosureId, !open)} open={open}>
        <FadeText className={cn(SCAFFOLD_LABEL_CLASS, 'truncate')}>
          {item.title ? t.assistant.thread.thoughtAbout(item.title) : t.assistant.thread.thought}
        </FadeText>
      </ScaffoldRow>
      {open && <ThoughtText refs={item.refs} />}
    </div>
  )
}

const ThoughtText: FC<{ refs: readonly PartRef[] }> = ({ refs }) => {
  // Live: a thought still streaming keeps growing here while it is open.
  const text = useAuiState(state =>
    refs
      .map(ref => partText(messageContentParts(state.thread.messages[ref.messageIndex] ?? {})[ref.partIndex]).trim())
      .filter(Boolean)
      .join('\n\n')
  )

  return (
    <div className="mt-0.5 w-full min-w-0 max-w-full overflow-hidden wrap-anywhere pb-1">
      <MarkdownTextContent
        containerClassName="text-xs leading-snug text-muted-foreground"
        disableArtifacts
        isRunning={false}
        text={separateGluedReasoningBlocks(text)}
      />
    </div>
  )
}

// Past this, a note no longer fits its line at the transcript's usual width.
const NOTE_LINE_CHARS = 90

/**
 * Something the agent said along the way, as one line in the transcript's
 * secondary ink — legible, but quieter than the reply. A note longer than its
 * line, or carrying structure a line can't hold, opens to the full text.
 */
export const NoteRow: FC<{ noteKey: string; text: string }> = ({ noteKey, text }) => {
  const disclosureId = `turn-note:${noteKey}`
  const open = useStore($toolDisclosureOpen(disclosureId)) ?? false
  const line = useMemo(() => noteLine(text), [text])
  const expandable = line.length > NOTE_LINE_CHARS || line !== text.trim()

  return (
    <div className="min-w-0 max-w-full text-[length:var(--conversation-tool-font-size)]" data-slot="aui_turn-note">
      <DisclosureRow onToggle={expandable ? () => setToolDisclosureOpen(disclosureId, !open) : undefined} open={open}>
        {expandable ? (
          <FadeText className="truncate leading-(--conversation-line-height) text-(--ui-text-secondary)">
            {line}
          </FadeText>
        ) : (
          <span className="wrap-anywhere leading-(--conversation-line-height) text-(--ui-text-secondary)">{line}</span>
        )}
      </DisclosureRow>
      {open && expandable && (
        <div className="mt-0.5 min-w-0 max-w-full pb-1">
          <MarkdownTextContent
            containerClassName="text-xs leading-snug text-(--ui-text-secondary)"
            disableArtifacts
            isRunning={false}
            text={text}
          />
        </div>
      )}
    </div>
  )
}

/** Questions, images, delegations and setup prompts — each in its own message. */
export const TurnCards: FC<{ cards: readonly TurnCard[] }> = ({ cards }) => (
  <>
    {cards.map(card => (
      <MessageByIndexProvider index={card.ref.messageIndex} key={card.key}>
        <ChainToolFallback {...toolPartProps(asToolPart(card.part))} />
      </MessageByIndexProvider>
    ))}
  </>
)

/**
 * The reply, rendered from its own part so it streams the way any reply does —
 * the block around it never sees the characters.
 */
export const TurnAnswers: FC<{ answers: readonly TurnAnswer[] }> = ({ answers }) => (
  <>
    {answers.map(answer => (
      <MessageByIndexProvider index={answer.ref.messageIndex} key={answer.key}>
        <PartByIndexProvider index={answer.ref.partIndex}>
          <MarkdownText />
        </PartByIndexProvider>
      </MessageByIndexProvider>
    ))}
  </>
)
