import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n/context'
import { en } from '@/i18n/en'
import type { SessionInfo } from '@/types/work4you'
import { getAllSessionMessages, listAllProfileSessions } from '@/work4you'
import type * as Work4YouModule from '@/work4you'

import { ArtifactsView } from './index'

vi.mock('@/work4you', async () => {
  const actual = await vi.importActual<typeof Work4YouModule>('@/work4you')

  return {
    ...actual,
    getAllSessionMessages: vi.fn(async () => ({ messages: [] })),
    listAllProfileSessions: vi.fn(async () => ({ sessions: [] }))
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

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
  it('shows photos with the session caption and Chat, and links as flat rows', async () => {
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

    expect(await screen.findByRole('heading', { name: en.artifacts.tabImages })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.artifacts.tabLinks })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.artifacts.chat })).toBeTruthy()
    expect(screen.getAllByText('Remover barba da foto').length).toBeGreaterThan(0)
    expect(screen.getByText('Getting Started')).toBeTruthy()
    expect(screen.queryByText('beard.png')).toBeNull()
    expect(screen.queryByText(en.artifacts.colTitleDefault)).toBeNull()
    expect(screen.queryByText(en.artifacts.kindImage)).toBeNull()
  })
})
