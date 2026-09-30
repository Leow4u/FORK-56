import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n/context'
import { en } from '@/i18n/en'
import { stubResizeObserver } from '@/test/jsdom'
import type { AutomationBlueprint } from '@/types/work4you'
import { getAutomationBlueprints } from '@/work4you'
import type * as Work4YouModule from '@/work4you'

import { CronCreatePage } from './index'

const briefing: AutomationBlueprint = {
  appUrl: '',
  category: 'daily',
  command: '',
  description: 'A short daily briefing.',
  fields: [
    {
      default: '08:00',
      help: '',
      label: 'What time?',
      name: 'time',
      optional: false,
      options: [],
      type: 'time'
    }
  ],
  key: 'morning-brief',
  tags: [],
  title: 'Morning briefing'
}

vi.mock('@/work4you', async () => {
  const actual = await vi.importActual<typeof Work4YouModule>('@/work4you')

  return {
    ...actual,
    getAutomationBlueprints: vi.fn(async () => ({ blueprints: [] })),
    getCronDeliveryTargets: vi.fn(async () => []),
    requestModelOptions: vi.fn(async () => ({ providers: [] }))
  }
})

beforeAll(() => {
  stubResizeObserver()
})

afterEach(cleanup)

function wrap(children: ReactNode, initialEntry = '/cron/new') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return (
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale="en">
        <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('CronCreatePage', () => {
  it('shows the routines path and an untitled name', async () => {
    render(wrap(<CronCreatePage />))

    expect(await screen.findByRole('button', { name: en.cron.title })).toBeTruthy()
    expect(screen.getByText(en.cron.untitled)).toBeTruthy()
    expect(screen.getByLabelText(/name/i)).toBeTruthy()
  })

  it('seeds the form from a template query', async () => {
    vi.mocked(getAutomationBlueprints).mockResolvedValueOnce({ blueprints: [briefing] })
    render(wrap(<CronCreatePage />, '/cron/new?blueprint=morning-brief'))

    expect(await screen.findByLabelText('What time?')).toBeTruthy()
    expect(screen.getByText(briefing.description)).toBeTruthy()
  })
})
