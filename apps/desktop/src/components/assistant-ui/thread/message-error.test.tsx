import type { ThreadMessage } from '@assistant-ui/react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider, type Locale, TRANSLATIONS, useI18n } from '@/i18n'

import { assistantMessage, stubThreadEnvironment, ThreadRuntime, userMessage } from '../test-utils'

import { Thread } from '.'

stubThreadEnvironment()
afterEach(cleanup)

const raw = 'HTTP 402: This request would exceed your available credits given your current in-flight requests.'
const pt = TRANSLATIONS.pt.assistant.thread

function LocaleSwitcher() {
  const { setLocale } = useI18n()

  return <button onClick={() => void setLocale('en')}>English</button>
}

function Harness({
  error = raw,
  locale = 'pt',
  onDismiss
}: {
  error?: unknown
  locale?: Locale
  onDismiss?: (id: string) => void
}) {
  const [dismissed, setDismissed] = useState(false)

  const message = {
    ...assistantMessage(),
    status: dismissed ? { type: 'complete', reason: 'stop' } : { type: 'incomplete', reason: 'error', error }
  } as ThreadMessage

  return (
    <I18nProvider configClient={null} initialLocale={locale}>
      <LocaleSwitcher />
      <ThreadRuntime messages={[userMessage(), message]}>
        <Thread
          onDismissError={
            onDismiss
              ? id => {
                  onDismiss(id)
                  setDismissed(true)
                }
              : undefined
          }
        />
      </ThreadRuntime>
    </I18nProvider>
  )
}

describe('localized error cards in the real transcript', () => {
  it('keeps partial output, localizes the card and preserves the original in collapsed details', async () => {
    render(<Harness />)
    const card = await screen.findByRole('alert', { name: pt.errorCard.title })
    expect(screen.getByText('done')).toBeTruthy()
    expect(within(card).getByText(pt.errorCard.inFlightCredits)).toBeTruthy()
    const details = card.querySelector('details')!
    expect(details.open).toBe(false)
    fireEvent.click(within(card).getByText(pt.errorCard.details))
    expect(details.open).toBe(true)
    expect(within(details).getByText(raw)).toBeTruthy()
    expect(within(card).queryByRole('button', { name: pt.dismissError })).toBeNull()
  })

  it('dismisses only the failed reply using the existing callback', async () => {
    const dismiss = vi.fn()
    render(<Harness onDismiss={dismiss} />)
    fireEvent.click(await screen.findByRole('button', { name: pt.dismissError }))
    expect(dismiss).toHaveBeenCalledExactlyOnceWith('assistant-1')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByText('done')).toBeTruthy()
  })

  it('changes the title, explanation and details label when the locale changes', async () => {
    render(<Harness />)
    await screen.findByRole('alert', { name: pt.errorCard.title })
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    const en = TRANSLATIONS.en.assistant.thread.errorCard
    const card = await screen.findByRole('alert', { name: en.title })
    expect(within(card).getByText(en.inFlightCredits)).toBeTruthy()
    expect(within(card).getByText(en.details)).toBeTruthy()
    expect(card.querySelector('details')?.open).toBe(false)
  })

  it.each(['Unrecognized English provider failure', { message: 'Unrecognized English provider failure' }])(
    'uses a translated fallback for unknown errors, including SDK message objects',
    async error => {
      render(<Harness error={error} />)
      const card = await screen.findByRole('alert', { name: pt.errorCard.title })
      expect(within(card).getByText(pt.errorCard.generic)).toBeTruthy()
      expect(card.querySelector('details')?.open).toBe(false)
    }
  )
})
