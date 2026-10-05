import { describe, expect, it } from 'vitest'

import {
  buildTurnTimeline,
  failedToolCount,
  finishedTools,
  latestNote,
  latestThoughtTitle,
  noteLine,
  type TimelineItem
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

  it('finds the newest note and the newest titled thought', () => {
    expect(latestNote(items)?.text).toBe('Second note.')
    expect(latestThoughtTitle(items)).toBe('Scanning files')
    expect(latestNote([])).toBeNull()
    expect(latestThoughtTitle([])).toBe('')
  })
})

describe('noteLine', () => {
  it('reads markdown prose as one plain line', () => {
    expect(noteLine('## Plan\n\nI will **read** the `config` and\n- list [the files](http://x).')).toBe(
      'Plan I will read the config and list the files.'
    )
  })

  it('drops code blocks rather than flattening them into the line', () => {
    expect(noteLine('Running this:\n```sh\nnpm test\n```\nthen reporting.')).toBe('Running this: then reporting.')
  })

  it('leaves file names and lone asterisks alone', () => {
    expect(noteLine('Reading my_brand_kit.md output, 2 * 3 items')).toBe('Reading my_brand_kit.md output, 2 * 3 items')
  })
})
