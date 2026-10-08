import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rescopeConnectionScopedStores } from '@/lib/connection-scoped'
import type { SessionInfo } from '@/types/work4you'

import {
  $allPreviewTabs,
  $currentRecentPreviews,
  $previewTabs,
  $previewTileSession,
  closeRightRailTab,
  forgetPreviewSessions,
  openNewBrowserTab,
  openPreview,
  type PreviewTarget,
  rememberPreviewIcon,
  rememberPreviewTitle,
  rememberPreviewUrl
} from './preview'
import { $recentPreviews, decodeRecentPreviews, suggestedPreviewSites } from './preview-recents'
import { $activeGatewayProfile } from './profile-identity'
import { $activeSessionId, $selectedStoredSessionId, $sessions } from './session'

const owner = { profile: 'default', session: 'chat-a' }
const web = (url: string): PreviewTarget => ({ kind: 'url', label: url, source: url, url })

const file = (name = 'notes.md'): PreviewTarget => ({
  kind: 'file',
  path: `/work/${name}`,
  label: name,
  source: `/work/${name}`,
  url: `file:///work/${name}`,
  previewKind: 'text'
})

function reset() {
  rescopeConnectionScopedStores({ mode: 'local' })
  $allPreviewTabs.set([])
  $recentPreviews.set([])
  $previewTileSession.set(null)
  $activeSessionId.set(null)
  $selectedStoredSessionId.set(null)
  $activeGatewayProfile.set('default')
  $sessions.set([])
  localStorage.clear()
  vi.restoreAllMocks()
}

beforeEach(reset)
afterEach(reset)

describe('new-tab access history', () => {
  it('retains closed files, reopens through the existing opener, and refreshes access order without duplicates', () => {
    $selectedStoredSessionId.set(owner.session)
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
    openPreview(file())
    closeRightRailTab($previewTabs.get()[0].id)
    now.mockReturnValue(2000)
    openPreview(file('other.md'))
    now.mockReturnValue(3000)
    openPreview($currentRecentPreviews.get()[1].target, 'explicit-link')

    expect($currentRecentPreviews.get().map(entry => [entry.target.label, entry.openedAt])).toEqual([
      ['notes.md', 3000],
      ['other.md', 2000]
    ])
    expect($previewTabs.get().map(tab => tab.target.label)).toEqual(['other.md', 'notes.md'])
    const persisted = localStorage.getItem('work4you.desktop.previewRecents.v1')!
    expect(decodeRecentPreviews(persisted)).toEqual($recentPreviews.get())
  })

  it('records actual navigation and page metadata without changing access time for favicon/title events', () => {
    $selectedStoredSessionId.set(owner.session)
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
    openPreview(web('https://example.com'))
    const id = $previewTabs.get()[0].id
    rememberPreviewTitle(id, 'Documentation')
    now.mockReturnValue(2000)
    rememberPreviewUrl(id, 'https://example.com/docs')
    now.mockReturnValue(3000)
    rememberPreviewTitle(id, 'Documentation')
    rememberPreviewIcon(id, 'https://example.com/icon.png')
    openPreview(web('https://another.example'))

    const sites = suggestedPreviewSites($currentRecentPreviews.get())
    expect(sites.map(entry => entry.target.url)).toEqual(['https://another.example', 'https://example.com/docs'])
    expect(sites[1]).toMatchObject({
      openedAt: 2000,
      icon: 'https://example.com/icon.png',
      target: { label: 'Documentation' }
    })
  })

  it('isolates conversation, profile and connection and removes only the archived owner', () => {
    $selectedStoredSessionId.set(owner.session)
    openPreview(file(), 'manual', owner)
    openPreview(file('b.md'), 'manual', { ...owner, session: 'chat-b' })
    openPreview(file('private.md'), 'manual', { ...owner, profile: 'private' })
    expect($currentRecentPreviews.get().map(entry => entry.target.label)).toEqual(['notes.md'])
    rescopeConnectionScopedStores({ mode: 'remote', baseUrl: 'https://remote.example', profile: 'default' })
    expect($currentRecentPreviews.get()).toEqual([])
    rescopeConnectionScopedStores({ mode: 'local' })
    expect($currentRecentPreviews.get()).toHaveLength(1)
    forgetPreviewSessions(['chat-a'], 'default')
    expect($currentRecentPreviews.get()).toEqual([])
    expect($recentPreviews.get().map(entry => entry.target.label)).toEqual(
      expect.arrayContaining(['b.md', 'private.md'])
    )
  })

  it('moves draft history even when its last tab was closed, then follows the conversation lineage', () => {
    openPreview(file())
    closeRightRailTab($previewTabs.get()[0].id)
    $activeSessionId.set('live-a')
    $selectedStoredSessionId.set('stored-a')
    expect($currentRecentPreviews.get()[0]?.target.label).toBe('notes.md')
    $sessions.set([{ id: 'stored-a', _lineage_root_id: 'root-a', profile: 'default' } as SessionInfo])
    expect($currentRecentPreviews.get()[0].owner.session).toBe('root-a')
  })

  it('does not retain blank pages or targets that cannot be restored', () => {
    openNewBrowserTab()
    openPreview({ kind: 'artifact', source: 'artifact:1', url: 'artifact:1', label: 'Transient' })
    openPreview({ ...file('temp.png'), dataUrl: 'data:image/png;base64,abc', previewKind: 'image' })
    openPreview({ ...file('remote.html'), transient: true })
    expect($recentPreviews.get()).toEqual([])
  })

  it('rejects malformed stored rows and credentials-bearing web URLs', () => {
    const base = { owner, openedAt: 1000, target: file() }
    expect(
      decodeRecentPreviews(
        JSON.stringify([
          null,
          {},
          { ...base, openedAt: 'yesterday' },
          { ...base, target: web('javascript:alert(1)') },
          { ...base, target: web('https://user:pass@example.com') },
          base
        ])
      )
    ).toEqual([base])
  })
})
