import { describe, expect, it } from 'vitest'

import {
  buildTurnTimeline,
  failedToolCount,
  finishedTools,
  latestThoughtTitle,
  segmentTurn,
  type TimelineItem,
  type TurnSegment
} from './turn-timeline'

const thought = (text: string) => ({ type: 'reasoning', text })
const text = (value: string) => ({ type: 'text', text: value })

const tool = (toolName: string, toolCallId: string, extra: Record<string, unknown> = {}) => ({
  result: 'ok',
  toolCallId,
  toolName,
  type: 'tool-call',
  ...extra
})

const bubble = (id: string, parts: unknown[], interim = false) => ({
  id,
  metadata: interim ? { custom: { interim: true } } : undefined,
  parts
})

const kinds = (items: readonly TimelineItem[]) => items.map(item => item.kind)

describe('buildTurnTimeline', () => {
  it('reads a turn spread over sealed bubbles as one list, in order', () => {
    const { answers, items } = buildTurnTimeline([
      { index: 3, message: bubble('a', [thought('**Checking the brief**'), text('Looking at the brief.')], true) },
      { index: 4, message: bubble('b', [tool('read_file', 't1'), thought('next'), tool('terminal', 't2')], true) },
      { index: 5, message: bubble('c', [tool('read_file', 't3'), text('Here is the summary.')]) }
    ])

    expect(kinds(items)).toEqual(['thought', 'note', 'tool', 'thought', 'tool', 'tool'])
    expect(items.map(item => item.key)).toEqual(['a:0', 'a:1', 't1', 'b:1', 't2', 't3'])
    expect(answers).toEqual([{ key: 'c:1', ref: { messageIndex: 5, partIndex: 1 } }])
  })

  it('points every row at the message and part it came from', () => {
    const { items } = buildTurnTimeline([
      { index: 7, message: bubble('a', [tool('read_file', 't1')], true) },
      { index: 9, message: bubble('b', [text('note'), tool('terminal', 't2')]) }
    ])

    expect(items).toMatchObject([
      { kind: 'tool', ref: { messageIndex: 7, partIndex: 0 } },
      { kind: 'note', ref: { messageIndex: 9, partIndex: 0 } },
      { kind: 'tool', ref: { messageIndex: 9, partIndex: 1 } }
    ])
  })

  it('merges reasoning that arrived in chunks into one thought, titled by its newest heading', () => {
    const { items } = buildTurnTimeline([
      {
        index: 0,
        message: bubble('a', [
          thought('**Reading the config**\nIt has two sections.'),
          tool('todo', 'silent'),
          thought('**Planning the summary**\nOne table per type.'),
          thought('Nothing new here.')
        ])
      }
    ])

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'thought', title: 'Planning the summary' })
    expect(items[0].kind === 'thought' && items[0].refs).toHaveLength(3)
    expect(items[0].kind === 'thought' && items[0].text).toContain('One table per type.')
  })

  it('starts a new thought after anything that shows on screen', () => {
    const { items } = buildTurnTimeline([
      { index: 0, message: bubble('a', [thought('one'), tool('read_file', 't1'), thought('two')]) }
    ])

    expect(kinds(items)).toEqual(['thought', 'tool', 'thought'])
  })

  it('keeps questions, images and delegation out of the list, as cards', () => {
    const { cards, items } = buildTurnTimeline([
      {
        index: 0,
        message: bubble('a', [tool('clarify', 'q1', { result: undefined }), tool('read_file', 't1')])
      },
      { index: 1, message: bubble('b', [tool('image_generate', 'i1'), tool('delegate_task', 'd1')]) }
    ])

    expect(cards.map(card => card.key)).toEqual(['q1', 'i1', 'd1'])
    expect(items.map(item => item.key)).toEqual(['t1'])
    // Each card remembers where it sat among the rows.
    expect(cards.map(card => card.at)).toEqual([0, 1, 1])
  })

  it('leaves silent calls out, but not the ones that failed', () => {
    const { items } = buildTurnTimeline([
      {
        index: 0,
        message: bubble('a', [
          tool('todo', 'quiet'),
          tool('todo', 'broken', { isError: true }),
          tool('read_file', 't1')
        ])
      }
    ])

    expect(items.map(item => item.key)).toEqual(['broken', 't1'])
  })

  it('keeps a failed edit and a failed command in the list, where the failure count finds them', () => {
    const { items } = buildTurnTimeline([
      {
        index: 0,
        message: bubble('a', [
          tool('terminal', 't1', { isError: true }),
          tool('write_file', 'w1', { isError: true }),
          tool('read_file', 't2'),
          text('done')
        ])
      }
    ])

    expect(items.map(item => item.key)).toEqual(['t1', 'w1', 't2'])
    expect(failedToolCount(finishedTools(items))).toBe(2)
  })

  it('treats all text on a sealed bubble as notes, even after its last call', () => {
    const { answers, items } = buildTurnTimeline([
      { index: 0, message: bubble('a', [tool('read_file', 't1'), text('Checked it.')], true) }
    ])

    expect(answers).toEqual([])
    expect(kinds(items)).toEqual(['tool', 'note'])
  })

  it('skips empty text and empty reasoning', () => {
    const { answers, items } = buildTurnTimeline([
      { index: 0, message: bubble('a', [thought('   '), text(''), tool('read_file', 't1'), text('  ')]) }
    ])

    expect(kinds(items)).toEqual(['tool'])
    expect(answers).toEqual([])
  })
})

describe('timeline readers', () => {
  const { items } = buildTurnTimeline([
    {
      index: 0,
      message: bubble(
        'a',
        [thought('**Scanning files**'), tool('read_file', 't1'), text('First pass done.'), thought('no heading')],
        true
      )
    },
    { index: 1, message: bubble('b', [tool('terminal', 't2', { result: undefined }), text('Second note.')], true) }
  ])

  it('counts only the calls that came back as finished', () => {
    expect(finishedTools(items).map(part => (part as { toolCallId: string }).toolCallId)).toEqual(['t1'])
  })

  it('finds the newest titled thought', () => {
    expect(latestThoughtTitle(items)).toBe('Scanning files')
    expect(latestThoughtTitle([])).toBe('')
  })
})

const shape = (segments: readonly TurnSegment[]) =>
  segments.map(segment =>
    segment.kind === 'work'
      ? `work[${segment.items.map(item => item.key).join(',')}]`
      : `${segment.kind}:${segment.key}`
  )

describe('segmentTurn', () => {
  it('reads each note as a sentence and the work after it as one line', () => {
    const timeline = buildTurnTimeline([
      {
        index: 0,
        message: bubble('a', [thought('**Plan**'), tool('skill_view', 's1'), text('Writing it now.')], true)
      },
      { index: 1, message: bubble('b', [tool('write_file', 'w1'), text('Saved. Opening it.')], true) },
      { index: 2, message: bubble('c', [thought('check'), tool('open_preview', 'p1'), text('Done.')]) }
    ])

    expect(shape(segmentTurn(timeline))).toEqual([
      'work[a:0,s1]',
      'sentence:a:2',
      'work[w1]',
      'sentence:b:1',
      'work[c:0,p1]'
    ])
    // The reply is not a sentence: it stays out of every line.
    expect(timeline.answers.map(answer => answer.key)).toEqual(['c:2'])
  })

  it('puts cards where they happened, between the lines around them', () => {
    const timeline = buildTurnTimeline([
      {
        index: 0,
        message: bubble('a', [tool('read_file', 't1'), tool('image_generate', 'i1'), tool('read_file', 't2')])
      }
    ])

    expect(shape(segmentTurn(timeline))).toEqual(['work[t1]', 'card:i1', 'work[t2]'])
  })

  it('leaves rows out without moving the cards', () => {
    const timeline = buildTurnTimeline([
      {
        index: 0,
        message: bubble('a', [tool('read_file', 't1'), tool('clarify', 'q1'), text('ok'), tool('read_file', 't2')])
      }
    ])

    expect(shape(segmentTurn(timeline, item => item.key === 't2'))).toEqual(['work[t1]', 'card:q1', 'sentence:a:2'])
    expect(shape(segmentTurn(timeline, () => true))).toEqual(['card:q1'])
  })

  it('keeps a line in place while rows land at its end', () => {
    const first = bubble('a', [tool('read_file', 't1')])
    const later = bubble('a', [tool('read_file', 't1'), thought('more'), tool('terminal', 't2')])

    const before = segmentTurn(buildTurnTimeline([{ index: 0, message: first }]))
    const after = segmentTurn(buildTurnTimeline([{ index: 0, message: later }]))

    expect(after.map(segment => segment.key)).toEqual(before.map(segment => segment.key))
  })

  // While the model drafts a call, the text before it is the newest prose and
  // reads as the reply. When the call arrives it becomes a sentence — under the
  // same key, so the prose on screen is moved, not torn down and redrawn.
  it('gives a sentence the key it had as the reply', () => {
    const drafting = buildTurnTimeline([{ index: 0, message: bubble('a', [text('Writing the file now.')]) }])

    const started = buildTurnTimeline([
      {
        index: 0,
        message: bubble('a', [text('Writing the file now.'), tool('write_file', 'w1', { result: undefined })])
      }
    ])

    expect(drafting.answers.map(answer => answer.key)).toEqual(['a:0'])
    expect(segmentTurn(started).map(segment => segment.key)).toContain('a:0')
  })
})
