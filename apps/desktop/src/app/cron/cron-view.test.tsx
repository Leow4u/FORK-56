import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n/context'
import { en } from '@/i18n/en'
import { setCronJobs } from '@/store/cron'
import { stubResizeObserver } from '@/test/jsdom'
import type { AutomationBlueprint, CronJob } from '@/types/work4you'
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

vi.mock('./cron-actions', () => ({
  mutateAndRefreshCronJobs: vi.fn(),
  refreshCronJobs: vi.fn(async () => ({ jobs: null, refreshError: null, stale: false })),
  triggerAndRefreshCronJobs: vi.fn()
}))

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

function job(overrides: Partial<CronJob> = {}): CronJob {
  return {
    deliver: 'local',
    enabled: true,
    id: 'job-1',
    name: 'Limpeza do Gmail',
    prompt: 'Precisa limpar o Gmail conectado',
    schedule_display: 'Every day at 9:00',
    state: 'scheduled',
    ...overrides
  }
}

beforeAll(() => {
  stubResizeObserver()
})

beforeEach(() => {
  setCronJobs([])
})

afterEach(() => {
  cleanup()
  setCronJobs([])
})

function CreateProbe() {
  const [params] = useSearchParams()

  return <div>create:{params.get('blueprint') ?? 'blank'}</div>
}

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return (
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale="en">
        <MemoryRouter initialEntries={['/cron']}>
          <Routes>
            <Route element={children} path="/cron" />
            <Route element={<CreateProbe />} path="/cron/new" />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('CronView', () => {
  it('shows an empty gallery and keeps templates on Mine until a routine exists', async () => {
    render(wrap(<CronView />))

    expect(await screen.findByRole('heading', { name: en.cron.title })).toBeTruthy()
    // Wide tabs and the narrow dropdown both expose the active label.
    expect(screen.getAllByRole('button', { name: en.cron.tabs.jobs }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: en.cron.tabs.blueprints })).toBeTruthy()
    expect(await screen.findByText(en.cron.emptyTitleNew)).toBeTruthy()
    expect(await screen.findByRole('button', { name: /Morning briefing/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: en.cron.newCron }))
    expect(screen.getByText('create:blank')).toBeTruthy()
  })

  it('opens a template through the existing create page', async () => {
    render(wrap(<CronView />))

    fireEvent.click(await screen.findByRole('button', { name: /Morning briefing/ }))
    expect(screen.getByText('create:morning-brief')).toBeTruthy()
  })

  it('lists routines as cards and opens one in place of the gallery', async () => {
    setCronJobs([job()])
    render(wrap(<CronView />))

    const card = await screen.findByRole('button', { name: /Limpeza do Gmail/ })

    expect(screen.queryByRole('button', { name: /Morning briefing/ })).toBeNull()

    fireEvent.click(card)
    expect(screen.getByRole('button', { name: en.cron.pauseTitle })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.cron.edit })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.common.delete })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.cron.triggerNow })).toBeTruthy()
    expect(screen.getByText('Precisa limpar o Gmail conectado')).toBeTruthy()
    expect(await screen.findByText(en.cron.noRuns)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: en.cron.title }))
    expect(screen.getByRole('button', { name: /Limpeza do Gmail/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.cron.triggerNow })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Limpeza do Gmail/ }))
    fireEvent.click(screen.getByRole('button', { name: en.cron.edit }))
    expect(await screen.findByRole('heading', { name: en.cron.editTitle })).toBeTruthy()
  })

  it('keeps templates on their own tab once a routine exists', async () => {
    setCronJobs([job()])
    render(wrap(<CronView />))

    await screen.findByRole('button', { name: /Limpeza do Gmail/ })
    fireEvent.click(screen.getByRole('button', { name: en.cron.tabs.blueprints }))

    expect(await screen.findByRole('button', { name: /Morning briefing/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Limpeza do Gmail/ })).toBeNull()
  })

  it('filters the open tab and says when nothing matches', async () => {
    setCronJobs([job()])
    render(wrap(<CronView />))

    const search = await screen.findByRole('textbox', { name: en.cron.search })

    fireEvent.change(search, { target: { value: 'xyz' } })
    expect(await screen.findByText(en.cron.emptyTitleSearch)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Limpeza do Gmail/ })).toBeNull()
  })

  it('labels a paused routine with Resume', async () => {
    setCronJobs([job({ state: 'paused' })])
    render(wrap(<CronView />))

    fireEvent.click(await screen.findByRole('button', { name: /Limpeza do Gmail/ }))
    expect(screen.getByRole('button', { name: en.cron.resumeTitle })).toBeTruthy()
    expect(await screen.findByText(en.cron.noRuns)).toBeTruthy()
  })

  it('offers the detail actions from the card menu', async () => {
    setCronJobs([job()])
    render(wrap(<CronView />))

    await screen.findByRole('button', { name: /Limpeza do Gmail/ })
    openCardMenu()

    expect(await screen.findByRole('menuitem', { name: en.cron.triggerNow })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: en.cron.pauseTitle })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: en.cron.edit })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: en.common.delete })).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.cron.pauseTitle })).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: en.cron.edit }))
    expect(await screen.findByRole('heading', { name: en.cron.editTitle })).toBeTruthy()
  })

  it('uses Resume in the card menu when the routine is paused', async () => {
    setCronJobs([job({ state: 'paused' })])
    render(wrap(<CronView />))

    await screen.findByRole('button', { name: /Limpeza do Gmail/ })
    openCardMenu()

    expect(await screen.findByRole('menuitem', { name: en.cron.resumeTitle })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: en.cron.pauseTitle })).toBeNull()
  })
})

function openCardMenu() {
  const trigger = screen.getByRole('button', { name: en.cron.actionsTitle })

  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.click(trigger)
}
