import { describe, expect, it } from 'vitest'

import {
  assistantTurnSlice,
  classifyTurnParts,
  formatWorkedDuration,
  isLastAssistantInTurn,
  isMessageInLastTurn,
  lastAnswerBoundaryIndex,
  shouldFoldTurn,
  workedForLabel
} from './turn-fold'

const thought = (text: string) => ({ type: 'reasoning', text })
const text = (value: string) => ({ type: 'text', text: value })
const tool = (toolName: string, extra: Record<string, unknown> = {}) => ({
  type: 'tool-call',
  toolName,
  ...extra
})

const copy = {
  worked: 'Worked',
  workedFor: (duration: string) => `Worked for ${duration}`
}

describe('lastAnswerBoundaryIndex', () => {
  it('treats text after the last real tool as the answer', () => {
    const parts = [thought('plan'), tool('read_file'), text('looking'), tool('search_files'), text('done')]

    expect(lastAnswerBoundaryIndex(parts)).toBe(3)
    expect(classifyTurnParts(parts).map(entry => entry.role)).toEqual(['diary', 'diary', 'diary', 'diary', 'answer'])
  })

  it('keeps every text part as process talk on an interim bubble', () => {
    const parts = [tool('read_file'), text('checking the brand kit')]

    expect(classifyTurnParts(parts, { interim: true }).map(entry => entry.role)).toEqual(['diary', 'diary'])
  })

  it('ignores silent tools when finding the answer boundary', () => {
    const parts = [tool('read_file'), text('answer'), tool('todo'), text('still the answer')]

    expect(lastAnswerBoundaryIndex(parts)).toBe(0)
    expect(classifyTurnParts(parts).map(entry => entry.role)).toEqual(['diary', 'answer', 'silent', 'answer'])
  })
})

describe('classifyTurnParts', () => {
  it('keeps clarify, images, delegation and errors on the transcript', () => {
    const parts = [
      tool('clarify'),
      tool('read_file'),
      tool('write_file'),
      tool('image_generate'),
      tool('terminal', { isError: true }),
      text('here is the deck')
    ]

    expect(classifyTurnParts(parts).map(entry => entry.role)).toEqual([
      'card',
      'diary',
      'diary',
      'card',
      'card',
      'answer'
    ])
  })

  it('does not fold a thought-only reply', () => {
    const classified = classifyTurnParts([thought('The user asked a short question.'), text('42')])

    expect(shouldFoldTurn(classified)).toBe(false)
    expect(classified.map(entry => entry.role)).toEqual(['diary', 'answer'])
  })

  it('folds a turn that ran tools or spoke process prose', () => {
    expect(shouldFoldTurn(classifyTurnParts([tool('read_file'), text('done')]))).toBe(true)
    expect(shouldFoldTurn(classifyTurnParts([text('let me look'), tool('read_file'), text('done')]))).toBe(true)
    expect(shouldFoldTurn(classifyTurnParts([thought('plan'), text('just an answer')]))).toBe(false)
  })
})

describe('workedForLabel', () => {
  it('uses a compact clock once the turn lasted a second', () => {
    expect(formatWorkedDuration(18 * 60)).toBe('18m')
    expect(formatWorkedDuration(45)).toBe('45s')
    expect(formatWorkedDuration(2 * 3600)).toBe('2h')
    expect(formatWorkedDuration(2 * 3600 + 10 * 60)).toBe('2h 10m')
    expect(workedForLabel(18 * 60, copy)).toBe('Worked for 18m')
    expect(workedForLabel(undefined, copy)).toBe('Worked')
    expect(workedForLabel(0.4, copy)).toBe('Worked')
  })
})

describe('turn geometry', () => {
  it('treats everything after the last user message as the open turn', () => {
    expect(isMessageInLastTurn(['user', 'assistant', 'user', 'assistant', 'assistant'], 3)).toBe(true)
    expect(isMessageInLastTurn(['user', 'assistant', 'user', 'assistant'], 1)).toBe(false)
  })

  it('names the last assistant bubble as the fold host', () => {
    const roles = ['user', 'assistant', 'assistant', 'user', 'assistant']

    expect(isLastAssistantInTurn(roles, 1)).toBe(false)
    expect(isLastAssistantInTurn(roles, 2)).toBe(true)
    expect(isLastAssistantInTurn(roles, 4)).toBe(true)
  })

  it('slices the assistant bubbles that belong to one user turn', () => {
    const messages = [
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' },
      { id: 'a2', role: 'assistant' },
      { id: 'u2', role: 'user' },
      { id: 'a3', role: 'assistant' }
    ]

    expect(assistantTurnSlice(messages, 'a2').map(message => message.id)).toEqual(['a1', 'a2'])
    expect(assistantTurnSlice(messages, 'a3').map(message => message.id)).toEqual(['a3'])
  })
})
