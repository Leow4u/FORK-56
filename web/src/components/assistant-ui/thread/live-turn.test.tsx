// @vitest-environment jsdom
import { type ThreadMessage } from '@assistant-ui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { $activityDensity } from '@/store/activity-density'
import { setSessionDraftingTool } from '@/store/tool-drafting'
import { $toolDisclosureStates } from '@/store/tool-view'

import { createdAt, stubThreadEnvironment, stubThreadViewportSize, ThreadRuntime, userMessage } from '../test-utils'

import { Thread } from '.'

stubThreadEnvironment()
stubThreadViewportSize()

const meta = (custom: Record<string, unknown> = {}) => ({
  unstable_state: null,
  unstable_annotations: [],
  unstable_data: [],
  steps: [],
  custom
})

const read = (id: string, path: string, done = true) => ({
  type: 'tool-call',
  toolCallId: id,
  toolName: 'read_file',
  args: { path },
  argsText: JSON.stringify({ path }),
  ...(done ? { result: { content: '...' } } : {})
})

const command = (id: string, cmd: string) => ({
  type: 'tool-call',
  toolCallId: id,
  toolName: 'terminal',
  args: { command: cmd },
  argsText: JSON.stringify({ command: cmd }),
  result: { exit_code: 0, output: '' }
})

// What a real multi-step turn looks like mid-flight: every note the agent
// writes seals a bubble, and the work goes on in the next one.
function sealedBubble(): ThreadMessage {
  return {
    id: 'turn-a',
    role: 'assistant',
    content: [
      { type: 'reasoning', text: '**Scanning the brief**\nStart with the brief.' },
      read('r1', '/docs/brief.md'),
      { type: 'text', text: 'Reading the brief first, then the notes.' }
    ],
    status: { type: 'complete', reason: 'stop' },
    createdAt,
    metadata: meta({ interim: true })
  } as unknown as ThreadMessage
}

function streamingBubble(content: unknown[]): ThreadMessage {
  return {
    id: 'turn-b',
    role: 'assistant',
    content,
    status: { type: 'running' },
    createdAt,
    metadata: meta()
  } as unknown as ThreadMessage
}

function liveTurn(content: unknown[] = [command('c1', 'ls docs'), read('r2', '/docs/notes.md', false)]) {
  return [userMessage('ask', 'Summarize the docs.'), sealedBubble(), streamingBubble(content)]
}

function renderTurn(messages: ThreadMessage[]) {
  return render(
    <ThreadRuntime messages={messages}>
      <Thread />
    </ThreadRuntime>
  )
}

/** The lines the block puts on screen for the work — not what the agent said. */
function workLines(container: HTMLElement) {
  return container.querySelectorAll(
    '[data-slot="aui_turn-group"] [data-tool-summary], [data-slot="aui_turn-thought"], [data-slot="aui_turn-now"] [role="status"], [data-tool-row], [data-slot="aui_thinking-disclosure"]'
  )
}

/** What the block draws, top to bottom, by kind. */
function blockOrder(container: HTMLElement) {
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
  setSessionDraftingTool(null, '')
})

describe('live block', () => {
  it('shows what the agent said as prose, with one line under it for the work after it', async () => {
    const { container } = renderTurn(liveTurn())

    expect(await screen.findByText('Explored brief.md')).toBeTruthy()
    expect(screen.getByText('Ran 1 command')).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Reading notes.md' })).toBeTruthy()
    // The sentence is prose, whole — not a line of activity text.
    expect(screen.getByText('Reading the brief first, then the notes.').closest('.aui-md')).not.toBeNull()
    expect(blockOrder(container)).toEqual(['aui_turn-group', 'prose', 'aui_turn-group (under)', 'aui_turn-now'])
    expect(container.querySelector('[data-tool-row]')).toBeNull()
    expect(container.querySelector('[data-slot="aui_thinking-disclosure"]')).toBeNull()
  })

  it('keeps the work between two sentences to its one line however long it runs', async () => {
    const many = Array.from({ length: 24 }, (_, index) =>
      index % 2 ? read(`r${index}`, `/docs/file-${index}.md`) : command(`c${index}`, `grep -n x file-${index}`)
    )

    const { container } = renderTurn(liveTurn([...many, { type: 'reasoning', text: 'Next, the summary.' }]))

    expect(await screen.findByText('Explored 12 files, ran 12 commands')).toBeTruthy()
    expect(workLines(container)).toHaveLength(3)
  })

  it('names what the model is thinking about, or says it is thinking', async () => {
    renderTurn(
      liveTurn([command('c1', 'ls docs'), { type: 'reasoning', text: '**Planning the table**\nOne row per type.' }])
    )

    expect(await screen.findByRole('status', { name: 'Planning the table' })).toBeTruthy()
    // Said once: the thought still arriving is the status line's, not a row too.
    expect(screen.queryByText('Thought · Planning the table')).toBeNull()
    cleanup()

    renderTurn([userMessage('ask', 'Hi'), streamingBubble([{ type: 'reasoning', text: 'Short question.' }])])

    expect(await screen.findByRole('status', { name: 'Thinking' })).toBeTruthy()
  })

  it('streams the reply under the block and says the turn is writing', async () => {
    renderTurn(liveTurn([command('c1', 'ls docs'), { type: 'text', text: 'The docs cover three areas.' }]))

    expect(await screen.findByText('The docs cover three areas.')).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Writing' })).toBeTruthy()
  })

  // While the model drafts a call, the prose before it is the newest text and
  // reads as the reply. The call arriving turns it into a sentence; it must not
  // vanish, jump or be redrawn on the way.
  it('keeps the prose where it is when the call it leads into arrives', async () => {
    const said = { type: 'text', text: 'Writing the file now.' }
    const { container, rerender } = renderTurn(liveTurn([command('c1', 'ls docs'), said]))
    // The prose block, not its paragraph: a paragraph is redrawn whenever its
    // part stops streaming, reply or sentence alike.
    const before = (await screen.findByText('Writing the file now.')).closest('.aui-md')

    expect(before).not.toBeNull()

    rerender(
      <ThreadRuntime
        messages={liveTurn([
          command('c1', 'ls docs'),
          said,
          {
            type: 'tool-call',
            toolCallId: 'w1',
            toolName: 'write_file',
            args: { path: '/docs/index.html' },
            argsText: '{}'
          }
        ])}
      >
        <Thread />
      </ThreadRuntime>
    )

    expect(await screen.findByRole('status', { name: 'Writing index.html' })).toBeTruthy()
    expect(screen.getByText('Writing the file now.').closest('.aui-md')).toBe(before)
    expect(blockOrder(container)).toEqual([
      'aui_turn-group',
      'prose',
      'aui_turn-group (under)',
      'prose',
      'aui_turn-now'
    ])
  })

  // A big file takes the model a while to write out, before the call starts and
  // names its file. The status line says what is being written in the meantime.
  it('says what the model is drafting before the call arrives, not a bare verb', async () => {
    setSessionDraftingTool(null, 'write_file')

    renderTurn(liveTurn([command('c1', 'ls docs'), { type: 'text', text: 'Writing the file now.' }]))

    expect(await screen.findByRole('status', { name: 'Writing file' })).toBeTruthy()
  })

  it('opens a line into its rows, in order', async () => {
    const { container } = renderTurn(liveTurn())

    fireEvent.click(await screen.findByText('Explored brief.md'))

    await waitFor(() => {
      expect(container.querySelectorAll('[data-tool-row]').length).toBe(1)
    })

    const rows = [...container.querySelectorAll('[data-slot="aui_turn-work-list"] > *')].map(
      row => row.getAttribute('data-slot') ?? ''
    )

    expect(rows).toEqual(['aui_turn-thought', 'tool-block'])
    expect(screen.getByText('Thought · Scanning the brief')).toBeTruthy()
    // The call still running stays on the status line, not in a line's rows.
    expect(screen.getByRole('status', { name: 'Reading notes.md' })).toBeTruthy()
  })

  it('keeps a question in the streaming bubble answerable from the block', async () => {
    const { container } = renderTurn(
      liveTurn([
        {
          type: 'tool-call',
          toolCallId: 'q1',
          toolName: 'clarify',
          args: { choices: ['staging', 'production'], question: 'Which deployment target?' },
          argsText: '{}'
        }
      ])
    )

    await waitFor(() => {
      expect(container.querySelector('[data-slot="clarify-inline"]')).not.toBeNull()
    })
    expect(container.querySelector('[data-tool-row]')).toBeNull()
  })

  it('counts failed steps on the line instead of showing them as cards', async () => {
    const failed = { ...command('c9', 'npm test'), isError: true, result: { error: 'exit 1' } }

    const { container } = renderTurn(liveTurn([failed, read('r2', '/docs/notes.md', false)]))

    expect(await screen.findByText('Ran 1 command · 1 step failed')).toBeTruthy()
    expect(container.querySelector('[data-tool-row]')).toBeNull()
  })

  // The two quieter levels differ only once the turn ends: Balanced leaves the
  // newest turn open, Compact folds it. While it runs, they read the same.
  it('reads the same in Compact while the turn runs', async () => {
    $activityDensity.set('compact')

    const { container } = renderTurn(liveTurn())

    expect(await screen.findByRole('status', { name: 'Reading notes.md' })).toBeTruthy()
    expect(screen.getByText('Reading the brief first, then the notes.')).toBeTruthy()
    expect(blockOrder(container)).toEqual(['aui_turn-group', 'prose', 'aui_turn-group (under)', 'aui_turn-now'])
  })
})

describe('live block, detailed', () => {
  it('shows every thought and call as it happens', async () => {
    $activityDensity.set('detailed')

    const { container } = renderTurn(liveTurn())

    await waitFor(() => {
      expect(container.querySelector('[data-slot="aui_thinking-disclosure"]')).not.toBeNull()
    })
    expect(container.querySelector('[data-tool-row]')).not.toBeNull()
    expect(container.querySelector('[data-slot="aui_turn-now"]')).toBeNull()
  })
})
