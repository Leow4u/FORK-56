import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n/context'
import { pt } from '@/i18n/pt'
import { setCronJobs } from '@/store/cron'
import { stubResizeObserver } from '@/test/jsdom'
import type { AutomationBlueprint } from '@/types/work4you'
import type * as Work4YouModule from '@/work4you'

import { CronView } from './index'

vi.mock('@/work4you', async () => {
  const actual = await vi.importActual<typeof Work4YouModule>('@/work4you')

  return {
    ...actual,
    getAutomationBlueprints: vi.fn(async () => ({ blueprints: [briefing] })),
    getCronDeliveryTargets: vi.fn(async () => []),
    getCronJobRuns: vi.fn(async () => [])
  }
})

const briefing: AutomationBlueprint = {
  appUrl: '',
  category: 'daily',
  command: '',
  description: 'A short daily briefing.',
  fields: [],
  key: 'morning-brief',
  tags: [],
  title: 'Morning briefing'
}

beforeAll(() => {
  stubResizeObserver()
})

afterEach(() => {
  cleanup()
  setCronJobs([])
})

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return (
    <QueryClientProvider client={client}>
      <I18nProvider configClient={null} initialLocale="pt">
        <MemoryRouter initialEntries={['/cron']}>
          <Routes>
            <Route element={children} path="/cron" />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('CronView blueprint i18n', () => {
  it('shows localized template titles when locale is Portuguese', async () => {
    render(wrap(<CronView />))

    expect(await screen.findByRole('button', { name: /Briefing matinal/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Morning briefing/ })).toBeNull()
    expect(screen.getByRole('button', { name: pt.cron.tabs.blueprints })).toBeTruthy()
  })
})
