import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import type { OnboardingContext, OnboardingFlow } from '@/store/onboarding'

import { FlowPanel } from './flow'

vi.mock('@/work4you', () => ({
  getGlobalModelOptions: vi.fn(async () => ({ providers: [] }))
}))

const ctx: OnboardingContext = {
  requestGateway: async () => ({}) as never
}

function renderFlow(flow: OnboardingFlow) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <I18nProvider configClient={null}>
      <QueryClientProvider client={client}>
        <FlowPanel ctx={ctx} flow={flow} leaving={false} onBegin={() => undefined} />
      </QueryClientProvider>
    </I18nProvider>
  )
}

const portal = {
  id: 'work4you',
  name: 'Work4You Portal',
  flow: 'pkce' as const,
  cli_command: 'work4you login',
  docs_url: 'https://portal.work4you.ai',
  status: { logged_in: false }
}

describe('onboarding flow presentation', () => {
  it('confirm uses a system Begin button without bracket chrome', () => {
    renderFlow({
      status: 'confirming_model',
      currentModel: 'anthropic/claude-sonnet-4.5',
      label: 'Work4You Portal',
      providerSlug: 'work4you',
      saving: false
    })

    const begin = screen.getByRole('button', { name: 'Begin' })

    expect(begin.textContent).toBe('Begin')
    expect(screen.getByRole('heading', { name: 'Work4You Portal connected' })).toBeTruthy()
  })

  it('login keeps the authorization code step and Continue', () => {
    renderFlow({
      status: 'awaiting_user',
      provider: portal,
      code: '',
      start: {
        flow: 'pkce',
        auth_url: 'https://portal.work4you.ai/oauth',
        expires_in: 600,
        session_id: 'preview'
      }
    })

    expect(screen.getByRole('heading', { name: 'Sign in with Work4You Portal' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })
})
