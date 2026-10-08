import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n/context'
import { en } from '@/i18n/en'
import { notify, notifyError } from '@/store/notifications'
import { $activeGatewayProfile, $profiles, setShowAllProfiles } from '@/store/profile'
import { $connection } from '@/store/session'
import type { SessionInfo } from '@/types/work4you'
import { getAllSessionMessages, listAllProfileSessions } from '@/work4you'
import type * as Work4YouModule from '@/work4you'

import { ArtifactsView } from './index'

vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))

vi.mock('@/work4you', async () => {
  const actual = await vi.importActual<typeof Work4YouModule>('@/work4you')

  return {
    ...actual,
    getAllSessionMessages: vi.fn(async () => ({ messages: [] })),
    listAllProfileSessions: vi.fn(async () => ({ sessions: [] }))
  }
})

beforeEach(() => {
  $activeGatewayProfile.set('default')
  setShowAllProfiles(false)
  $connection.set(null)
  $profiles.set([])
  vi.mocked(listAllProfileSessions).mockReset().mockResolvedValue(listResult([]))
  vi.mocked(getAllSessionMessages)
    .mockReset()
    .mockImplementation(async id => messageResult(id))
})

afterEach(() => {
  cleanup()
  $activeGatewayProfile.set('default')
  setShowAllProfiles(false)
  $connection.set(null)
  $profiles.set([])
  vi.clearAllMocks()
})

function listResult(sessions: SessionInfo[]) {
  return { sessions, total: sessions.length, limit: 30, offset: 0 }
}

function messageResult(id: string) {
  return {
    session_id: id,
    messages: [
      { content: `![result](https://example.com/${id}.png)`, role: 'assistant' as const, timestamp: 1_700_000_100 }
    ]
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void

  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })

  return { promise, resolve, reject }
}

function session(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    ended_at: null,
    id: 'session-1',
    input_tokens: 0,
    is_active: false,
    last_active: 1_700_000_000,
    message_count: 1,
    model: null,
    output_tokens: 0,
    preview: null,
    source: null,
    started_at: 1_700_000_000,
    title: 'Remover barba da foto',
    tool_call_count: 0,
    ...overrides
  }
}

function renderArtifacts(children: ReactNode = <ArtifactsView />) {
  return render(
    <I18nProvider initialLocale="en">
      <MemoryRouter initialEntries={['/artifacts']}>{children}</MemoryRouter>
    </I18nProvider>
  )
}

describe('ArtifactsView', () => {
  it('requests only the active profile and routes its transcripts to their owner', async () => {
    $activeGatewayProfile.set('orlando')
    vi.mocked(listAllProfileSessions).mockResolvedValue(listResult([session({ profile: 'orlando' })]))

    renderArtifacts()

    await screen.findByRole('button', { name: en.artifacts.chat })
    expect(listAllProfileSessions).toHaveBeenCalledWith(30, 1, 'exclude', 'recent', 'orlando')
    expect(getAllSessionMessages).toHaveBeenCalledWith('session-1', 'orlando')
  })

  it('clears previous rows immediately when switching profiles and handles an empty target', async () => {
    const next = deferred<ReturnType<typeof listResult>>()
    vi.mocked(listAllProfileSessions)
      .mockResolvedValueOnce(listResult([session()]))
      .mockReturnValueOnce(next.promise)
    renderArtifacts()
    await screen.findByRole('button', { name: en.artifacts.chat })

    act(() => $activeGatewayProfile.set('orlando'))
    expect(screen.queryByText('Remover barba da foto')).toBeNull()
    await waitFor(() => expect(listAllProfileSessions).toHaveBeenLastCalledWith(30, 1, 'exclude', 'recent', 'orlando'))
    await act(async () => next.resolve(listResult([])))
    expect(screen.queryByRole('button', { name: en.artifacts.chat })).toBeNull()
  })

  it('ignores a late transcript and stops indexing the profile that was left', async () => {
    const old = deferred<ReturnType<typeof messageResult>>()
    vi.mocked(listAllProfileSessions)
      .mockResolvedValueOnce(listResult([session(), session({ id: 'old-second' })]))
      .mockResolvedValueOnce(listResult([session({ id: 'orlando-chat', profile: 'orlando', title: 'Orlando result' })]))
    vi.mocked(getAllSessionMessages).mockImplementation(id =>
      id === 'session-1' ? old.promise : Promise.resolve(messageResult(id))
    )
    renderArtifacts()
    await waitFor(() => expect(getAllSessionMessages).toHaveBeenCalledWith('session-1', undefined))

    act(() => $activeGatewayProfile.set('orlando'))
    await screen.findByText('Orlando result')
    await act(async () => old.resolve(messageResult('session-1')))

    expect(screen.queryByText('Remover barba da foto')).toBeNull()
    expect(screen.getByText('Orlando result')).toBeTruthy()
    expect(getAllSessionMessages).not.toHaveBeenCalledWith('old-second', undefined)
    expect(notify).not.toHaveBeenCalled()
  })

  it('does not report a late failure from the previous scope', async () => {
    const old = deferred<ReturnType<typeof listResult>>()
    vi.mocked(listAllProfileSessions).mockReturnValueOnce(old.promise).mockResolvedValueOnce(listResult([]))
    renderArtifacts()

    act(() => $activeGatewayProfile.set('orlando'))
    await waitFor(() => expect(listAllProfileSessions).toHaveBeenCalledTimes(2))
    await act(async () => old.reject(new Error('previous backend closed')))

    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reloads the same profile when the owning connection changes', async () => {
    vi.mocked(listAllProfileSessions)
      .mockResolvedValueOnce(listResult([session()]))
      .mockResolvedValueOnce(listResult([session({ id: 'remote-chat', title: 'Remote result' })]))
    renderArtifacts()
    await screen.findByText('Remover barba da foto')

    act(() =>
      $connection.set({ connectionId: 'remote-source', mode: 'remote', profile: 'default' } as NonNullable<
        ReturnType<typeof $connection.get>
      >)
    )
    await screen.findByText('Remote result')
    expect(screen.queryByText('Remover barba da foto')).toBeNull()
    expect(listAllProfileSessions).toHaveBeenCalledTimes(2)
  })

  it('aggregates only in all-profiles mode, shows each owner, and returns to the selected profile', async () => {
    setShowAllProfiles(true)
    $activeGatewayProfile.set('orlando')
    vi.mocked(listAllProfileSessions).mockResolvedValue(
      listResult([
        session({ profile: 'default', title: 'Default result' }),
        session({ id: 'orlando-chat', profile: 'orlando', title: 'Orlando result' })
      ])
    )
    vi.mocked(getAllSessionMessages).mockImplementation(async id =>
      id === 'orlando-chat'
        ? {
            session_id: id,
            messages: [
              { content: '[report](https://example.com/report.csv)', role: 'assistant', timestamp: 1_700_000_100 }
            ]
          }
        : messageResult(id)
    )
    renderArtifacts()
    await screen.findByText('Orlando result')
    expect(listAllProfileSessions).toHaveBeenLastCalledWith(30, 1, 'exclude', 'recent', 'all')
    expect(screen.getByText('default')).toBeTruthy()
    expect(screen.getByText('orlando')).toBeTruthy()
    expect(getAllSessionMessages).toHaveBeenCalledWith('orlando-chat', 'orlando')

    vi.mocked(listAllProfileSessions).mockResolvedValue(listResult([]))
    act(() => setShowAllProfiles(false))
    await waitFor(() => expect(listAllProfileSessions).toHaveBeenLastCalledWith(30, 1, 'exclude', 'recent', 'orlando'))
    expect(screen.queryByText('Default result')).toBeNull()
  })

  it('keeps both artifact kinds reachable when paging one section', async () => {
    vi.mocked(listAllProfileSessions).mockResolvedValue(listResult([session()]))
    vi.mocked(getAllSessionMessages).mockResolvedValue({
      session_id: 'session-1',
      messages: [
        {
          role: 'assistant',
          timestamp: 1_700_000_100,
          content: Array.from(
            { length: 101 },
            (_, index) => `MEDIA: /tmp/report-${index}.md\nhttps://example.com/result-${index}`
          ).join('\n')
        }
      ]
    })
    const { container } = renderArtifacts()

    const fileNext = await screen.findByRole('button', { name: en.artifacts.goToPage(en.artifacts.itemsFile, 2) })
    act(() => fileNext.click())
    await screen.findByRole('button', { name: /report-100\.md/ })
    expect(container.querySelector('a[href="https://example.com/result-0"]')).toBeTruthy()
    expect(container.querySelector('a[href="https://example.com/result-100"]')).toBeNull()

    act(() => screen.getByRole('button', { name: en.artifacts.goToPage(en.artifacts.itemsLink, 2) }).click())
    await waitFor(() => expect(container.querySelector('a[href="https://example.com/result-100"]')).toBeTruthy())
    expect(screen.getByRole('button', { name: /report-100\.md/ })).toBeTruthy()
  })

  it('shows photos with the session caption and Chat, and links in a titled table', async () => {
    vi.mocked(listAllProfileSessions).mockResolvedValue({
      sessions: [session()],
      total: 1
    } as Awaited<ReturnType<typeof listAllProfileSessions>>)
    vi.mocked(getAllSessionMessages).mockResolvedValue({
      messages: [
        {
          content: '![beard](https://cdn.example.com/beard.png)\n\nSee https://example.com/docs/getting-started',
          role: 'assistant',
          timestamp: 1_700_000_100
        }
      ]
    } as Awaited<ReturnType<typeof getAllSessionMessages>>)

    renderArtifacts()

    expect(await screen.findByRole('heading', { name: en.sidebar.nav.artifacts })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.artifacts.tabImages })).toBeTruthy()
    expect(screen.getByRole('button', { name: /All/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.artifacts.tabLinks })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.artifacts.chat })).toBeTruthy()
    expect(screen.getAllByText('Remover barba da foto').length).toBeGreaterThan(0)
    expect(screen.getByText('Getting Started')).toBeTruthy()
    expect(screen.queryByText('beard.png')).toBeNull()
    expect(screen.getByRole('columnheader', { name: en.artifacts.colTitleLink })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: en.artifacts.colDate })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: en.artifacts.chat })).toBeTruthy()
    expect(screen.queryByText(en.artifacts.kindImage)).toBeNull()
  })
})
