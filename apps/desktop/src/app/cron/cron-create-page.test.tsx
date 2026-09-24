import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n/context'
import { en } from '@/i18n/en'
import { stubResizeObserver } from '@/test/jsdom'

import { CronCreatePage } from './index'

vi.mock('@/work4you', async () => {
  const actual = await vi.importActual<typeof import('@/work4you')>('@/work4you')

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

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return (
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale="en">
        <MemoryRouter>{children}</MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('CronCreatePage', () => {
  it('shows the scheduled jobs path and an untitled name', async () => {
    render(wrap(<CronCreatePage />))

    expect(await screen.findByRole('button', { name: en.cron.title })).toBeTruthy()
    expect(screen.getByText(en.cron.untitled)).toBeTruthy()
    expect(screen.getByLabelText(/name/i)).toBeTruthy()
  })
})
