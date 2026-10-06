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

// The turn from the expense-tracker test: the agent says what it is about to
// do between steps, and each note seals a bubble.
function talkingTurn(): ThreadMessage[] {
  const call = (toolCallId: string, toolName: string, args: Record<string, unknown>, result: unknown) => ({
    type: 'tool-call',
    toolCallId,
    toolName,
    args,
    argsText: JSON.stringify(args),
    result
  })

  const bubble = (id: string, content: unknown[], custom: Record<string, unknown>) =>
    ({
      id,
      role: 'assistant',
      content,
      status: { type: 'complete', reason: 'stop' },
      createdAt,
      metadata: { ...meta(), custom }
    }) as unknown as ThreadMessage

  return [
    userMessage('user-page', 'Make a simple expense page.'),
    bubble(
      'talk-a',
      [call('s1', 'skill_view', { name: 'web' }, { ok: true }), { type: 'text', text: 'I will create the file now.' }],
      { interim: true }
    ),
    bubble(
      'talk-b',
      [
        call('w1', 'write_file', { path: 'gastos/index.html' }, { inline_diff: '@@ -0,0 +1,1 @@\n+<html></html>' }),
        { type: 'text', text: 'File created. Opening it in the preview.' }
      ],
      { interim: true }
    ),
    bubble(
      'talk-c',
      [
        call('p1', 'open_preview', { url: 'file:///gastos/index.html' }, { ok: true }),
        call('d1', 'drive_preview', { action: 'click' }, { ok: true }),
        call('d2', 'drive_preview', { action: 'type' }, { ok: true }),
        { type: 'text', text: 'Done — the page works.' }
      ],
      { durationS: 92 }
    )
  ]
}

/** What the turn draws, top to bottom, by kind. */
function turnOrder(container: HTMLElement) {
  return [...container.querySelectorAll('[data-slot="aui_assistant-message-content"] > *')].map(element =>
    element.classList.contains('aui-md')
      ? 'prose'
      : `${element.getAttribute('data-slot')}${element.hasAttribute('data-under-sentence') ? ' (under)' : ''}`
  )
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

const SUMMARY = 'Explored 2 files, edited DuteLog-deck.pptx'

// An older turn: a later exchange follows it, so it folds on its own.
const olderTurn = (message: ThreadMessage) => [
  userMessage('user-deck', 'Make the deck.'),
  message,
  userMessage('user-ask', 'What is the answer?'),
  thoughtOnlyMessage()
]

describe('settled turn', () => {
  it('says what the turn did on its line and keeps the answer plus the files closer', async () => {
    const { container } = render(
      <ThreadRuntime messages={[settledWorkMessage()]}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText(SUMMARY)).toBeTruthy()
    expect(screen.getByText('18m')).toBeTruthy()
    expect(container.textContent).toContain('Here is the five-slide deck.')
    expect(container.textContent).toContain('Edited 1 file')
    expect(container.querySelector('[data-slot="aui_thinking-disclosure"]')).toBeNull()
    expect(container.querySelector('[data-slot="aui_turn-duration"]')).toBeNull()
  })

  it('keeps leftover seconds on the line', async () => {
    render(
      <ThreadRuntime messages={[settledWorkMessage(2 * 60 + 51)]}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('2m 51s')).toBeTruthy()
  })

  it('says a file the turn made was created, not edited', async () => {
    const message = settledWorkMessage(90) as unknown as { content: Record<string, unknown>[] }

    message.content[3] = {
      ...message.content[3],
      result: { inline_diff: 'a/deck.md → b/deck.md\n@@ -0,0 +1,2 @@\n+# Deck\n+Five slides.', path: 'deck.md' }
    }

    render(
      <ThreadRuntime messages={[message as unknown as ThreadMessage]}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Explored 2 files, created DuteLog-deck.pptx')).toBeTruthy()
  })

  it('keeps the newest turn open until the next message, in order', async () => {
    const { container } = render(
      <ThreadRuntime messages={[settledWorkMessage()]}>
        <Thread />
      </ThreadRuntime>
    )

    await screen.findByText(SUMMARY)

    const rows = [...container.querySelectorAll('[data-slot="aui_turn-work-list"] > *')]

    expect(rows.map(row => row.getAttribute('data-slot'))).toEqual([
      'aui_turn-thought',
      'tool-block',
      'tool-block',
      'tool-block'
    ])
    expect(container.textContent).toContain('logo.svg')
    expect(container.textContent).not.toContain('I will read the brand kit then write the deck.')

    fireEvent.click(screen.getByText('Thought'))

    await waitFor(() => {
      expect(container.textContent).toContain('I will read the brand kit then write the deck.')
    })
  })

  it('folds a turn once the next one starts, and opens on click', async () => {
    const { container } = render(
      <ThreadRuntime messages={olderTurn(settledWorkMessage())}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Forty-two.')).toBeTruthy()
    expect(container.querySelector('[data-slot="aui_turn-work-list"]')).toBeNull()

    fireEvent.click(screen.getByText(SUMMARY))

    await waitFor(() => {
      expect(container.querySelector('[data-slot="aui_turn-work-list"]')).not.toBeNull()
    })
  })

  it('keeps even the newest turn to its line in Compact', async () => {
    $activityDensity.set('compact')

    const { container } = render(
      <ThreadRuntime messages={[settledWorkMessage()]}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText(SUMMARY)).toBeTruthy()
    expect(container.querySelector('[data-slot="aui_turn-work-list"]')).toBeNull()
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
      <ThreadRuntime messages={olderTurn(settledWorkMessage())}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Forty-two.')).toBeTruthy()
    expect(await screen.findByText(SUMMARY)).toBeTruthy()
    expect(container.querySelector('[data-slot="aui_changed-files"]')).toBeNull()
    expect(container.textContent).not.toContain('Edited 1 file')
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

  it('reads the newest turn the way it ran: each sentence whole, the work after it on one line', async () => {
    const { container } = render(
      <ThreadRuntime messages={talkingTurn()}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Created index.html, used 4 tools')).toBeTruthy()
    expect(screen.getByText('Read skill')).toBeTruthy()
    expect(screen.getByText('Created index.html')).toBeTruthy()
    expect(screen.getByText('Opened preview, used the preview 2 times')).toBeTruthy()
    expect(turnOrder(container)).toEqual([
      'aui_worked-for',
      'aui_turn-group',
      'prose',
      'aui_turn-group (under)',
      'prose',
      'aui_turn-group (under)',
      'prose'
    ])
    expect(container.textContent).toContain('I will create the file now.')
    expect(container.textContent).toContain('Done — the page works.')
  })

  it('folds everything but the reply in Compact, and opens back into the sentences', async () => {
    $activityDensity.set('compact')

    const { container } = render(
      <ThreadRuntime messages={talkingTurn()}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Done — the page works.')).toBeTruthy()
    expect(turnOrder(container)).toEqual(['aui_worked-for', 'prose'])
    expect(container.textContent).not.toContain('I will create the file now.')

    fireEvent.click(screen.getByText('Created index.html, used 4 tools'))

    expect(await screen.findByText('I will create the file now.')).toBeTruthy()
    expect(screen.getByText('File created. Opening it in the preview.')).toBeTruthy()
  })

  it('counts a failed step on the line and keeps it in the work, not as a card', async () => {
    const message = settledWorkMessage(90) as unknown as { content: Record<string, unknown>[] }

    message.content[2] = { ...message.content[2], isError: true, result: { error: 'not found' } }

    const { container } = render(
      <ThreadRuntime messages={olderTurn(message as unknown as ThreadMessage)}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText(`${SUMMARY} · 1 step failed`)).toBeTruthy()
    expect(container.querySelector('[data-tool-row]')).toBeNull()
  })
})
