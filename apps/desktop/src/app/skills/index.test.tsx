// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type * as ReactRouterDom from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'
import { queryClient } from '@/lib/query-client'
import type * as Work4YouApi from '@/work4you'

import { $skillsCategory, $skillsView } from './store'

const getSkills = vi.fn()
const getToolsets = vi.fn()
const setSkillEnabled = vi.fn()
const setToolsetEnabled = vi.fn()
const getToolsetConfig = vi.fn()
const selectToolsetProvider = vi.fn()
const getUsageAnalytics = vi.fn()
const getProfiles = vi.fn()
const getSkillContent = vi.fn()
const createSkill = vi.fn()
const getSkillHubSources = vi.fn()
const searchSkillsHub = vi.fn()
const installSkillFromHub = vi.fn()
const getActionStatus = vi.fn()

// Partial mock: keep the real module (SkillsView pulls in @/store/profile,
// whose import-time subscription calls setApiRequestProfile) and stub only the
// calls we assert on. Args are forwarded so the per-profile scope arg is
// observable.
vi.mock('@/work4you', async importOriginal => ({
  ...(await importOriginal<typeof Work4YouApi>()),
  getSkills: (profile?: null | string) => getSkills(profile),
  getToolsets: (profile?: null | string) => getToolsets(profile),
  setSkillEnabled: (name: string, enabled: boolean, profile?: null | string) => setSkillEnabled(name, enabled, profile),
  setToolsetEnabled: (name: string, enabled: boolean, profile?: null | string) =>
    setToolsetEnabled(name, enabled, profile),
  getToolsetConfig: (name: string, profile?: null | string) => getToolsetConfig(name, profile),
  selectToolsetProvider: (toolset: string, provider: string) => selectToolsetProvider(toolset, provider),
  getUsageAnalytics: (days: number, profile?: null | string) => getUsageAnalytics(days, profile),
  getProfiles: () => getProfiles(),
  getSkillContent: (name: string, profile?: null | string) => getSkillContent(name, profile),
  createSkill: (skill: { category?: string; content: string; name: string }, profile?: null | string) =>
    createSkill(skill, profile),
  getSkillHubSources: (profile?: null | string) => getSkillHubSources(profile),
  searchSkillsHub: (query: string, source?: string, limit?: number, profile?: null | string) =>
    searchSkillsHub(query, source, limit, profile),
  installSkillFromHub: (identifier: string, profile?: null | string) => installSkillFromHub(identifier, profile),
  getActionStatus: (name: string, tail?: number, profile?: null | string) => getActionStatus(name, tail, profile)
}))

// CodeEditor is CodeMirror; create/edit only needs the form chrome around it.
vi.mock('@/components/chat/code-editor', () => ({
  CodeEditor: () => null
}))

// Notifications hit nanostores/timers we don't care about here.
vi.mock('@/store/notifications', () => ({
  notify: vi.fn(),
  notifyError: vi.fn()
}))

// The vision detail navigates to Settings → Models via useNavigate; spy on it
// so the deep-link target is assertable.
const navigateSpy = vi.fn()

vi.mock('react-router', async importOriginal => ({
  ...(await importOriginal<typeof ReactRouterDom>()),
  useNavigate: () => navigateSpy
}))

function toolset(overrides: Record<string, unknown> = {}) {
  return {
    name: 'google_meet',
    label: 'Google Meet',
    description: 'google meet',
    enabled: true,
    available: true,
    configured: true,
    tools: ['google_meet_schedule'],
    ...overrides
  }
}

async function renderSkills() {
  const { SkillsView } = await import('./index')
  let result: ReturnType<typeof render>
  await act(async () => {
    result = render(
      // SkillsView reads skills/toolsets via useQuery, so it needs a provider.
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/skills?tab=toolsets']}>
          <SkillsView />
        </MemoryRouter>
      </QueryClientProvider>
    )
  })

  return result!
}

async function renderSkillsTab() {
  const { SkillsView } = await import('./index')
  let result: ReturnType<typeof render>
  await act(async () => {
    result = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/skills']}>
          <SkillsView />
        </MemoryRouter>
      </QueryClientProvider>
    )
  })

  return result!
}

beforeEach(() => {
  getSkills.mockResolvedValue([])
  getToolsets.mockResolvedValue([toolset()])
  setToolsetEnabled.mockResolvedValue({ ok: true, name: 'google_meet', enabled: false })
  getToolsetConfig.mockResolvedValue({ has_category: true, active_provider: null, providers: [] })
  getUsageAnalytics.mockResolvedValue({ tools: [] })
  getSkillContent.mockResolvedValue({
    name: 'web-research',
    path: '/skills/web-research/SKILL.md',
    content: '---\nname: web-research\nversion: 1.2.0\nauthor: Work4You\n---\n\n# Web Research\n\nDeep research steps.'
  })
  createSkill.mockResolvedValue({ success: true, message: "Skill 'expense-report' created." })
  getSkillHubSources.mockResolvedValue({ sources: [], index_available: true, featured: [], installed: {} })
  searchSkillsHub.mockResolvedValue({ results: [], source_counts: {}, timed_out: [], installed: {} })
  installSkillFromHub.mockResolvedValue({ name: 'hub-install-1' })
  getActionStatus.mockResolvedValue({ name: 'hub-install-1', running: false, exit_code: 0, lines: [] })
  // Single profile by default → the scope selector stays hidden (>1 gate),
  // so existing tests see unchanged single-profile behavior.
  getProfiles.mockResolvedValue({ profiles: [{ name: 'default', is_default: true }] })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  // Shared singleton client — drop cached skills/toolsets so each test refetches.
  queryClient.clear()
  $skillsView.set('mine')
  $skillsCategory.set('all')
})

// Creation entries live behind the toolbar's Add menu.
async function openAddMenu() {
  fireEvent.keyDown(await screen.findByRole('button', { name: /Add/ }), { key: 'Enter' })
}

async function openNewSkill() {
  await openAddMenu()
  fireEvent.click(await screen.findByRole('menuitem', { name: 'New skill' }))
}

// The "Configuring:" selector is a Select — open it, then pick the option.
async function pickScope(name: string) {
  fireEvent.click(await screen.findByRole('combobox', { name: 'Configuring:' }))
  fireEvent.click(await screen.findByRole('option', { name }))
}

describe('SkillsView toolset management', () => {
  it('renders a switch for each toolset and toggles it off', async () => {
    await renderSkills()

    // The switch names the action, so an enabled toolset offers to turn it off.
    const sw = await screen.findByRole('switch', { name: 'Turn Google Meet toolset off' })
    expect(sw.getAttribute('aria-checked')).toBe('true')

    await act(async () => {
      fireEvent.click(sw)
    })

    await waitFor(() => expect(setToolsetEnabled).toHaveBeenCalled())
    expect(setToolsetEnabled.mock.calls[0].slice(0, 2)).toEqual(['google_meet', false])
  })

  it('renders toolset titles without leading emoji', async () => {
    getToolsets.mockResolvedValue([
      toolset({
        name: 'google_meet',
        label: '🎬 Google Meet',
        description: 'meet tools',
        tools: ['google_meet_schedule']
      })
    ])

    await renderSkills()

    // The label renders in both the row and the auto-selected detail header, so
    // assert via the switch's (emoji-stripped) accessible name and the absence
    // of the emoji rather than a single-match text lookup.
    await screen.findByRole('switch', { name: 'Turn Google Meet toolset off' })
    expect(screen.queryByText(/🎬/)).toBeNull()
  })

  it('renders the provider config panel inline for the selected toolset', async () => {
    // The master-detail UI dropped the resting "Configured" pill and the
    // "Configure" expander: the detail column auto-selects the first toolset
    // and renders its config panel directly, which fetches on mount.
    await renderSkills()

    await screen.findByRole('switch', { name: 'Turn Google Meet toolset off' })
    await waitFor(() => expect(getToolsetConfig).toHaveBeenCalled())
    expect(getToolsetConfig.mock.calls[0][0]).toBe('google_meet')
  })

  it('hides core agent toolsets from Capabilities Tools entirely', async () => {
    getToolsets.mockResolvedValue([
      toolset(),
      toolset({ name: 'image_gen', label: 'Image Generation', tools: ['image_generate'] }),
      toolset({ name: 'web', label: 'Web Search & Scraping', tools: ['web_search'] }),
      toolset({ name: 'memory', label: 'Memory', tools: ['memory_search'] }),
      toolset({ name: 'browser', label: 'Browser Automation', tools: ['browser_navigate'] }),
      toolset({ name: 'terminal', label: 'Terminal & Processes', tools: ['terminal'] }),
      toolset({ name: 'file', label: 'File Operations', tools: ['read_file'] }),
      toolset({ name: 'code_execution', label: 'Code Execution', tools: ['execute_code'] }),
      toolset({ name: 'skills', label: 'Skills', tools: ['skill_manage'] }),
      toolset({ name: 'computer_use', label: 'Computer Use', tools: ['computer_use'] }),
      toolset({ name: 'vision', label: 'Vision / Image Analysis', tools: ['vision_analyze'] }),
      toolset({ name: 'clarify', label: 'Clarifying Questions', tools: ['clarify'] }),
      toolset({ name: 'a2a', label: 'A2A', description: 'Agent-to-Agent protocol', tools: ['a2a_call'] }),
      toolset({ name: 'video_gen', label: 'Video Generation', tools: ['video_generate'] }),
      toolset({ name: 'bfl', label: 'BFL FLUX 3 Video', tools: ['bfl_flux3_text_to_video'] }),
      toolset({ name: 'cronjob', label: 'Cron Jobs', tools: ['cronjob'] }),
      toolset({
        name: 'homeassistant',
        label: 'Home Assistant',
        description: 'smart home device control',
        tools: ['ha_list_entities']
      }),
      toolset({ name: 'session_search', label: 'Session Search', tools: ['session_search_recall'] }),
      toolset({ name: 'spotify', label: 'Spotify', tools: ['spotify_playback'] }),
      toolset({ name: 'delegation', label: 'Task Delegation', tools: ['delegate_task'] }),
      toolset({ name: 'todo', label: 'Task Planning', tools: ['todo'] }),
      toolset({ name: 'video', label: 'Video Analysis', tools: ['video_analyze'] }),
      toolset({ name: 'x_search', label: 'X (Twitter) Search', tools: ['x_search'] }),
      toolset({ name: 'stt', label: 'Speech-to-Text', description: 'voice transcription' }),
      toolset({ name: 'tts', label: 'Text-to-Speech', description: 'text_to_speech' })
    ])

    await renderSkills()

    expect(await screen.findByRole('switch', { name: 'Turn Google Meet toolset off' })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: /Image Generation/ })).toBeNull()
    expect(screen.queryByRole('switch', { name: /Video Generation/ })).toBeNull()
    expect(screen.queryByText('Image Generation')).toBeNull()
    expect(screen.queryByText('Video Generation')).toBeNull()
    expect(screen.queryByText('Web Search & Scraping')).toBeNull()
    expect(screen.queryByText('Memory')).toBeNull()
    expect(screen.queryByText('Browser Automation')).toBeNull()
    expect(screen.queryByText('Terminal & Processes')).toBeNull()
    expect(screen.queryByText('File Operations')).toBeNull()
    expect(screen.queryByText('Code Execution')).toBeNull()
    expect(screen.queryByText('Computer Use')).toBeNull()
    expect(screen.queryByText('Vision / Image Analysis')).toBeNull()
    expect(screen.queryByText('Clarifying Questions')).toBeNull()
    expect(screen.queryByText('A2A')).toBeNull()
    expect(screen.queryByText('BFL FLUX 3 Video')).toBeNull()
    expect(screen.queryByText('Cron Jobs')).toBeNull()
    expect(screen.queryByText('Home Assistant')).toBeNull()
    expect(screen.queryByText('smart home device control')).toBeNull()
    expect(screen.queryByText('Session Search')).toBeNull()
    expect(screen.queryByText('Spotify')).toBeNull()
    expect(screen.queryByText('Task Delegation')).toBeNull()
    expect(screen.queryByText('Task Planning')).toBeNull()
    expect(screen.queryByText('Video Analysis')).toBeNull()
    expect(screen.queryByText('X (Twitter) Search')).toBeNull()
    expect(screen.queryByText('Speech-to-Text')).toBeNull()
    expect(screen.queryByText('Text-to-Speech')).toBeNull()
    expect(screen.queryByText('skill_manage')).toBeNull()
    expect(screen.queryByRole('switch', { name: /Skills toolset/ })).toBeNull()
    expect(setToolsetEnabled).not.toHaveBeenCalled()
  })

  it('hides the Tools tab when every remaining toolset is already hidden', async () => {
    getToolsets.mockResolvedValue([
      toolset({ name: 'image_gen', label: 'Image Generation', tools: ['image_generate'] }),
      toolset({ name: 'web', label: 'Web Search & Scraping', tools: ['web_search'] }),
      toolset({ name: 'stt', label: 'Speech-to-Text', description: 'voice transcription' }),
      toolset({ name: 'tts', label: 'Text-to-Speech', description: 'text_to_speech' })
    ])

    await renderSkills()

    await openAddMenu()
    expect(await screen.findByRole('menuitem', { name: 'New skill' })).toBeTruthy()
    expect(document.querySelector('[data-tour="tab-toolsets"]')).toBeNull()
    expect(screen.queryByRole('switch', { name: /toolset/ })).toBeNull()
    expect(screen.queryByText('Image Generation')).toBeNull()
    expect(screen.queryByText('Web Search & Scraping')).toBeNull()
  })

  it('keeps the Tools tab when a leftover plugin toolset is still visible', async () => {
    await renderSkills()

    expect(await screen.findByRole('switch', { name: 'Turn Google Meet toolset off' })).toBeTruthy()
    expect(document.querySelector('[data-tour="tab-toolsets"]')).toBeTruthy()
  })

  it('scopes Tools config to the profile chosen in the selector', async () => {
    // Two profiles → the "Configuring:" selector renders. Picking a non-active
    // profile must re-fetch toolsets scoped to THAT profile.
    // jsdom's scrollIntoView is missing/non-functional; Radix Select calls it
    // on open. Force a stub so the dropdown can render in the test env.
    Element.prototype.scrollIntoView = vi.fn()
    getProfiles.mockResolvedValue({
      profiles: [
        { name: 'default', is_default: true },
        { name: 'researcher', is_default: false }
      ]
    })

    const { SkillsView } = await import('./index')
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/skills?tab=toolsets']}>
            <SkillsView />
          </MemoryRouter>
        </QueryClientProvider>
      )
    })

    // The selector appears with >1 profile, as the "Configuring:" dropdown.
    await act(async () => {
      await pickScope('researcher')
    })

    // Toolsets refetch scoped to the picked profile.
    await waitFor(() => expect(getToolsets).toHaveBeenCalledWith('researcher'))
  })

  it('scopes the Skills tab (and skill toggles) to the profile chosen in the selector', async () => {
    // The selector is Capabilities-WIDE: picking a profile on the Skills tab
    // must refetch the skill list scoped to it, and route toggles there too.
    Element.prototype.scrollIntoView = vi.fn()
    getProfiles.mockResolvedValue({
      profiles: [
        { name: 'default', is_default: true },
        { name: 'researcher', is_default: false }
      ]
    })
    getSkills.mockResolvedValue([
      {
        name: 'web-research',
        description: 'Research the web',
        category: 'research',
        enabled: true,
        usage: 3,
        provenance: 'agent'
      }
    ])

    const { SkillsView } = await import('./index')
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/skills?tab=skills']}>
            <SkillsView />
          </MemoryRouter>
        </QueryClientProvider>
      )
    })

    // The selector renders on the Skills tab too (Capabilities-wide).
    await act(async () => {
      await pickScope('researcher')
    })

    // Skills refetch scoped to the picked profile...
    await waitFor(() => expect(getSkills).toHaveBeenCalledWith('researcher'))

    // ...and a toggle routes its write to that profile as well.
    const sw = await screen.findByRole('switch', { name: 'web-research' })
    await act(async () => {
      fireEvent.click(sw)
    })
    await waitFor(() => expect(setSkillEnabled).toHaveBeenCalledWith('web-research', false, 'researcher'))
  })

  it('shows the FULL skill in the detail pane — frontmatter metadata + body', async () => {
    getSkills.mockResolvedValue([
      {
        name: 'web-research',
        description: 'Research the web',
        category: 'research',
        enabled: true,
        usage: 3,
        provenance: 'agent'
      }
    ])

    const { SkillsView } = await import('./index')
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/skills?tab=skills']}>
            <SkillsView />
          </MemoryRouter>
        </QueryClientProvider>
      )
    })

    // The list is cards. The SKILL.md screen opens on click.
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /web-research/ }))
    })

    // Frontmatter renders as metadata rows, the body as full text — not just
    // the one-line description.
    await waitFor(() => expect(getSkillContent).toHaveBeenCalled())
    expect(getSkillContent.mock.calls[0][0]).toBe('web-research')
    expect(await screen.findByText('version')).toBeTruthy()
    expect(await screen.findByText('1.2.0')).toBeTruthy()
    expect(await screen.findByText(/Deep research steps/)).toBeTruthy()
  })

  it('hides bundled skills and lists learned and hub skills', async () => {
    getSkills.mockResolvedValue([
      {
        name: 'himalaya',
        description: 'CLI mail',
        category: 'email',
        enabled: true,
        usage: 2,
        provenance: 'bundled'
      },
      {
        name: 'learned-one',
        description: 'Learned from use',
        category: 'productivity',
        enabled: true,
        usage: 1,
        provenance: 'agent'
      },
      {
        name: 'hub-one',
        description: 'Installed from the hub',
        category: 'productivity',
        enabled: true,
        usage: 0,
        provenance: 'hub'
      }
    ])

    await renderSkillsTab()

    expect((await screen.findAllByText('learned-one')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('hub-one').length).toBeGreaterThan(0)
    expect(screen.queryByText('himalaya')).toBeNull()
    // Counts sit on the section headers, grouped by provenance.
    expect(screen.getByRole('heading', { name: /Learned/ }).textContent).toContain('1')
    expect(screen.getByRole('heading', { name: /Hub/ }).textContent).toContain('1')
  })

  it('Discover lists the hub’s featured skills, installs one, and marks the already-installed one', async () => {
    getSkills.mockResolvedValue([
      {
        name: 'web-research',
        description: 'Research the web',
        category: 'research',
        enabled: true,
        usage: 1,
        provenance: 'hub'
      }
    ])
    getSkillHubSources.mockResolvedValue({
      sources: [],
      index_available: true,
      installed: {},
      featured: [
        {
          name: 'web-research',
          description: 'Already here',
          source: 'official',
          identifier: 'official/research/web-research',
          trust_level: 'builtin',
          repo: null,
          tags: []
        },
        {
          name: 'meme-generation',
          description: 'Create meme PNGs',
          source: 'official',
          identifier: 'official/creative/meme-generation',
          trust_level: 'builtin',
          repo: null,
          tags: []
        }
      ]
    })

    await renderSkillsTab()

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Discover' }))
    })

    expect(await screen.findByText('meme-generation')).toBeTruthy()
    // The already-installed skill offers no Install; the other one does.
    expect(screen.getAllByRole('button', { name: 'Install' }).length).toBe(1)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    })

    await waitFor(() => expect(installSkillFromHub).toHaveBeenCalled())
    expect(installSkillFromHub.mock.calls[0][0]).toBe('official/creative/meme-generation')
  })

  it('Discover searches the hub from the page search field', async () => {
    searchSkillsHub.mockResolvedValue({
      results: [
        {
          name: 'stocks',
          description: 'Quotes',
          source: 'official',
          identifier: 'official/finance/stocks',
          trust_level: 'builtin',
          repo: null,
          tags: []
        }
      ],
      source_counts: {},
      timed_out: [],
      installed: {}
    })

    await renderSkillsTab()

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Discover' }))
    })

    fireEvent.change(await screen.findByPlaceholderText('Search the skill hub'), { target: { value: 'stocks' } })

    await waitFor(() => expect(searchSkillsHub).toHaveBeenCalledWith('stocks', 'all', 50, 'default'))
    expect(await screen.findByText('stocks')).toBeTruthy()
  })

  it('hides Vision from Capabilities Tools including the Settings deep-link', async () => {
    getToolsets.mockResolvedValue([
      toolset(),
      toolset({
        name: 'vision',
        label: 'Vision / Image Analysis',
        description: 'vision_analyze',
        tools: ['vision_analyze']
      })
    ])

    await renderSkills()

    expect(await screen.findByRole('switch', { name: 'Turn Google Meet toolset off' })).toBeTruthy()
    expect(screen.queryByText('Vision / Image Analysis')).toBeNull()
    expect(screen.queryByText(/auxiliary model configuration/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Choose vision model in Settings/ })).toBeNull()
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('fixedConnection pins every read to the target connection', async () => {
    // Bot Mode's remote-target door: a bot on another registered gateway gets
    // the live surface pointed at ITS backend — the reads must carry the
    // (connection, profile) pin, not a bare profile name that would resolve
    // against the ACTIVE gateway (the wrong-machine bug).
    const { SkillsView } = await import('./index')
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/skills']}>
            <SkillsView embedded fixedConnection="homelab" fixedProfile="inbox-bot" />
          </MemoryRouter>
        </QueryClientProvider>
      )
    })

    await waitFor(() => expect(getSkills).toHaveBeenCalled())
    expect(getSkills.mock.calls[0][0]).toEqual({ connectionId: 'homelab', profile: 'inbox-bot' })
    expect(getToolsets.mock.calls[0][0]).toEqual({ connectionId: 'homelab', profile: 'inbox-bot' })
    // Pinned scope → no roster/profiles fetch, selector hidden.
    expect(getProfiles).not.toHaveBeenCalled()
  })

  it('offers (connection, profile) scope rows on multi-connection desktops', async () => {
    // With a v2 registry holding >1 connection, the scope selector lists the
    // union agent roster — profile + owning device — instead of the local
    // profiles list, so a selection identifies WHICH gateway's capabilities
    // are being configured.
    const connections = {
      list: vi.fn().mockResolvedValue({
        version: 2,
        primary: 'local',
        secureTokenStorage: true,
        connections: [
          { id: 'local', kind: 'local', label: 'This device', tokenSet: false, tokenPreview: null },
          { id: 'homelab', kind: 'remote', label: 'Homelab', tokenSet: true, tokenPreview: '…' }
        ]
      })
    }

    const getAgentRoster = vi.fn().mockResolvedValue({
      agents: [
        {
          connectionId: 'local',
          connectionKind: 'local',
          connectionLabel: 'This device',
          profile: 'default',
          handle: 'default'
        },
        {
          connectionId: 'homelab',
          connectionKind: 'remote',
          connectionLabel: 'Homelab',
          profile: 'inbox-bot',
          handle: 'inbox-bot-homelab'
        }
      ],
      sources: []
    })

    ;(window as { work4youDesktop?: unknown }).work4youDesktop = { connections, getAgentRoster }

    try {
      await renderSkills()

      await waitFor(() => expect(getAgentRoster).toHaveBeenCalled())
      // The selector paints roster rows labeled profile — device.
      expect(await screen.findByText('default — This device (current)')).toBeTruthy()
    } finally {
      delete (window as { work4youDesktop?: unknown }).work4youDesktop
    }
  })
})

describe('SkillsView new skill', () => {
  it('keeps New skill off the Tools tab', async () => {
    await renderSkills()

    await screen.findByRole('switch', { name: 'Turn Google Meet toolset off' })
    expect(screen.queryByRole('button', { name: 'New skill' })).toBeNull()
  })

  it('shows New skill on an empty Skills list', async () => {
    await renderSkillsTab()

    await openAddMenu()
    expect(await screen.findByRole('menuitem', { name: 'New skill' })).toBeTruthy()
  })

  it('creates a skill through POST /api/skills with the template body', async () => {
    await renderSkillsTab()

    await act(async () => {
      await openNewSkill()
    })

    const name = await screen.findByPlaceholderText('my-skill')
    const save = screen.getByRole('button', { name: 'Create skill' })

    expect(save.hasAttribute('disabled')).toBe(true)

    await act(async () => {
      fireEvent.change(name, { target: { value: 'expense-report' } })
    })

    expect(save.hasAttribute('disabled')).toBe(false)

    await act(async () => {
      fireEvent.click(save)
    })

    await waitFor(() => expect(createSkill).toHaveBeenCalled())
    expect(createSkill.mock.calls[0][0]).toEqual({
      name: 'expense-report',
      content: expect.stringContaining('description: One-line description of when to use this skill.')
    })
    expect(createSkill.mock.calls[0][0].content).toContain('name: my-skill')
  })

  it('scopes create to the Capabilities profile selector', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    getProfiles.mockResolvedValue({
      profiles: [
        { name: 'default', is_default: true },
        { name: 'researcher', is_default: false }
      ]
    })

    await renderSkillsTab()

    await act(async () => {
      await pickScope('researcher')
    })

    await waitFor(() => expect(getSkills).toHaveBeenCalledWith('researcher'))

    await act(async () => {
      await openNewSkill()
    })
    await act(async () => {
      fireEvent.change(await screen.findByPlaceholderText('my-skill'), { target: { value: 'notes' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create skill' }))
    })

    await waitFor(() => expect(createSkill).toHaveBeenCalled())
    expect(createSkill.mock.calls[0][1]).toBe('researcher')
  })

  it('discards a create draft when the profile scope changes', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    getProfiles.mockResolvedValue({
      profiles: [
        { name: 'default', is_default: true },
        { name: 'researcher', is_default: false }
      ]
    })

    await renderSkillsTab()

    await act(async () => {
      await openNewSkill()
    })
    expect(await screen.findByPlaceholderText('my-skill')).toBeTruthy()

    await act(async () => {
      await pickScope('researcher')
    })

    await waitFor(() => expect(screen.queryByPlaceholderText('my-skill')).toBeNull())
    expect(createSkill).not.toHaveBeenCalled()
  })
})

describe('SkillsView profile selector', () => {
  it('names the default profile by the product name, never "(default)", and notes only a non-default target', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    getProfiles.mockResolvedValue({
      profiles: [
        { name: 'default', is_default: true },
        { name: 'researcher', is_default: false }
      ]
    })

    await renderSkillsTab()

    const trigger = await screen.findByRole('combobox', { name: 'Configuring:' })
    expect(trigger.textContent).toContain('Work4You')
    expect(screen.queryByText(/\(default\)/)).toBeNull()
    // Editing the default profile needs no note.
    expect(document.querySelector('[data-scope-loud="true"]')).toBeNull()

    await act(async () => {
      await pickScope('researcher')
    })

    await waitFor(() => expect(document.querySelector('[data-scope-loud="true"]')).toBeTruthy())
    expect(document.querySelector('[data-scope-loud="true"]')?.textContent).toContain('researcher')
  })

  it('shows a display name set for the default profile', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    getProfiles.mockResolvedValue({
      profiles: [
        { name: 'default', is_default: true, display_name: 'Leo bot' },
        { name: 'researcher', is_default: false }
      ]
    })

    await renderSkillsTab()

    expect((await screen.findByRole('combobox', { name: 'Configuring:' })).textContent).toContain('Leo bot')
    expect(screen.queryByText(/\(default\)/)).toBeNull()
  })
})

describe('SkillsView page header', () => {
  it('opens under the page title the sidebar entry spells', async () => {
    await renderSkillsTab()

    expect(screen.getByRole('heading', { level: 1, name: en.sidebar.nav.skills })).toBeTruthy()
  })
})
