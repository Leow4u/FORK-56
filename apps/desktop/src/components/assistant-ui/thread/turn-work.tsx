import { MessageByIndexProvider, PartByIndexProvider, useAuiState } from '@assistant-ui/react'
import { useStore } from '@nanostores/react'
import { type FC, useMemo } from 'react'

import { MarkdownText, MarkdownTextContent } from '@/components/assistant-ui/markdown-text'
import { ChainToolFallback } from '@/components/assistant-ui/thread/message-parts'
import { asToolPart, toolPartProps } from '@/components/assistant-ui/thread/turn-parts'
import { summarizeToolRun, type ToolCallLike } from '@/components/assistant-ui/tool/run-summary'
import { SCAFFOLD_LABEL_CLASS, ScaffoldRow } from '@/components/chat/scaffold-row'
import { FadeText } from '@/components/ui/fade-text'
import { useI18n } from '@/i18n'
import { separateGluedReasoningBlocks } from '@/lib/reasoning-blocks'
import { messageContentParts, partText } from '@/lib/turn-fold'
import {
  failedToolCount,
  finishedTools,
  type PartRef,
  type TimelineItem,
  type TurnAnswer,
  type TurnCard,
  type TurnSegment,
  type WorkItem
} from '@/lib/turn-timeline'
import { cn } from '@/lib/utils'
import { $toolDisclosureOpen, setToolDisclosureOpen } from '@/store/tool-view'

/**
 * A turn as it reads on screen: what the agent said along the way as prose,
 * whole and in order, and under each sentence one line for the work that came
 * after it — "Created index.html", "Opened preview, used the preview 3 times" —
 * which opens into the rows. Cards sit where they happened; the reply comes
 * last. The live block and an opened settled turn draw the same stream, so
 * what the user watched is what they find when they open it again.
 *
 * Sentences and the reply are one keyed list: the text before a call reads as
 * the reply until the call arrives and turns it into a sentence, and in one
 * list that is a move, not an unmount — the prose stays on screen.
 *
 * `openWork` draws the work as its rows instead of a line: for a settled turn
 * that said nothing along the way, whose own line already sums the work up.
 */
export const TurnStream: FC<{
  answers: readonly TurnAnswer[]
  openWork?: boolean
  segments: readonly TurnSegment[]
}> = ({ answers, openWork = false, segments }) => (
  <>
    {[
      ...segments.map((segment, index) => {
        if (segment.kind === 'sentence') {
          return <TurnProse at={segment.ref} key={segment.key} />
        }

        if (segment.kind === 'card') {
          return <TurnCardRow card={segment.card} key={segment.key} />
        }

        if (openWork) {
          return (
            <div className="grid min-w-0 max-w-full gap-(--tool-row-gap)" data-slot="aui_turn-group" key={segment.key}>
              <TurnWorkList items={segment.items} />
            </div>
          )
        }

        return (
          <WorkLine
            items={segment.items}
            key={segment.key}
            lineKey={segment.key}
            underSentence={segments[index - 1]?.kind === 'sentence'}
          />
        )
      }),
      ...answers.map(answer => <TurnProse at={answer.ref} key={answer.key} />)
    ]}
  </>
)

/**
 * Prose rendered from its own part, so it streams the way any reply does —
 * the block around it never sees the characters.
 */
const TurnProse: FC<{ at: PartRef }> = ({ at }) => (
  <MessageByIndexProvider index={at.messageIndex}>
    <PartByIndexProvider index={at.partIndex}>
      <MarkdownText />
    </PartByIndexProvider>
  </MessageByIndexProvider>
)

/** Questions, images, delegations and setup prompts — each in its own message. */
const TurnCardRow: FC<{ card: TurnCard }> = ({ card }) => (
  <MessageByIndexProvider index={card.ref.messageIndex}>
    <ChainToolFallback {...toolPartProps(asToolPart(card.part))} />
  </MessageByIndexProvider>
)

/**
 * The work between two sentences, as one line: what its calls did, in the
 * run-summary words, opening into every thought and call in order. Until a
 * call has come back there is nothing to sum up, and the thoughts stand on
 * their own.
 *
 * Under a sentence the line is that sentence's work: it sits close beneath it
 * and steps in (styles.css, `data-under-sentence`).
 */
const WorkLine: FC<{ items: readonly WorkItem[]; lineKey: string; underSentence: boolean }> = ({
  items,
  lineKey,
  underSentence
}) => {
  const { t } = useI18n()
  const disclosureId = `turn-line:${lineKey}`
  const open = useStore($toolDisclosureOpen(disclosureId)) ?? false

  const label = useMemo(() => {
    const finished = finishedTools(items)

    if (finished.length === 0) {
      return ''
    }

    const work = summarizeToolRun(finished as ToolCallLike[], false)
    const failed = failedToolCount(finished)

    if (failed === 0) {
      return work
    }

    return `${work} · ${failed === 1 ? t.assistant.tool.failedOne : t.assistant.tool.failedMany(failed)}`
  }, [items, t])

  const thoughts = useMemo(() => (label ? [] : items.filter(item => item.kind === 'thought')), [items, label])

  if (!label && thoughts.length === 0) {
    return null
  }

  return (
    <div
      className="grid min-w-0 max-w-full gap-(--tool-row-gap)"
      data-slot="aui_turn-group"
      data-under-sentence={underSentence ? '' : undefined}
    >
      {label ? (
        <>
          <div data-conversation-scaffold="" data-tool-summary="">
            <ScaffoldRow onToggle={() => setToolDisclosureOpen(disclosureId, !open)} open={open}>
              <FadeText className={cn(SCAFFOLD_LABEL_CLASS, 'truncate')}>{label}</FadeText>
            </ScaffoldRow>
          </div>
          {open && <TurnWorkList items={items} />}
        </>
      ) : (
        thoughts.map(item => <ThoughtRow item={item} key={item.key} />)
      )}
    </div>
  )
}

/**
 * A line of work, opened: every thought and call in the order it happened, one
 * row each.
 *
 * Rows are drawn inside their OWN message, not the one hosting the list. A call
 * reads its message to know whether it is still running and to key its
 * disclosure, and a turn's calls are spread over every bubble it sealed.
 */
const TurnWorkList: FC<{ items: readonly WorkItem[] }> = ({ items }) => {
  const segments = useMemo(() => segmentByMessage(items), [items])

  return (
    <div className="grid min-w-0 max-w-full gap-(--tool-row-gap)" data-slot="aui_turn-work-list">
      {segments.map(segment => (
        <MessageByIndexProvider index={segment.messageIndex} key={segment.key}>
          {segment.items.map(item =>
            item.kind === 'thought' ? (
              <ThoughtRow item={item} key={item.key} />
            ) : (
              <ChainToolFallback key={item.key} {...toolPartProps(asToolPart(item.part))} />
            )
          )}
        </MessageByIndexProvider>
      ))}
    </div>
  )
}

interface MessageRun {
  items: WorkItem[]
  key: string
  messageIndex: number
}

function itemMessageIndex(item: WorkItem): number {
  return item.kind === 'thought' ? (item.refs[0]?.messageIndex ?? 0) : item.ref.messageIndex
}

// Consecutive rows from one message share a provider. Keyed by the first row,
// so a row landing at the end of a run leaves the run where it is.
function segmentByMessage(items: readonly WorkItem[]): MessageRun[] {
  const runs: MessageRun[] = []

  for (const item of items) {
    const messageIndex = itemMessageIndex(item)
    const last = runs.at(-1)

    if (last && last.messageIndex === messageIndex) {
      last.items.push(item)
    } else {
      runs.push({ items: [item], key: item.key, messageIndex })
    }
  }

  return runs
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
