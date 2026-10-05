// @vitest-environment jsdom
import { type ThreadMessage } from '@assistant-ui/react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { $activeSessionId } from '@/store/session'
import { $activityDensity } from '@/store/activity-density'
import { $toolDisclosureStates } from '@/store/tool-view'

import { createdAt, stubThreadEnvironment, stubThreadViewportSize, ThreadRuntime } from '../test-utils'
import { Thread } from '../thread'

stubThreadEnvironment()
stubThreadViewportSize()

const call = (toolCallId: string, toolName: string, args: Record<string, unknown>, result?: unknown) => ({
  type: 'tool-call',
  toolCallId,
  toolName,
  args,
  argsText: JSON.stringify(args),
  ...(result === undefined ? {} : { result })
})

// A settled turn as the web chat receives it: a run of reads with a todo update
// riding along, then the file the turn wrote — persisted without its diff.
function settledTurn(): ThreadMessage {
  return {
    id: 'assistant-web-run',
    role: 'assistant',
    content: [
      call('read-1', 'read_file', { path: '/repo/a.ts' }, { content: 'a' }),
      call('read-2', 'read_file', { path: '/repo/b.ts' }, { content: 'b' }),
      call('todo-1', 'todo', { todos: [] }, { todos: [] }),
      { type: 'text', text: 'Writing the report now.' },
      call('write-1', 'write_file', { path: '/repo/report.html' }, { path: '/repo/report.html', bytes_written: 15 })
    ],
    status: { type: 'complete', reason: 'stop' },
    createdAt,
    metadata: { unstable_state: null, unstable_annotations: [], unstable_data: [], steps: [], custom: {} }
  } as unknown as ThreadMessage
}

beforeEach(() => {
  $activeSessionId.set('web-session')
  $toolDisclosureStates.set({})
  $activityDensity.set('detailed')
})

afterEach(() => {
  cleanup()
  $activeSessionId.set(null)
  $activityDensity.set('balanced')
})

describe('the web chat transcript', () => {
  // The ported row reads its dismiss label from a desktop section the web
  // catalog did not carry; the first finished tool call threw and broke the
  // transcript instead of drawing a line.
  it('renders the lines of a settled turn', async () => {
    const { container } = render(
      <ThreadRuntime messages={[settledTurn()]}>
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByText('Explored 2 files')).toBeTruthy()

    await waitFor(() => {
      expect(container.querySelector('[data-tool-row]')?.textContent).toContain('report.html')
    })
  })
})
