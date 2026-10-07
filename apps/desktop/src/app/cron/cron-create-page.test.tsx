import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n/context'
import { en } from '@/i18n/en'
import { requestModelOptions } from '@/lib/model-options'
import type * as ModelOptionsModule from '@/lib/model-options'
import { setCronJobs } from '@/store/cron'
import { $activeGatewayProfile, setShowAllProfiles } from '@/store/profile'
import { $projectScope, ALL_PROJECTS } from '@/store/project-scope'
import { $activeProjectId, $projectTree } from '@/store/projects'
import { $connection } from '@/store/session'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'
import type { AutomationBlueprint } from '@/types/work4you'
import {
  createCronJob,
  getAutomationBlueprints,
  getCronDeliveryTargets,
  instantiateAutomationBlueprint
} from '@/work4you'
import type * as Work4YouModule from '@/work4you'

import { CronCreatePage } from './index'

const briefing: AutomationBlueprint = {
  appUrl: '',
  category: 'daily',
  command: '',
  description: 'A short daily briefing.',
  fields: [
    { default: '08:00', help: '', label: 'What time?', name: 'time', optional: false, options: [], type: 'time' },
    { default: 'origin', help: '', label: 'Deliver', name: 'deliver', optional: false, options: [], type: 'text' }
  ],
  key: 'morning-brief',
  tags: [],
  title: 'Morning briefing'
}

const project = (id: string, path: string) => ({ id, label: id, path, repos: [], sessionCount: 0, previewSessions: [] })
const created = { id: 'new-job', enabled: true, name: 'Summary', deliver: 'local', prompt: 'Summarize' }

vi.mock('@/work4you', async () => {
  const actual = await vi.importActual<typeof Work4YouModule>('@/work4you')

  return {
    ...actual,
    createCronJob: vi.fn(),
    getCronJobs: vi.fn(async () => []),
    getAutomationBlueprints: vi.fn(),
    getCronDeliveryTargets: vi.fn(),
    instantiateAutomationBlueprint: vi.fn()
  }
})
vi.mock('@/lib/model-options', async importOriginal => ({
  ...(await importOriginal<typeof ModelOptionsModule>()),
  requestModelOptions: vi.fn()
}))

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})
beforeEach(() => {
  vi.clearAllMocks()
  $activeGatewayProfile.set('default')
  setShowAllProfiles(false)
  $projectScope.set(ALL_PROJECTS)
  $activeProjectId.set(null)
  $projectTree.set([project('Sales', '/work/sales'), project('Research', '/work/research')])
  $connection.set(null)
  setCronJobs([])
  vi.mocked(getAutomationBlueprints).mockResolvedValue({ blueprints: [briefing] })
  vi.mocked(getCronDeliveryTargets).mockResolvedValue([
    { id: 'local', name: 'This desktop', home_target_set: true, home_env_var: '' },
    { id: 'whatsapp', name: 'WhatsApp', home_target_set: true, home_env_var: '' }
  ])
  vi.mocked(requestModelOptions).mockResolvedValue({
    providers: [{ slug: 'openrouter', name: 'OpenRouter', authenticated: true, models: ['anthropic/claude:beta'] }]
  })
  vi.mocked(createCronJob).mockResolvedValue(created)
  vi.mocked(instantiateAutomationBlueprint).mockResolvedValue(created)
})
afterEach(() => {
  cleanup()
  delete (window as { work4youDesktop?: unknown }).work4youDesktop
  setCronJobs([])
  $connection.set(null)
  setShowAllProfiles(false)
  $activeGatewayProfile.set('default')
})

function wrap(children: ReactNode, initialEntry = '/cron/new') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

  return (
    <QueryClientProvider client={client}>
      <I18nProvider configClient={null} initialLocale="en">
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route element={children} path="/cron/new" />
            <Route element={<p>Routine library</p>} path="/cron" />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}

function fillPrompt() {
  fireEvent.change(screen.getByLabelText(en.cron.create.instructions), {
    target: { value: 'Summarize the priorities' }
  })
}

async function select(label: string, option: string | RegExp) {
  const trigger = screen.getByRole('combobox', { name: label })
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: option }))
  await waitFor(() => expect(window.document.activeElement).toBe(trigger))
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: en.cron.create.submit }))
}

describe('Routine creation', () => {
  it('opens a named dialog over the library and cancels without creating', async () => {
    render(wrap(<CronCreatePage />))
    expect(await screen.findByRole('dialog', { name: en.cron.newCron })).toBeTruthy()
    expect(screen.getByLabelText(en.cron.nameLabel)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.common.cancel }))
    expect(screen.getByText('Routine library')).toBeTruthy()
    expect(createCronJob).not.toHaveBeenCalled()
  })

  it('submits time, model, folder and discovered destinations without changing the chat project', async () => {
    $projectScope.set('Research')
    $activeProjectId.set('Research')
    render(wrap(<CronCreatePage />))
    fillPrompt()
    fireEvent.change(screen.getByLabelText(en.cron.nameLabel), { target: { value: ' Daily priorities ' } })
    fireEvent.change(screen.getByLabelText(en.cron.create.time), { target: { value: '14:35' } })
    await select(en.cron.create.repeat, en.cron.scheduleLabels.weekdays)
    await select(en.cron.modelLabel, /claude/i)
    fireEvent.keyDown(screen.getByRole('button', { name: en.cron.create.project }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sales' }))
    await waitFor(() =>
      expect(window.document.activeElement).toBe(screen.getByRole('button', { name: en.cron.create.project }))
    )
    expect($projectScope.get()).toBe('Research')
    expect($activeProjectId.get()).toBe('Research')
    fireEvent.click(screen.getByRole('button', { name: /Where to receive/ }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'WhatsApp' }))
    expect(screen.queryByRole('checkbox', { name: 'Telegram' })).toBeNull()
    expect(screen.queryByRole('link', { name: /channel/i })).toBeNull()
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'WhatsApp' }), { key: 'Escape' })
    submit()
    await waitFor(() =>
      expect(createCronJob).toHaveBeenCalledWith({
        name: 'Daily priorities',
        prompt: 'Summarize the priorities',
        schedule: '35 14 * * 1-5',
        deliver: 'local,whatsapp',
        workdir: '/work/sales',
        model: 'anthropic/claude:beta',
        provider: 'openrouter'
      })
    )
    expect(await screen.findByText('Routine library')).toBeTruthy()
  })

  it.each([
    ['weekly', 'Day of the week', 'Friday', '0 9 * * 5'],
    ['monthly', 'Day of the month', '17', '0 9 17 * *'],
    ['hourly', 'Minute', '20', '20 * * * *']
  ])('edits the %s schedule through its dedicated controls', async (preset, label, value, expression) => {
    render(wrap(<CronCreatePage />))
    fillPrompt()
    await select(en.cron.create.repeat, en.cron.scheduleLabels[preset])

    if (preset === 'weekly') {
      await select(label, value)
    } else {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }

    submit()
    await waitFor(() => expect(createCronJob).toHaveBeenCalledWith(expect.objectContaining({ schedule: expression })))
  })

  it('accepts custom schedules and leaves the configured model unpinned', async () => {
    render(wrap(<CronCreatePage />))
    fillPrompt()
    await select(en.cron.create.repeat, en.cron.scheduleLabels.custom)
    fireEvent.change(screen.getByLabelText(en.cron.customScheduleLabel), { target: { value: 'every 2h' } })
    submit()
    await waitFor(() => expect(createCronJob).toHaveBeenCalledWith(expect.objectContaining({ schedule: 'every 2h' })))
    expect(vi.mocked(createCronJob).mock.calls[0][0]).not.toHaveProperty('model')
  })

  it('clears the inherited project only for this routine', async () => {
    $projectScope.set('Research')
    render(wrap(<CronCreatePage />))
    fillPrompt()
    fireEvent.keyDown(screen.getByRole('button', { name: en.cron.create.project }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitem', { name: en.cron.create.noProject }))
    submit()
    await waitFor(() => expect(createCronJob).toHaveBeenCalled())
    expect(vi.mocked(createCronJob).mock.calls[0][0]).not.toHaveProperty('workdir')
    expect($projectScope.get()).toBe('Research')
  })

  it('opens an existing folder for the routine without entering its project', async () => {
    const selectPaths = vi.fn(async () => ['/work/sales'])

    ;(window as { work4youDesktop?: unknown }).work4youDesktop = { selectPaths }
    $projectScope.set('Research')
    render(wrap(<CronCreatePage />))
    fillPrompt()
    fireEvent.keyDown(screen.getByRole('button', { name: en.cron.create.project }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitem', { name: en.commandCenter.openFolder }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: en.cron.create.project }).textContent).toContain('Sales')
    )
    expect(selectPaths).toHaveBeenCalledWith({ directories: true, multiple: false })
    expect($projectScope.get()).toBe('Research')
    submit()
    await waitFor(() => expect(createCronJob).toHaveBeenCalledWith(expect.objectContaining({ workdir: '/work/sales' })))
  })

  it('never sends this computer’s inherited project path to a remote backend', async () => {
    $connection.set({ mode: 'remote', profile: 'default', baseUrl: 'https://remote.example' } as never)
    $projectScope.set('Research')
    render(wrap(<CronCreatePage />))
    fillPrompt()
    expect((screen.getByRole('button', { name: en.cron.create.project }) as HTMLButtonElement).disabled).toBe(true)
    submit()
    await waitFor(() => expect(createCronJob).toHaveBeenCalled())
    expect(vi.mocked(createCronJob).mock.calls[0][0]).not.toHaveProperty('workdir')
  })

  it('keeps the final delivery destination selected', async () => {
    render(wrap(<CronCreatePage />))
    fillPrompt()
    fireEvent.click(screen.getByRole('button', { name: /Where to receive/ }))
    const checkbox = await screen.findByRole('checkbox', { name: en.cron.deliveryLabels.local })
    fireEvent.click(checkbox)
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
  })

  it('loads a template deep link and submits typed slots through the existing endpoint', async () => {
    render(wrap(<CronCreatePage />, '/cron/new?blueprint=morning-brief'))
    const time = await screen.findByLabelText('What time?')
    expect((time as HTMLInputElement).value).toBe('08:00')
    fireEvent.change(time, { target: { value: '11:15' } })
    fireEvent.click(screen.getByRole('button', { name: /Where to receive/ }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'WhatsApp' }))
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'WhatsApp' }), { key: 'Escape' })
    submit()
    await waitFor(() =>
      expect(instantiateAutomationBlueprint).toHaveBeenCalledWith(
        { blueprint: 'morning-brief', values: { time: '11:15', deliver: 'local,whatsapp' } },
        'default'
      )
    )
    expect(createCronJob).not.toHaveBeenCalled()
  })

  it('does not create a blank manual routine for an unavailable template', async () => {
    render(wrap(<CronCreatePage />, '/cron/new?blueprint=missing'))
    expect(await screen.findByText(en.cron.create.templateUnavailable)).toBeTruthy()
    expect((screen.getByRole('button', { name: en.cron.create.submit }) as HTMLButtonElement).disabled).toBe(true)
    expect(createCronJob).not.toHaveBeenCalled()
  })

  it('keeps entered instructions after failure and prevents duplicate saves and close while pending', async () => {
    let reject!: (reason: Error) => void
    vi.mocked(createCronJob).mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail
      })
    )
    render(wrap(<CronCreatePage />))
    fillPrompt()
    submit()
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(createCronJob).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: en.common.cancel }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    await act(async () => reject(new Error('422: Invalid schedule')))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Invalid schedule')
    expect((screen.getByLabelText(en.cron.create.instructions) as HTMLTextAreaElement).value).toBe(
      'Summarize the priorities'
    )
    submit()
    expect(await screen.findByText('Routine library')).toBeTruthy()
  })

  it('resets a draft on backend profile change even while browsing all profiles', async () => {
    setShowAllProfiles(true)
    render(wrap(<CronCreatePage />))
    fillPrompt()
    await act(async () => {
      $activeGatewayProfile.set('research')
    })
    expect((screen.getByLabelText(en.cron.create.instructions) as HTMLTextAreaElement).value).toBe('')
    expect(within(screen.getByRole('dialog')).getByText('research')).toBeTruthy()
    await waitFor(() => expect(getCronDeliveryTargets).toHaveBeenCalledWith('research'))
  })
})
