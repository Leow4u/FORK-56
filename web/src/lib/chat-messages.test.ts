import { describe, expect, it } from 'vitest'

import type { SessionMessage } from '@/types/work4you'

import { reasoningDetailsText, toChatMessages, withTurnDurations } from './chat-messages'

// The web chat hydrates sessions through the same parity copy of
// apps/desktop/src/lib/chat-messages; these pin the display-only data a reload
// has to bring back.

describe('reasoningDetailsText', () => {
  it('reads thinking, summaries and text out of the provider blocks', () => {
    expect(
      reasoningDetailsText(
        JSON.stringify([
          { signature: 'sig', thinking: 'Check the brief first.', type: 'thinking' },
          { summary: 'Then the notes.', type: 'reasoning.summary' },
          { text: 'And the deck.', type: 'reasoning.text' }
        ])
      )
    ).toBe('Check the brief first.\n\nThen the notes.\n\nAnd the deck.')
  })

  it('shows nothing for sealed blocks instead of their payload', () => {
    expect(reasoningDetailsText(JSON.stringify([{ data: 'EqQBCkgIARABGAIiQL', type: 'redacted_thinking' }]))).toBe('')
    expect(reasoningDetailsText([{ data: 'gAAAAABo', type: 'reasoning.encrypted' }])).toBe('')
  })

  it('keeps text that was never JSON', () => {
    expect(reasoningDetailsText('Plain reasoning text.')).toBe('Plain reasoning text.')
    expect(reasoningDetailsText(undefined)).toBe('')
  })

  it('hydrates a row whose only reasoning is a redacted block without a Thought', () => {
    const [message] = toChatMessages([
      {
        content: 'Done.',
        reasoning_details: JSON.stringify([{ data: 'EqQBCkgIARABGAIiQL', type: 'redacted_thinking' }]),
        role: 'assistant',
        timestamp: 1
      }
    ])

    expect(message.parts.some(part => part.type === 'reasoning')).toBe(false)
  })
})

describe('hydrating a file edit', () => {
  const turn = (displayMetadata?: unknown): SessionMessage[] => [
    { content: 'write the summary', role: 'user', timestamp: 1 },
    {
      content: '',
      role: 'assistant',
      timestamp: 2,
      tool_calls: [
        { function: { arguments: '{"path":"resumo.md"}', name: 'write_file' }, id: 'call-1', type: 'function' }
      ]
    },
    {
      content: '{"bytes_written":9}',
      display_metadata: displayMetadata as never,
      role: 'tool',
      timestamp: 3,
      tool_call_id: 'call-1',
      tool_name: 'write_file'
    }
  ]

  const writeResult = (messages: SessionMessage[]) => {
    const part = toChatMessages(messages)
      .flatMap(message => message.parts)
      .find(part => part.type === 'tool-call')

    return (part as { result?: Record<string, unknown> } | undefined)?.result
  }

  it('brings back the diff the row kept, as the live event carried it', () => {
    expect(writeResult(turn({ inline_diff: '+# Resumo' }))).toEqual({ bytes_written: 9, inline_diff: '+# Resumo' })
    expect(writeResult(turn(JSON.stringify({ inline_diff: '+# Resumo' })))?.inline_diff).toBe('+# Resumo')
  })

  it('leaves a row without one as it was', () => {
    expect(writeResult(turn())).toEqual({ bytes_written: 9 })
    expect(writeResult(turn({ reactions: [] }))).toEqual({ bytes_written: 9 })
  })
})

describe('reloaded turn durations', () => {
  const tool = (id: string, ts: number): SessionMessage[] => [
    {
      content: '',
      role: 'assistant',
      timestamp: ts,
      tool_calls: [{ function: { arguments: '{"path":"a.md"}', name: 'read_file' }, id, type: 'function' }]
    },
    { content: '{"content":"x"}', role: 'tool', timestamp: ts + 1, tool_call_id: id, tool_name: 'read_file' }
  ]

  it('runs from the user message to the last thing the turn wrote', () => {
    const messages = toChatMessages([
      { content: 'summarize', role: 'user', timestamp: 100 },
      ...tool('call-1', 110),
      { content: 'Here it is.', role: 'assistant', timestamp: 190 },
      { content: 'thanks', role: 'user', timestamp: 300 },
      { content: 'Anytime.', role: 'assistant', timestamp: 302 }
    ])

    const assistants = messages.filter(message => message.role === 'assistant')

    expect(assistants.at(0)?.durationS).toBe(90)
    expect(assistants.at(-1)?.durationS).toBe(2)
    expect(messages.filter(message => message.role === 'user').every(message => message.durationS === undefined)).toBe(
      true
    )
  })

  it('says nothing when the stamps cannot tell', () => {
    const messages = withTurnDurations([
      { id: 'a', parts: [], role: 'assistant', timestamp: 5 },
      { id: 'u', parts: [], role: 'user', timestamp: 10 },
      { id: 'b', parts: [], role: 'assistant', timestamp: 10 }
    ])

    expect(messages.map(message => message.durationS)).toEqual([undefined, undefined, undefined])
  })

  it('keeps a duration the live view measured', () => {
    const [, assistant] = withTurnDurations([
      { id: 'u', parts: [], role: 'user', timestamp: 10 },
      { durationS: 42, id: 'b', parts: [], role: 'assistant', timestamp: 100 }
    ])

    expect(assistant.durationS).toBe(42)
  })
})
