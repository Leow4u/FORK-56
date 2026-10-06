import { type ThreadMessage } from '@assistant-ui/react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { stubThreadEnvironment, stubThreadViewportSize, ThreadRuntime, userMessage } from '../test-utils'

import { Thread } from '.'

stubThreadEnvironment()
stubThreadViewportSize()

afterEach(() => {
  cleanup()
})

const createdAt = new Date('2026-10-05T12:00:00.000Z')

function reply(id: string, text: string, options: { durationS?: number; running?: boolean } = {}): ThreadMessage {
  return {
    id,
    role: 'assistant',
    content: [{ type: 'text', text }],
    status: options.running ? { type: 'running' } : { type: 'complete', reason: 'stop' },
    createdAt,
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: options.durationS === undefined ? {} : { durationS: options.durationS }
    }
  } as unknown as ThreadMessage
}

async function footers(container: HTMLElement, count: number): Promise<HTMLElement[]> {
  return waitFor(() => {
    const rows = [...container.querySelectorAll<HTMLElement>('[data-slot="aui_msg-footer"]')]

    expect(rows).toHaveLength(count)

    return rows
  })
}

describe('the row under a reply', () => {
  it('stays on screen for the newest settled reply only', async () => {
    const { container } = render(
      <ThreadRuntime
        messages={[
          userMessage('u1', 'primeira'),
          reply('a1', 'resposta um', { durationS: 9 }),
          userMessage('u2', 'segunda'),
          reply('a2', 'resposta dois', { durationS: 4 })
        ]}
      >
        <Thread />
      </ThreadRuntime>
    )

    const [older, newest] = await footers(container, 2)

    expect(older.hasAttribute('data-pinned')).toBe(false)
    expect(newest.hasAttribute('data-pinned')).toBe(true)
  })

  it('is not pinned while the newest reply is still running', async () => {
    const { container } = render(
      <ThreadRuntime messages={[userMessage('u1', 'primeira'), reply('a1', 'escrevendo…', { running: true })]}>
        <Thread />
      </ThreadRuntime>
    )

    await screen.findByText('escrevendo…')

    for (const row of container.querySelectorAll('[data-slot="aui_msg-footer"]')) {
      expect(row.hasAttribute('data-pinned')).toBe(false)
    }
  })

  // Claude's order: what you can do with the reply, then how long it took.
  it('puts how long the reply took after its actions', async () => {
    const { container } = render(
      <ThreadRuntime messages={[userMessage('u1', 'primeira'), reply('a1', 'resposta um', { durationS: 9 })]}>
        <Thread />
      </ThreadRuntime>
    )

    const [row] = await footers(container, 1)
    const copy = within(row).getByRole('button', { name: 'Copy' })
    const duration = row.querySelector('[data-slot="aui_turn-duration"]')

    expect(duration).toBeTruthy()
    expect(copy.compareDocumentPosition(duration!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
