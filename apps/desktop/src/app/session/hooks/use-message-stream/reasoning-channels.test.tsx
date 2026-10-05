import { act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChatMessage } from '@/lib/chat-messages'
import { clearSessionTodos } from '@/store/todos'

import { type MessageStreamHarness, renderMessageStream } from './test-harness'

const SID = 'session-1'

let stream: MessageStreamHarness

const send = (type: string, payload: Record<string, unknown> = {}) =>
  act(() => stream.handleEvent({ payload, session_id: SID, type } as never))

function assistants(): ChatMessage[] {
  return stream.state().messages.filter(message => message.role === 'assistant' && !message.hidden)
}

function partsOf(type: string): string[] {
  return assistants().flatMap(message =>
    message.parts.flatMap(part => (part.type === type && 'text' in part ? [String(part.text)] : []))
  )
}

// reasoning.available is emitted with the step's VISIBLE content (the backend's
// `assistant_message.content`), after that step's deltas and before its seal.
describe('useMessageStream reasoning channels', () => {
  afterEach(() => {
    cleanup()
    clearSessionTodos(SID)
    vi.restoreAllMocks()
  })

  it('keeps streamed reasoning when the step text arrives as reasoning.available', async () => {
    stream = renderMessageStream(SID)
    await send('message.start')
    await send('reasoning.delta', { text: 'The user wants the brief summarized.' })
    // Text after a tool call is not streamed, so the bubble has no text yet.
    await send('reasoning.available', { text: 'Reading the brief first.' })
    await send('tool.start', { args: {}, name: 'read_file', tool_id: 'call-1' })

    expect(partsOf('reasoning')).toEqual(['The user wants the brief summarized.'])
  })

  it('never files the reply as reasoning', async () => {
    stream = renderMessageStream(SID)
    await send('message.start')
    await send('reasoning.available', { text: 'Reading the brief first.' })
    await send('message.interim', { already_streamed: false, text: 'Reading the brief first.' })
    await send('message.complete', { text: 'Here is the summary.' })

    expect(partsOf('reasoning')).toEqual([])
    expect(partsOf('text')).toEqual(['Reading the brief first.', 'Here is the summary.'])
  })
})
