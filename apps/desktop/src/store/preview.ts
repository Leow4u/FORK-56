import { atom, computed } from 'nanostores'

import { persistentAtom } from '@/lib/persisted'
import { normalize } from '@/lib/text'

import { $rightRailActiveTabId, type RightRailTabId, selectRightRailTab } from './layout'
import { $activeSessionId, $selectedStoredSessionId, $sessions, resolveComposerSessionKey } from './session'

/**
 * PREVIEW RAIL — one list of tabs, one way in.
 *
 * Everything the rail can show is a `PreviewTarget` in `$previewTabs`: a file
 * on disk, a live URL, or a generated artifact. There is no privileged "live
 * preview" slot alongside the tabs; `openPreview` is the only entry point, so
 * a tool result, a file-browser click, and an artifact card all travel the
 * same road and behave identically once open.
 *
 * Every tab belongs to the conversation that opened it (`sessionId`, keyed on
 * the durable lineage root so compression can't orphan it). The rail only ever
 * shows the focused conversation's tabs: switching away hides them, switching
 * back restores them, and closing one never touches another conversation.
 * `$previewTabs` is that scoped view; `$allPreviewTabs` is the persisted whole.
 */

export interface PreviewTarget {
  binary?: boolean
  byteSize?: number
  /** Inline image bytes (a `data:` URL) when the renderer already holds them —
   * e.g. a pasted/dropped screenshot whose only on-disk copy is a transient
   * path the preview can't reliably re-read. Rendered directly and NOT
   * persisted (it would bloat localStorage). */
  dataUrl?: string
  /** `artifact` targets have nothing behind them on disk or on the network —
   * `url` is an id into the artifact registry, which owns the content. They
   * are what lets the rail preview generated HTML the workspace never saw. */
  kind: 'artifact' | 'file' | 'url'
  label: string
  large?: boolean
  language?: string
  mimeType?: string
  path?: string
  previewKind?: 'binary' | 'html' | 'image' | 'pdf' | 'text'
  renderMode?: 'preview' | 'source'
  source: string
  /** Runtime-only target that cannot be restored from persisted state. */
  transient?: boolean
  url: string
}

export interface PreviewServerRestart {
  message?: string
  status: 'complete' | 'error' | 'running'
  taskId: string
  url: string
}

/** Where an open came from. Only affects how an HTML file is first rendered:
 *  browsing files is "peek at the source", a tool/link handing you something is
 *  "run it". Not a separate code path — just a property of the target. */
export type PreviewRecordSource = 'explicit-link' | 'file-browser' | 'manual' | 'tool-result'

export interface PreviewTab {
  id: RightRailTabId
  /** The conversation that owns this tab (lineage-root id, or the draft scope). */
  sessionId: string
  target: PreviewTarget
}

const TABS_STORAGE_KEY = 'work4you.desktop.previewTabs.v3'
/** Superseded storage, cleared so it can't leak forever. The v2 rows carried no
 *  owning conversation, so they are dropped instead of migrated. */
const LEGACY_STORAGE_KEYS = ['work4you.desktop.sessionPreviews.v1', 'work4you.desktop.previewTabs.v2']

/** Owner of tabs opened before the first message creates a session. */
export const DRAFT_PREVIEW_SCOPE = 'draft'

function isPreviewTarget(value: unknown): value is PreviewTarget {
  if (!value || typeof value !== 'object') {
    return false
  }

  const r = value as Record<string, unknown>

  return (
    (r.kind === 'artifact' || r.kind === 'file' || r.kind === 'url') &&
    typeof r.label === 'string' &&
    typeof r.source === 'string' &&
    typeof r.url === 'string'
  )
}

// Artifact tabs are never written (their registry is memory-only), so a
// restored artifact row is stale storage — drop it rather than reviving a tab
// with nothing behind it.
function isPreviewTab(value: unknown): value is PreviewTab {
  if (!value || typeof value !== 'object') {
    return false
  }

  const r = value as Record<string, unknown>

  return (
    typeof r.id === 'string' &&
    (r.id.startsWith('file:') || r.id.startsWith('url:')) &&
    typeof r.sessionId === 'string' &&
    r.sessionId.length > 0 &&
    isPreviewTarget(r.target)
  )
}

function isPdfFileTarget(target: PreviewTarget): boolean {
  if (target.kind !== 'file') {
    return false
  }

  if (target.mimeType?.toLowerCase() === 'application/pdf') {
    return true
  }

  if ([target.path, target.source].some(value => (value ? /\.pdf$/i.test(value) : false))) {
    return true
  }

  try {
    return /\.pdf$/i.test(new URL(target.url).pathname)
  } catch {
    return false
  }
}

/** Upgrade tabs persisted by builds that classified PDFs as generic binary.
 * Without this restore-time migration, an already-open PDF keeps taking the
 * obsolete raw-binary path after Desktop itself has been upgraded. */
export function decodePreviewTabs(raw: string): PreviewTab[] {
  const parsed = JSON.parse(raw) as unknown

  const tabs = (Array.isArray(parsed) ? parsed.filter(isPreviewTab) : []).map(tab =>
    isPdfFileTarget(tab.target) && tab.target.previewKind === 'binary'
      ? { ...tab, target: { ...tab.target, previewKind: 'pdf' as const } }
      : tab
  )

  // One Browser per conversation: rekey restored URL tabs onto the singleton id
  // and keep only the LAST of each conversation — the most recently opened page
  // is the one its browser shows.
  const lastUrlBySession = new Map<string, PreviewTab>()

  for (const tab of tabs) {
    if (tab.target.kind === 'url') {
      lastUrlBySession.set(tab.sessionId, tab)
    }
  }

  return tabs
    .filter(tab => tab.target.kind !== 'url' || lastUrlBySession.get(tab.sessionId) === tab)
    .map(tab => (tab.target.kind === 'url' ? { ...tab, id: previewTabId(tab.target) } : tab))
}

/** Every conversation's tabs, persisted. Read it through `$previewTabs`. */
export const $allPreviewTabs = persistentAtom<PreviewTab[]>(TABS_STORAGE_KEY, [], {
  decode: decodePreviewTabs,
  // Inline bytes are not restorable. Strip them from images, and skip remote
  // HTML and artifact tabs that cannot render without their in-memory payload.
  encode: tabs =>
    JSON.stringify(
      tabs.filter(
        tab =>
          tab.target.kind !== 'artifact' &&
          !tab.target.transient &&
          !(tab.target.previewKind === 'html' && tab.target.dataUrl)
      ),
      (key, value) => (key === 'dataUrl' ? undefined : value)
    )
})

if (typeof window !== 'undefined') {
  try {
    LEGACY_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key))
  } catch {
    // Storage access can throw in locked-down contexts; nothing depends on it.
  }
}

/** The conversation whose tabs the rail shows: the primary selection's lineage
 *  root, so compression's id rotation keeps its tabs, or the draft scope. */
export const $previewScope = computed(
  [$selectedStoredSessionId, $sessions],
  (selected, sessions) => resolveComposerSessionKey(selected, sessions) ?? DRAFT_PREVIEW_SCOPE
)

// A draft whose runtime is already live gets its stored id a beat later (the
// first message creates the session). Tabs opened meanwhile were scoped to the
// draft; they belong to the conversation it just became. Resuming some OTHER
// conversation from an empty draft has no live runtime yet, so it never adopts.
let lastSelectedSessionId = $selectedStoredSessionId.get()

$selectedStoredSessionId.listen(selected => {
  const previous = lastSelectedSessionId

  lastSelectedSessionId = selected

  if (previous === null && selected && $activeSessionId.get()) {
    adoptDraftPreviewTabs(selected)
  }
})

/** The focused conversation's tabs — what the rail, ⌘W and the panes read. */
export const $previewTabs = computed([$allPreviewTabs, $previewScope], (tabs, scope) =>
  tabs.filter(tab => tab.sessionId === scope)
)

/** The tab the rail actually shows. A stale or missing selection falls back to
 *  the first tab, so the strip, `⌘W`, and the pane never disagree about which
 *  tab is on screen. */
function resolveActiveTab(tabs: PreviewTab[], activeTabId: RightRailTabId | null): PreviewTab | null {
  return tabs.find(tab => tab.id === activeTabId) ?? tabs[0] ?? null
}

function activePreviewTab(): PreviewTab | null {
  return resolveActiveTab($previewTabs.get(), $rightRailActiveTabId.get())
}

// A restored active id whose tab didn't survive validation would leave the rail
// pointing at nothing — and so would a switch to a conversation that doesn't own
// the previously selected tab.
const reconcileActiveTab = () => selectRightRailTab(activePreviewTab()?.id ?? null)

reconcileActiveTab()
$previewScope.listen(reconcileActiveTab)

/** The target the rail is currently showing, or null when it has no tabs. */
export const $previewTarget = computed(
  [$previewTabs, $rightRailActiveTabId],
  (tabs, activeTabId) => resolveActiveTab(tabs, activeTabId)?.target ?? null
)

/** Raw `source` strings of every open tab, for the composer rows that toggle a
 *  preview open and closed by the target they were handed. */
export const $previewTabSources = computed($previewTabs, tabs => tabs.map(tab => tab.target.source))

export const $previewReloadRequest = atom(0)
export const $previewServerRestart = atom<PreviewServerRestart | null>(null)
export const $previewServerRestartStatus = computed($previewServerRestart, restart => restart?.status ?? 'idle')

/** The one Browser tab's id. URL targets all share it: the tab names the
 *  SURFACE (Browser), not the page, so opening a second URL navigates the
 *  browser it already has — re-front the tab, swap its target, and the pane
 *  rebuilds its webview against the new url. Files and artifacts stay keyed
 *  by identity; only the web surface is a singleton. */
const BROWSER_TAB_ID: RightRailTabId = 'url:browser'

export function previewTabId(target: PreviewTarget): RightRailTabId {
  return target.kind === 'url' ? BROWSER_TAB_ID : `${target.kind}:${target.url}`
}

// Browsing files is "peek at the source"; a tool or an explicit link handing
// you an HTML file means "run it".
function isFilePreviewSource(source: PreviewRecordSource): boolean {
  return source === 'file-browser' || source === 'manual'
}

function previewTargetForSource(target: PreviewTarget, source: PreviewRecordSource): PreviewTarget {
  if (target.kind !== 'file' || target.previewKind !== 'html' || target.renderMode === 'source') {
    return target
  }

  return { ...target, renderMode: isFilePreviewSource(source) ? 'source' : 'preview' }
}

/** Open (or re-front) the tab for `target`. Re-opening an existing tab refreshes
 *  its target so a stale label/path can't outlive the thing it points at. The
 *  only way anything reaches a preview. */
export function openPreview(target: PreviewTarget, source: PreviewRecordSource = 'manual') {
  const resolved = previewTargetForSource(target, source)
  const id = previewTabId(resolved)
  const sessionId = $previewScope.get()
  const current = $allPreviewTabs.get()
  const index = current.findIndex(tab => tab.id === id && tab.sessionId === sessionId)
  const tab: PreviewTab = { id, sessionId, target: resolved }

  $allPreviewTabs.set(index === -1 ? [...current, tab] : current.map((item, i) => (i === index ? tab : item)))
  selectRightRailTab(id)
}

/** Open the Browser tab — the surface, not a page. Keeps whatever it was last
 *  showing so the hotkey re-fronts your page instead of wiping it; a fresh tab
 *  lands on `about:blank`, where the pane's empty state invites an address. */
export function openBrowserTab() {
  const existing = $previewTabs.get().find(tab => tab.id === BROWSER_TAB_ID)

  openPreview(existing?.target ?? { kind: 'url', label: 'Browser', source: 'about:blank', url: 'about:blank' })
}

export function closeRightRailTab(tabId: string) {
  const sessionId = $previewScope.get()
  const current = $previewTabs.get()
  const index = current.findIndex(tab => tab.id === tabId)

  if (index === -1) {
    return
  }

  const next = current.filter(tab => tab.id !== tabId)

  $allPreviewTabs.set($allPreviewTabs.get().filter(tab => !(tab.id === tabId && tab.sessionId === sessionId)))

  if ($rightRailActiveTabId.get() === tabId) {
    selectRightRailTab(next[Math.min(index, next.length - 1)]?.id ?? null)
  }

  if (next.length === 0) {
    selectRightRailTab(null)
  }
}

/** Close the tab showing `source`, if one is open. Returns whether it closed. */
export function closePreviewForSource(source: string): boolean {
  return closePreviewMatching(source)
}

/** Close the first tab whose source, url, or label matches any candidate.
 *  Empty candidates are a no-op so a missed match cannot wipe the rail —
 *  closing the whole pane is `closeRightRail`. */
export function closePreviewMatching(...candidates: string[]): boolean {
  const queries = [...new Set(candidates.map(value => value.trim()).filter(Boolean))]

  if (queries.length === 0) {
    return false
  }

  const tab = $previewTabs.get().find(item => {
    const fields = [item.target.source, item.target.url, item.target.label]

    return queries.some(query => fields.includes(query))
  })

  if (!tab) {
    return false
  }

  closeRightRailTab(tab.id)

  return true
}

/** Artifact tabs can't outlive the registry they read from, so clearing it
 *  closes them. File and URL tabs re-read from their source and are left alone. */
export function closeArtifactPreviewTabs() {
  for (const tab of $previewTabs.get()) {
    if (tab.target.kind === 'artifact') {
      closeRightRailTab(tab.id)
    }
  }

  // Other conversations' artifact tabs are just as stale, and have no pane open.
  $allPreviewTabs.set($allPreviewTabs.get().filter(tab => tab.target.kind !== 'artifact'))
}

/** Close the focused conversation's tabs so its panes leave the tree. Other
 *  conversations keep theirs. */
export function closeRightRail() {
  const sessionId = $previewScope.get()

  $allPreviewTabs.set($allPreviewTabs.get().filter(tab => tab.sessionId !== sessionId))
  selectRightRailTab(null)
}

/** A draft just became a real conversation: its tabs follow it. A tab the new
 *  conversation already holds wins over the draft's copy. */
function adoptDraftPreviewTabs(sessionId: string) {
  const key = resolveComposerSessionKey(sessionId.trim(), $sessions.get()) ?? ''
  const all = $allPreviewTabs.get()

  if (!key || key === DRAFT_PREVIEW_SCOPE || !all.some(tab => tab.sessionId === DRAFT_PREVIEW_SCOPE)) {
    return
  }

  const owned = new Set(all.filter(tab => tab.sessionId === key).map(tab => tab.id))

  $allPreviewTabs.set(
    all.flatMap(tab =>
      tab.sessionId !== DRAFT_PREVIEW_SCOPE ? [tab] : owned.has(tab.id) ? [] : [{ ...tab, sessionId: key }]
    )
  )
}

export function requestPreviewReload() {
  $previewReloadRequest.set($previewReloadRequest.get() + 1)
}

export function beginPreviewServerRestart(taskId: string, url: string) {
  $previewServerRestart.set({ status: 'running', taskId, url })
}

export function completePreviewServerRestart(taskId: string, text: string) {
  const current = $previewServerRestart.get()

  if (current?.taskId !== taskId) {
    return
  }

  $previewServerRestart.set({
    ...current,
    message: text,
    status: normalize(text).startsWith('error:') ? 'error' : 'complete'
  })
}

export function progressPreviewServerRestart(taskId: string, text: string) {
  const current = $previewServerRestart.get()

  if (current?.taskId !== taskId || current.status !== 'running') {
    return
  }

  $previewServerRestart.set({
    ...current,
    message: text
  })
}

export function failPreviewServerRestart(taskId: string, message: string) {
  const current = $previewServerRestart.get()

  if (current?.taskId !== taskId || current.status !== 'running') {
    return
  }

  $previewServerRestart.set({
    ...current,
    message,
    status: 'error'
  })
}
