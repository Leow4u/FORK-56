import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as PluginSdk from '@work4you/plugin-sdk'
import { queryClient } from '@work4you/plugin-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  deleteProfile: vi.fn(async () => undefined),
  notify: vi.fn(),
  notifyError: vi.fn(),
  close: vi.fn()
}))

vi.mock('@work4you/plugin-sdk', async importOriginal => {
  const sdk = await importOriginal<typeof PluginSdk>()

  const SkillsView = Object.assign(
    ({ fixedProfile }: { fixedProfile: string }) => <div data-testid="capabilities">{fixedProfile}</div>,
    { supportsFixedConnection: true }
  )

  return {
    ...sdk,
    usePluginI18n: undefined,
    SkillsView,
    host: {
      ...sdk.host,
      request: mocks.request,
      deleteProfile: mocks.deleteProfile,
      notify: mocks.notify,
      notifyError: mocks.notifyError,
      connections: async () => [],
      newChat: vi.fn(),
      state: { profile: { get: () => 'default' }, connectionId: { get: () => 'local' } }
    }
  }
})
// The bundled plugin is intentionally authored as plain JavaScript.
// @ts-expect-error Plugin has no TypeScript declaration.
import { CreateAgentDialog } from './plugin.js'

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
)
beforeEach(() => {
  vi.clearAllMocks()
  queryClient.clear()
  mocks.request.mockImplementation(async (method: string) => {
    if (method === 'profiles.configure') {
      return { ok: true, applied: { soul: true, description: true, ui_meta: true, model: true } }
    }

    return { ok: true, code: 0, providers: [], models: [], sessions: [], profiles: [] }
  })
})
afterEach(cleanup)

function open() {
  render(
    <QueryClientProvider client={queryClient}>
      <CreateAgentDialog onClose={mocks.close} open roster={[]} />
    </QueryClientProvider>
  )
}

function name(value = 'research') {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value } })
}

async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

describe('New agent creation', () => {
  it('shares login and native skills, creates once, and saves later edits without overwriting capabilities', async () => {
    open()
    expect(screen.queryByRole('checkbox')).toBeNull()
    name()
    fireEvent.click(screen.getByRole('button', { name: /Customize capabilities/ }))
    await screen.findByTestId('capabilities')
    expect(screen.getByTestId('capabilities').textContent).toBe('research')
    expect(mocks.request).toHaveBeenCalledWith(
      'profiles.create',
      expect.objectContaining({ name: 'research', no_skills: false, share_auth: true, mirror_credentials: false })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Back to agent' }))
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Updated title' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Updated purpose' } })
    fireEvent.click(screen.getByRole('button', { name: /Settings.*Model/ }))
    fireEvent.change(screen.getByRole('textbox', { name: /instructions/i }), {
      target: { value: 'Use concise summaries.' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }))
    await waitFor(() => expect(mocks.close).toHaveBeenCalledTimes(1))
    expect(mocks.request.mock.calls.filter(([method]) => method === 'profiles.create')).toHaveLength(1)
    expect(mocks.request).toHaveBeenCalledWith(
      'profiles.configure',
      expect.objectContaining({
        name: 'research',
        description: 'Updated title — Updated purpose',
        soul: expect.stringContaining('Use concise summaries.'),
        ui_meta: { 'work4you-bots': expect.objectContaining({ title: 'Updated title' }) }
      })
    )
    expect(
      mocks.request.mock.calls.filter(
        ([method, params]) => method === 'profiles.configure' && 'disabled_skills' in params
      )
    ).toHaveLength(0)
  })
  it('asks for a name before capabilities and preserves fields when returning from settings', async () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /Customize capabilities/ }))
    expect(screen.getByText('Give the agent a name before customizing capabilities.')).toBeTruthy()
    expect(mocks.request).not.toHaveBeenCalledWith('profiles.create', expect.anything())
    fireEvent.click(screen.getByRole('button', { name: 'Back to agent' }))
    name('another')
    fireEvent.click(screen.getByRole('button', { name: /Settings.*Model/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to agent' }))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('another')
    await settle()
  })
  it.each(['Cancel', 'Close'])('discards a materialized draft on %s', async label => {
    open()
    name()
    fireEvent.click(screen.getByRole('button', { name: /Customize capabilities/ }))
    await screen.findByTestId('capabilities')
    fireEvent.click(screen.getByRole('button', { name: label }))
    await settle()
    expect(mocks.close).toHaveBeenCalledTimes(1)
    expect(mocks.deleteProfile).toHaveBeenCalledWith('research')
  })
  it('cleans up creation that finishes after Cancel', async () => {
    let resolveCreate!: (value: unknown) => void
    const normal = mocks.request.getMockImplementation()!
    mocks.request.mockImplementation((method: string, params: unknown) =>
      method === 'profiles.create'
        ? new Promise(resolve => {
            resolveCreate = resolve
          })
        : normal(method, params)
    )
    open()
    name()
    fireEvent.click(screen.getByRole('button', { name: /Customize capabilities/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await act(async () => {
      resolveCreate({ ok: true })
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(mocks.close).toHaveBeenCalledTimes(1)
    expect(mocks.deleteProfile).toHaveBeenCalledWith('research')
    expect(screen.queryByTestId('capabilities')).toBeNull()
  })
  it('retries a failed create and does not close if saving details fails', async () => {
    open()
    name()
    const normal = mocks.request.getMockImplementation()!
    let failed = false
    mocks.request.mockImplementation((method: string, params: unknown) => {
      if (method === 'profiles.create' && !failed) {
        failed = true

        return Promise.reject(new Error('Backend unavailable'))
      }

      return normal(method, params)
    })
    fireEvent.click(screen.getByRole('button', { name: /Customize capabilities/ }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByTestId('capabilities')
    mocks.request.mockResolvedValueOnce({ ok: true, applied: { soul: false } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }))
    await screen.findByRole('alert')
    expect(mocks.close).not.toHaveBeenCalled()
  })
})
