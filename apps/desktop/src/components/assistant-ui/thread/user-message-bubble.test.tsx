import { AssistantRuntimeProvider, ExportedMessageRepository, type ThreadMessage } from '@assistant-ui/react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useIncrementalExternalStoreRuntime } from '@/lib/incremental-external-store-runtime'

import { assistantMessage, stubThreadEnvironment, stubThreadViewportSize, userMessage } from '../test-utils'

import { Thread } from '.'

stubThreadEnvironment()
stubThreadViewportSize()

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'clipboard')
})

const PROMPT = 'Sim, mas a ideia é que você veja por data'

function Harness({
  onCancel,
  onRestoreToMessage,
  running = false
}: {
  onCancel?: () => void
  onRestoreToMessage?: () => void
  running?: boolean
}) {
  const repository = ExportedMessageRepository.fromArray([userMessage('user-1', PROMPT), assistantMessage()])

  const runtime = useIncrementalExternalStoreRuntime<ThreadMessage>({
    messageRepository: repository,
    isRunning: running,
    setMessages: () => {},
    onNew: async () => {},
    onEdit: async () => {},
    onCancel: async () => {},
    onReload: async () => {}
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread onCancel={onCancel} onRestoreToMessage={onRestoreToMessage} />
    </AssistantRuntimeProvider>
  )
}

async function promptRow(container: HTMLElement): Promise<HTMLElement> {
  return waitFor(() => {
    const row = container.querySelector<HTMLElement>('[data-slot="aui_user-message-root"]')

    expect(row).toBeTruthy()

    return row as HTMLElement
  })
}

describe('a sent prompt', () => {
  // The bubble used to be a button labelled "Edit message", which is all a
  // screen reader announced for every prompt — never what was asked.
  it('reads as its own text, not as a button label', async () => {
    render(<Harness />)

    const text = await screen.findByText(PROMPT)

    expect(text.closest('button')).toBeNull()
  })

  it('opens the editor from its Edit button, not from a click on the text', async () => {
    const { container } = render(<Harness />)

    fireEvent.click(await screen.findByText(PROMPT))
    await new Promise(resolve => window.setTimeout(resolve, 50))

    expect(container.querySelector('[data-slot="aui_edit-composer-root"]')).toBeNull()

    fireEvent.click(within(await promptRow(container)).getByRole('button', { name: 'Edit message' }))

    await waitFor(() => {
      expect(container.querySelector('[data-slot="aui_edit-composer-root"]')).toBeTruthy()
    })
  })

  it('copies its text', async () => {
    const writeText = vi.fn(async (_text: string) => {})

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    const { container } = render(<Harness />)

    fireEvent.click(within(await promptRow(container)).getByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PROMPT))
  })

  it('offers Stop in place of Restore while its turn runs', async () => {
    const { container } = render(<Harness onCancel={vi.fn()} onRestoreToMessage={vi.fn()} running />)
    const row = await promptRow(container)

    expect(within(row).getByRole('button', { name: 'Stop' })).toBeTruthy()
    expect(within(row).queryByRole('button', { name: /restore/i })).toBeNull()
  })

  it('offers Restore once its turn has settled', async () => {
    const { container } = render(<Harness onCancel={vi.fn()} onRestoreToMessage={vi.fn()} />)
    const row = await promptRow(container)

    expect(within(row).getByRole('button', { name: /restore/i })).toBeTruthy()
    expect(within(row).queryByRole('button', { name: 'Stop' })).toBeNull()
  })
})
