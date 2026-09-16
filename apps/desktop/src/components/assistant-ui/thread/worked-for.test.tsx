import { type ThreadMessage } from '@assistant-ui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { $toolDisclosureStates, $toolViewMode } from '@/store/tool-view'

import { stubThreadEnvironment, stubThreadViewportSize, ThreadRuntime, userMessage } from '../test-utils'
import { Thread } from '.'

const createdAt = new Date('2026-06-03T00:00:00.000Z')

stubThreadEnvironment()
stubThreadViewportSize()

function meta(durationS?: number) {
  return {
    unstable_state: null,
    unstable_annotations: [],
    unstable_data: [],
    steps: [],
    custom: durationS === undefined ? {} : { durationS }
  }
}

function settledWorkMessage(): ThreadMessage {
  return {
    id: 'assistant-folded',
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'I will read the brand kit then write the deck.' },
      {
        type: 'tool-call',
        toolCallId: 'read-1',
        toolName: 'read_file',
        args: { path: '/brand/logo.svg' },
        argsText: JSON.stringify({ path: '/brand/logo.svg' }),
        result: { content: '<svg />' }
      },
      {
        type: 'tool-call',
        toolCallId: 'read-2',
        toolName: 'read_file',
        args: { path: '/brand/colors.json' },
        argsText: JSON.stringify({ path: '/brand/colors.json' }),
        result: { content: '{}' }
      },
      {
        type: 'tool-call',
        toolCallId: 'write-1',
        toolName: 'write_file',
        args: { path: 'DuteLog-deck.pptx' },
        argsText: JSON.stringify({ path: 'DuteLog-deck.pptx' }),
        result: { path: 'DuteLog-deck.pptx' }
      },
      { type: 'text', text: 'Here is the five-slide deck.' }
    ],
    status: { type: 'complete', reason: 'stop' },
    createdAt,
    metadata: meta(18 * 60)
  } as unknown as ThreadMessage
}

function thoughtOnlyMessage(): ThreadMessage {
  return {
    id: 'assistant-thought',
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'A short question.' },
      { type: 'text', text: 'Forty-two.' }
    ],
    status: { type: 'complete', reason: 'stop' },
    createdAt,
    metadata: meta()
  } as unknown as ThreadMessage
}

function runningWorkMessage(): ThreadMessage {
  return {
    id: 'assistant-live',
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'read-live',
        toolName: 'read_file',
        args: { path: '/brand/logo.svg' },
        argsText: JSON.stringify({ path: '/brand/logo.svg' })
      }
    ],
    status: { type: 'running' },
    createdAt,
    metadata: meta()
  } as unknown as ThreadMessage
}

beforeEach(() => {
  $toolViewMode.set('product')
  $toolDisclosureStates.set({})
})

afterEach(() => {
  cleanup()
  $toolViewMode.set('product')
  $toolDisclosureStates.set({})
})

describe('product-mode settle fold', () => {
  it('collapses work into Worked-for and keeps the answer plus the files closer', async () => {
    const { container } = render(
      <ThreadRuntime messages={[settledWorkMessage()]}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Worked for 18m')).toBeTruthy()
    expect(container.textContent).toContain('Here is the five-slide deck.')
    expect(container.textContent).toContain('1 file changed')
    expect(container.textContent).toContain('DuteLog-deck.pptx')
    expect(container.textContent).not.toContain('Explored 2 files')
    expect(container.querySelector('[data-slot="aui_thinking-disclosure"]')).toBeNull()
    expect(container.querySelector('[data-slot="aui_turn-duration"]')).toBeNull()
  })

  it('expands the diary on click', async () => {
    const { container } = render(
      <ThreadRuntime messages={[settledWorkMessage()]}>
        <Thread />
      </ThreadRuntime>
    )

    fireEvent.click(await screen.findByText('Worked for 18m'))

    await waitFor(() => {
      expect(container.textContent).toContain('Explored 2 files')
    })
    expect(container.textContent).toContain('I will read the brand kit then write the deck.')
  })

  it('does not fold a thought-only reply', async () => {
    const { container } = render(
      <ThreadRuntime messages={[thoughtOnlyMessage()]}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Forty-two.')).toBeTruthy()
    expect(container.querySelector('[data-slot="aui_worked-for"]')).toBeNull()
    expect(container.querySelector('[data-slot="aui_thinking-disclosure"]')).toBeTruthy()
  })

  it('does not leave a files closer on a previous folded turn', async () => {
    const { container } = render(
      <ThreadRuntime
        messages={[
          userMessage('user-deck', 'Make the deck.'),
          settledWorkMessage(),
          userMessage('user-ask', 'What is the answer?'),
          thoughtOnlyMessage()
        ]}
      >
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Forty-two.')).toBeTruthy()
    expect(await screen.findByText('Worked for 18m')).toBeTruthy()
    expect(container.querySelector('[data-slot="aui_changed-files"]')).toBeNull()
    expect(container.textContent).not.toContain('1 file changed')
  })

  it('keeps the live staircase while the turn is running', async () => {
    const { container } = render(
      <ThreadRuntime messages={[runningWorkMessage()]}>
        <Thread />
      </ThreadRuntime>
    )

    await waitFor(() => {
      expect(container.querySelector('[data-tool-row]')).not.toBeNull()
    })
    expect(container.querySelector('[data-slot="aui_worked-for"]')).toBeNull()
  })
})
