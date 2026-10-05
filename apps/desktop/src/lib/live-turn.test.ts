import { describe, expect, it } from 'vitest'

import { buildLiveTurnModel, liveTurnMessages, liveTurnSignature } from './live-turn'

const thought = (text: string) => ({ type: 'reasoning', text })
const text = (value: string) => ({ type: 'text', text: value })

const tool = (toolName: string, toolCallId: string, extra: Record<string, unknown> = {}) => ({
  result: 'ok',
  toolCallId,
  toolName,
  type: 'tool-call',
  ...extra
})

const assistant = (id: string, parts: unknown[], extra: Record<string, unknown> = {}) => ({
  id,
  parts,
  role: 'assistant',
  ...extra
})

const sealed = (id: string, parts: unknown[]) => assistant(id, parts, { metadata: { custom: { interim: true } } })

describe('liveTurnMessages', () => {
  it('takes the host and the assistant messages after it, up to the next user message', () => {
    const messages = [
      { id: 'u1', role: 'user' },
      assistant('a1', []),
      { id: 'u2', role: 'user' },
      assistant('a2', []),
      { id: 's1', role: 'system' },
      assistant('a3', [])
    ]

    expect(liveTurnMessages(messages, 'a2').map(entry => [entry.index, entry.message.id])).toEqual([
      [3, 'a2'],
      [5, 'a3']
    ])
    expect(liveTurnMessages(messages, 'a1').map(entry => entry.message.id)).toEqual(['a1'])
    expect(liveTurnMessages(messages, 'missing')).toEqual([])
  })
})

describe('buildLiveTurnModel', () => {
  const turn = (messages: ReturnType<typeof assistant>[]) => messages.map((message, index) => ({ index, message }))

  const shape = (model: ReturnType<typeof buildLiveTurnModel>) =>
    model.segments.map(segment =>
      segment.kind === 'work'
        ? `work[${segment.items.map(item => item.key).join(',')}]`
        : `${segment.kind}:${segment.key}`
    )

  it('reads what was said, the work after each sentence and what is happening across bubbles', () => {
    const model = buildLiveTurnModel(
      turn([
        sealed('a', [thought('**Scanning the brief**'), tool('read_file', 'r1'), text('Reading the brief first.')]),
        sealed('b', [tool('terminal', 'c1', { isError: true }), text('That failed; retrying.')]),
        assistant('c', [tool('terminal', 'c2'), tool('write_file', 'w1', { result: undefined })])
      ])
    )

    // The call in flight is the status line's, not a row.
    expect(shape(model)).toEqual(['work[a:0,r1]', 'sentence:a:2', 'work[c1]', 'sentence:b:1', 'work[c2]'])
    expect(model.pending).toMatchObject({ part: { toolCallId: 'w1' }, ref: { messageIndex: 2, partIndex: 1 } })
    expect(model.thinkingAbout).toBe('Scanning the brief')
    expect(model.tail).toBe('other')
  })

  it('leaves the thought still arriving to the status line, and lists it once something follows', () => {
    const thinking = buildLiveTurnModel(
      turn([assistant('a', [tool('read_file', 'r1'), thought('**Planning the table**')])])
    )

    expect(shape(thinking)).toEqual(['work[r1]'])
    expect(thinking.thinkingAbout).toBe('Planning the table')

    const moved = buildLiveTurnModel(
      turn([assistant('a', [tool('read_file', 'r1'), thought('**Planning the table**'), tool('terminal', 'c1')])])
    )

    expect(shape(moved)).toEqual(['work[r1,a:1,c1]'])
  })

  it('narrates the newest call still running, past calls that already came back', () => {
    const model = buildLiveTurnModel(
      turn([
        assistant('a', [tool('read_file', 'r1', { result: undefined }), tool('read_file', 'r2'), tool('todo', 't')])
      ])
    )

    expect(model.pending?.ref).toEqual({ messageIndex: 0, partIndex: 0 })
  })

  it('does not narrate a call left without a result in a sealed bubble', () => {
    const model = buildLiveTurnModel(
      turn([sealed('a', [tool('read_file', 'r1', { result: undefined })]), assistant('b', [thought('next')])])
    )

    expect(model.pending).toBeNull()
    expect(model.tail).toBe('reasoning')
  })

  it('says the turn is writing when prose is the newest part', () => {
    const model = buildLiveTurnModel(turn([assistant('a', [tool('read_file', 'r1'), text('The brief says')])]))

    expect(model.tail).toBe('text')
    expect(model.answers).toEqual([{ key: 'a:1', ref: { messageIndex: 0, partIndex: 1 } }])
  })
})

describe('liveTurnSignature', () => {
  const signature = (parts: unknown[], extra: Record<string, unknown> = {}) =>
    liveTurnSignature([{ index: 0, message: assistant('a', parts, extra) }])

  it('ignores the answer streaming in, which renders on its own', () => {
    expect(signature([tool('read_file', 'r1'), text('The brief')])).toBe(
      signature([tool('read_file', 'r1'), text('The brief says the deck is due')])
    )
  })

  it('ignores reasoning growing under the same heading', () => {
    expect(signature([thought('**Planning**\nfirst')])).toBe(signature([thought('**Planning**\nfirst, then more')]))
  })

  it('changes when the turn changes shape', () => {
    const base = signature([tool('read_file', 'r1', { result: undefined })])

    expect(signature([tool('read_file', 'r1')])).not.toBe(base)
    expect(signature([tool('read_file', 'r1', { result: undefined }), text('x')])).not.toBe(base)
    expect(signature([tool('read_file', 'r1', { isError: true, result: undefined })])).not.toBe(base)
    expect(
      signature([tool('read_file', 'r1', { result: undefined })], { metadata: { custom: { interim: true } } })
    ).not.toBe(base)
    expect(signature([thought('**Planning**')])).not.toBe(signature([thought('**Planning**\n**Writing**')]))
  })
})
