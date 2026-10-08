import { type ThreadMessage } from '@assistant-ui/react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as ReviewStore from '@/store/review'
import { openReviewForPath, revealCurrentReview } from '@/store/review'

import { stubThreadEnvironment, stubThreadViewportSize, ThreadRuntime, userMessage } from '../test-utils'

import { Thread } from '.'

vi.mock('@/store/review', async importOriginal => ({
  ...(await importOriginal<typeof ReviewStore>()),
  openReviewForPath: vi.fn(async () => undefined),
  revealCurrentReview: vi.fn()
}))

stubThreadEnvironment()
stubThreadViewportSize()

afterEach(() => {
  cleanup()
  vi.mocked(openReviewForPath).mockClear()
  vi.mocked(revealCurrentReview).mockClear()
})

const call = (toolCallId: string, toolName: string, args: Record<string, unknown>, result: unknown) => ({
  type: 'tool-call',
  toolCallId,
  toolName,
  args,
  argsText: JSON.stringify(args),
  result
})

// A page written whole (its diff kept only in part, its counts whole) and a
// two-line patch to a script.
function editedTurn(): ThreadMessage {
  return {
    id: 'assistant-edits',
    role: 'assistant',
    content: [
      call(
        'write-page',
        'write_file',
        { path: 'site/index.html' },
        { diff_stats: { added: 300, removed: 0 }, inline_diff: '@@ -0,0 +1,300 @@\n+<p>0</p>' }
      ),
      call(
        'patch-app',
        'patch',
        { path: 'site/app.js' },
        { inline_diff: '@@ -1,2 +1,3 @@\n-let a\n+let a = 1\n+let b = 2\n x()' }
      ),
      { type: 'text', text: 'The page is ready.' }
    ],
    status: { type: 'complete', reason: 'stop' },
    createdAt: new Date('2026-10-06T00:00:00.000Z'),
    metadata: { unstable_state: null, unstable_annotations: [], unstable_data: [], steps: [], custom: {} }
  } as unknown as ThreadMessage
}

async function renderCard() {
  const view = render(
    <ThreadRuntime messages={[userMessage('user-page', 'Make the page.'), editedTurn()]}>
      <Thread />
    </ThreadRuntime>
  )

  const card = await view
    .findByText('Files edited in this response (2)')
    .then(title => title.closest('[data-slot="aui_changed-files"]'))

  return { card: card as HTMLElement, container: view.container }
}

const rowFor = (card: HTMLElement, label: string) => within(card).getByText(label).closest('button') as HTMLElement

describe('the changed-files card', () => {
  it('totals the turn and gives each file its lines, both sides even at zero', async () => {
    const { card } = await renderCard()

    expect(card.querySelector('[data-slot="aui_changed-files-summary"]')?.textContent).toContain('+302')
    expect(card.querySelector('[data-slot="aui_changed-files-summary"]')?.textContent).toContain('−1')
    expect(rowFor(card, 'index.html').textContent).toContain('+300')
    expect(rowFor(card, 'index.html').textContent).toContain('−0')
    expect(rowFor(card, 'app.js').textContent).toContain('+2')
    expect(rowFor(card, 'app.js').textContent).toContain('−1')
  })

  it('sits under the reply and above its actions', async () => {
    const { card, container } = await renderCard()
    const prose = screen.getByText('The page is ready.')
    const actions = container.querySelector('[data-slot="aui_msg-footer"]')

    expect(actions).toBeTruthy()
    expect(prose.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(card.compareDocumentPosition(actions!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('labels the response summary separately from the current Git review actions', async () => {
    const { card } = await renderCard()

    fireEvent.click(within(card).getByText('Files edited in this response (2)'))
    expect(revealCurrentReview).not.toHaveBeenCalled()
    fireEvent.click(within(card).getByRole('button', { name: 'View current changes' }))
    fireEvent.click(rowFor(card, 'app.js'))

    expect(revealCurrentReview).toHaveBeenCalledTimes(1)
    expect(openReviewForPath).toHaveBeenCalledWith('site/app.js', null, expect.anything())
  })
})
