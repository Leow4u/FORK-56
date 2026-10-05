import { type ThreadMessage } from '@assistant-ui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { $activityDensity } from '@/store/activity-density'
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

/** The lines the block puts on screen for the work — not the reply. */
function workLines(container: HTMLElement) {
  return container.querySelectorAll(
    '[data-slot="aui_turn-work"] [data-tool-summary], [data-slot="aui_turn-note"], [data-slot="aui_turn-now"] [role="status"], [data-tool-row], [data-slot="aui_thinking-disclosure"]'
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

describe('live block, balanced', () => {
  it('shows what is done, the newest note and what is happening now — nothing else', async () => {
    const { container } = renderTurn(liveTurn())

    expect(await screen.findByText('Explored brief.md, ran 1 command')).toBeTruthy()
    expect(screen.getByText('Reading the brief first, then the notes.')).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Reading notes.md' })).toBeTruthy()
    expect(container.querySelector('[data-tool-row]')).toBeNull()
    expect(container.querySelector('[data-slot="aui_thinking-disclosure"]')).toBeNull()
    expect(workLines(container)).toHaveLength(3)
  })

  it('stays at the same few lines however long the turn runs', async () => {
    const many = Array.from({ length: 24 }, (_, index) =>
      index % 2 ? read(`r${index}`, `/docs/file-${index}.md`) : command(`c${index}`, `grep -n x file-${index}`)
    )

    const { container } = renderTurn(liveTurn([...many, { type: 'reasoning', text: 'Next, the summary.' }]))

    expect(await screen.findByText('Explored 13 files, ran 12 commands')).toBeTruthy()
    expect(workLines(container).length).toBeLessThanOrEqual(4)
  })

  it('names what the model is thinking about, or says it is thinking', async () => {
    renderTurn(
      liveTurn([command('c1', 'ls docs'), { type: 'reasoning', text: '**Planning the table**\nOne row per type.' }])
    )

    expect(await screen.findByRole('status', { name: 'Planning the table' })).toBeTruthy()
    cleanup()

    renderTurn([userMessage('ask', 'Hi'), streamingBubble([{ type: 'reasoning', text: 'Short question.' }])])

    expect(await screen.findByRole('status', { name: 'Thinking' })).toBeTruthy()
  })

  it('streams the reply under the block and says the turn is writing', async () => {
    renderTurn(liveTurn([command('c1', 'ls docs'), { type: 'text', text: 'The docs cover three areas.' }]))

    expect(await screen.findByText('The docs cover three areas.')).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Writing' })).toBeTruthy()
  })

  it('opens into the whole turn, in order, one row per thought, call and note', async () => {
    const { container } = renderTurn(liveTurn())

    fireEvent.click(await screen.findByText('Explored brief.md, ran 1 command'))

    await waitFor(() => {
      expect(container.querySelectorAll('[data-tool-row]').length).toBe(2)
    })

    const rows = [...container.querySelectorAll('[data-slot="aui_turn-work-list"] > *')].map(
      row => row.getAttribute('data-slot') ?? ''
    )

    // The call still running stays on the status line, not in the list.
    expect(rows).toEqual(['aui_turn-thought', 'tool-block', 'aui_turn-note', 'tool-block'])
    expect(screen.getByRole('status', { name: 'Reading notes.md' })).toBeTruthy()
    expect(screen.getByText('Thought · Scanning the brief')).toBeTruthy()
    // The note now sits in the list, in its place, instead of under the block.
    expect(container.querySelectorAll('[data-slot="aui_turn-note"]')).toHaveLength(1)
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

    expect(await screen.findByText('Explored brief.md, ran 1 command · 1 step failed')).toBeTruthy()
    expect(container.querySelector('[data-tool-row]')).toBeNull()
  })
})

describe('live block, compact', () => {
  it('is one line until opened', async () => {
    $activityDensity.set('compact')

    const { container } = renderTurn(liveTurn())

    expect(await screen.findByRole('status', { name: 'Reading notes.md' })).toBeTruthy()
    expect(container.querySelector('[data-slot="aui_turn-note"]')).toBeNull()
    expect(container.textContent).not.toContain('ran 1 command')
    expect(workLines(container)).toHaveLength(1)

    fireEvent.click(screen.getByText('Reading notes.md'))

    await waitFor(() => {
      expect(container.querySelectorAll('[data-tool-row]').length).toBe(2)
    })
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
