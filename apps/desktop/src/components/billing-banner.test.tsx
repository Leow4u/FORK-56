import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BillingBlock } from '@work4you/shared'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ComposerStatusStack } from '@/app/chat/composer/status-stack'
import { I18nProvider, TRANSLATIONS, useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import type * as ExternalLink from '@/lib/external-link'
import { $billingBlock, $billingSettingsRequest, clearBillingBlock, setBillingBlock } from '@/store/billing-block'

vi.mock('@/lib/external-link', async importOriginal => ({
  ...(await importOriginal<typeof ExternalLink>()),
  openExternalLink: vi.fn()
}))

const pt = TRANSLATIONS.pt
const raw = 'HTTP 402: This request would exceed your available credits given your current in-flight requests.'

const block: BillingBlock = {
  provider: 'work4you',
  provider_label: 'Work4You Portal',
  is_nous: true,
  billing_url: 'https://portal.work4you.ai/billing',
  model: 'test-model',
  message: raw
}

function LocaleSwitcher() {
  const { setLocale } = useI18n()

  return <button onClick={() => void setLocale('en')}>English</button>
}

function Harness({ sessionId = 'session-1', queued = false }: { sessionId?: string | null; queued?: boolean }) {
  return (
    <I18nProvider configClient={null} initialLocale="pt">
      <MemoryRouter>
        <LocaleSwitcher />
        <ComposerStatusStack queue={queued ? <div>Queued prompt</div> : null} sessionId={sessionId} />
      </MemoryRouter>
    </I18nProvider>
  )
}

beforeEach(() => {
  clearBillingBlock()
  $billingSettingsRequest.set(0)
  vi.clearAllMocks()
})
afterEach(() => {
  cleanup()
  clearBillingBlock()
})

describe('billing notice in the composer stack', () => {
  it('renders on its own and localizes the description and existing billing action', () => {
    setBillingBlock('session-1', block)
    render(<Harness />)
    expect(screen.getByRole('region', { name: pt.billingBlock.titleWork4You })).toBeTruthy()
    expect(screen.getByText(pt.assistant.thread.errorCard.inFlightCredits)).toBeTruthy()
    expect(screen.queryByText(raw)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: pt.billingBlock.openBilling }))
    expect($billingSettingsRequest.get()).toBe(1)
    expect(openExternalLink).not.toHaveBeenCalled()
    expect($billingBlock.get()?.block).toBe(block)
  })

  it('keeps the third-party billing destination and action', () => {
    const externalBlock = {
      ...block,
      is_nous: false,
      provider: 'openrouter',
      provider_label: 'OpenRouter',
      billing_url: 'https://openrouter.ai/settings/credits'
    }

    setBillingBlock('session-1', externalBlock)
    render(<Harness />)
    expect(screen.getByRole('region', { name: pt.billingBlock.titleProvider('OpenRouter') })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: pt.billingBlock.addCredits }))
    expect(openExternalLink).toHaveBeenCalledExactlyOnceWith(externalBlock.billing_url)
    expect($billingSettingsRequest.get()).toBe(0)
  })

  it('does not show another conversation’s block and reappears on returning to its session', () => {
    setBillingBlock('session-1', block)
    const { rerender } = render(<Harness sessionId="session-2" />)
    expect(screen.queryByRole('region')).toBeNull()
    rerender(<Harness sessionId={null} />)
    expect(screen.queryByRole('region')).toBeNull()
    rerender(<Harness sessionId="session-1" />)
    expect(screen.getByRole('region', { name: pt.billingBlock.titleWork4You })).toBeTruthy()
  })

  it('dismisses the billing notice while preserving the queue', () => {
    setBillingBlock('session-1', block)
    render(<Harness queued />)
    fireEvent.click(screen.getByRole('button', { name: pt.billingBlock.dismiss }))
    expect(screen.queryByRole('region')).toBeNull()
    expect(screen.getByText('Queued prompt')).toBeTruthy()
    expect($billingBlock.get()).toBeNull()
  })

  it('updates locale and removes the notice when the existing billing state clears', async () => {
    setBillingBlock('session-1', { ...block, message: 'Unrecognized provider guidance' })
    render(<Harness />)
    expect(screen.getByText(pt.assistant.thread.errorCard.billing)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByText(TRANSLATIONS.en.assistant.thread.errorCard.billing)).toBeTruthy()
    expect(screen.getByRole('button', { name: TRANSLATIONS.en.billingBlock.openBilling })).toBeTruthy()
    act(() => clearBillingBlock('session-1'))
    expect(screen.queryByRole('region')).toBeNull()
  })
})
