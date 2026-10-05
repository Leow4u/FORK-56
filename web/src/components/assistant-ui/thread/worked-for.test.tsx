// @vitest-environment jsdom
import { type ThreadMessage } from '@assistant-ui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { $activityDensity } from '@/store/activity-density'
import { $toolDisclosureStates } from '@/store/tool-view'

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

function settledWorkMessage(durationS = 18 * 60): ThreadMessage {
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
    metadata: meta(durationS)
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
  $activityDensity.set('balanced')
  $toolDisclosureStates.set({})
})

afterEach(() => {
  cleanup()
  $activityDensity.set('balanced')
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

  it('keeps leftover seconds on the Worked-for line', async () => {
    render(
      <ThreadRuntime messages={[settledWorkMessage(2 * 60 + 51)]}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Worked for 2m 51s')).toBeTruthy()
  })

  it('expands the diary on click', async () => {
    const { container } = render(
      <ThreadRuntime messages={[settledWorkMessage()]}>
        <Thread />
      </ThreadRuntime>
    )

    fireEvent.click(await screen.findByText('Worked for 18m'))

    // One row per thought and call, in order — not a summary per run.
    await waitFor(() => {
      expect(container.textContent).toContain('logo.svg')
    })
    expect(container.textContent).toContain('colors.json')
    expect(container.textContent).not.toContain('Explored 2 files')
    expect(container.textContent).not.toContain('I will read the brand kit then write the deck.')

    fireEvent.click(screen.getByText('Thought'))

    await waitFor(() => {
      expect(container.textContent).toContain('I will read the brand kit then write the deck.')
    })
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

  it('draws the live block, not a staircase, while the turn is running', async () => {
    const { container } = render(
      <ThreadRuntime messages={[runningWorkMessage()]}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByRole('status', { name: 'Reading logo.svg' })).toBeTruthy()
    expect(container.querySelector('[data-tool-row]')).toBeNull()
    expect(container.querySelector('[data-slot="aui_worked-for"]')).toBeNull()
  })

  it('keeps the live staircase in Detailed', async () => {
    $activityDensity.set('detailed')

    const { container } = render(
      <ThreadRuntime messages={[runningWorkMessage()]}>
        <Thread />
      </ThreadRuntime>
    )

    await waitFor(() => {
      expect(container.querySelector('[data-tool-row]')).not.toBeNull()
    })
    expect(container.querySelector('[data-slot="aui_turn-now"]')).toBeNull()
  })

  it('counts a failed step on the line instead of leaving it as a card', async () => {
    const message = settledWorkMessage(90) as unknown as { content: Record<string, unknown>[] }

    message.content[2] = { ...message.content[2], isError: true, result: { error: 'not found' } }

    const { container } = render(
      <ThreadRuntime messages={[message as unknown as ThreadMessage]}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Worked for 1m 30s · 1 step failed')).toBeTruthy()
    expect(container.querySelector('[data-tool-row]')).toBeNull()
  })
})
