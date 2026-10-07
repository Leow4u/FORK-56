import { previewFaviconTarget } from '@work4you/shared'
import { atom, computed } from 'nanostores'

import { connectionScopedAtom } from '@/lib/connection-scoped'
import { isBlankPageUrl } from '@/lib/local-preview'
import { Codecs } from '@/lib/persisted'
import { stableArray } from '@/lib/stable-array'
import { normalize } from '@/lib/text'
import type { SessionInfo } from '@/types/work4you'

import { $rightRailActiveTabId, type RightRailTabId, selectRightRailTab } from './layout'
import { $activeGatewayProfile, normalizeProfileKey } from './profile-identity'
import {
  $activeSessionId,
  $selectedStoredSessionId,
  $sessions,
  lineageAliases,
  sessionMatchesStoredId,
  sessionPinId
} from './session'

/**
 * PREVIEW TABS — one list of tabs per conversation, one way in.
 *
 * Everything the content area can show is a `PreviewTarget`: a file on disk, a
 * live URL, or a generated artifact. There is no privileged "live preview" slot
 * alongside the tabs; `openPreview` is the only entry point, so a tool result,
 * a file-browser click, and an artifact card all travel the same road and
 * behave identically once open.
 *
 * Every tab belongs to the conversation that opened it: its `owner` is a
 * profile plus the conversation's lineage root, so compression can't orphan
 * it. A chat that has no conversation yet owns its tabs as the profile's
 * draft and hands them to the conversation its first message creates.
 * `$allPreviewTabs` is every owner's tabs, persisted per connection;
 * `$previewTabs` is the followed conversation's — what the strip, ⌘W, the
 * panes and the agent's page tools read. Switching conversations swaps that
 * view and closes nothing; tabs close when you close them, or when their
 * conversation is archived or deleted.
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

/** The conversation a tab belongs to. `session` is the conversation's lineage
 *  root (its stored id until the session row is known), or `PREVIEW_DRAFT` for
 *  a chat whose first message hasn't created a conversation yet. */
export interface PreviewOwner {
  profile: string
  session: string
}

export interface PreviewTab {
  id: RightRailTabId
  owner: PreviewOwner
  target: PreviewTarget
}

/** What a conversation remembers about its tabs while it is off screen. */
interface PreviewOwnerState {
  /** The tab that was in front. */
  active?: RightRailTabId
  /** The icon a web tab's page names, by tab id — beside its label, there
   *  before the page loads again. */
  icons?: Partial<Record<RightRailTabId, string>>
  /** The web tab that was last in front — where the agent's page tools turn
   *  when the tab in front isn't a page, and what the Browser shortcut brings
   *  back. */
  lastWeb?: RightRailTabId
  /** What a web tab's page is called, by tab id — the tab's label, there
   *  before the page loads again. */
  titles?: Partial<Record<RightRailTabId, string>>
  /** Where a web tab had navigated to, by tab id — it reopens there. */
  urls?: Partial<Record<RightRailTabId, string>>
}

/** What a conversation remembers about each web tab's page. */
const PAGE_RECORDS = ['icons', 'titles', 'urls'] as const

type PageRecord = (typeof PAGE_RECORDS)[number]

/** profile → conversation key → state. */
type PreviewOwnerStates = Record<string, Record<string, PreviewOwnerState>>

type OwnerRow = Pick<SessionInfo, '_lineage_root_id' | 'id' | 'profile'>

/** Owner session for tabs opened before a conversation exists. */
export const PREVIEW_DRAFT = 'draft'

// Connection-scoped: a conversation id is only meaningful against the backend
// that minted it.
const TABS_STORAGE_KEY = 'work4you.desktop.previewTabs.v4'
const OWNER_STATE_STORAGE_KEY = 'work4you.desktop.previewTabState.v1'

/** Superseded storage, cleared so it can't leak forever. Rows written before
 *  tabs had an owner can't be placed in a conversation, so they are dropped. */
const LEGACY_STORAGE_KEYS = [
  'work4you.desktop.sessionPreviews.v1',
  'work4you.desktop.previewTabs.v2',
  'work4you.desktop.previewTabs.v3'
]

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

function isPreviewOwner(value: unknown): value is PreviewOwner {
  if (!value || typeof value !== 'object') {
    return false
  }

  const r = value as Record<string, unknown>

  return typeof r.profile === 'string' && r.profile.length > 0 && typeof r.session === 'string' && r.session.length > 0
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
    isPreviewOwner(r.owner) &&
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

const ownerKey = (owner: PreviewOwner) => `${owner.profile}\u0000${owner.session}`

/** A conversation's first web tab's id. A web tab names the SURFACE
 *  (Browser), not its page — it moves between pages — so web tabs are
 *  numbered rather than keyed by address: the next ones are `url:browser:2`,
 *  `url:browser:3`… A page opens in its site's tab (`openPreview`). Files and
 *  artifacts stay keyed by identity. Declared ahead of the restore below,
 *  which keys legacy URL tabs with it while the module is still loading. */
const BROWSER_TAB_ID: RightRailTabId = 'url:browser'

const BROWSER_TAB_ID_RE = /^url:browser(?::\d+)?$/

/** The lowest web tab id none of `tabs` holds. */
function freeBrowserTabId(tabs: readonly PreviewTab[]): RightRailTabId {
  const taken = new Set<string>(tabs.map(tab => tab.id))

  if (!taken.has(BROWSER_TAB_ID)) {
    return BROWSER_TAB_ID
  }

  for (let n = 2; ; n += 1) {
    const id: RightRailTabId = `url:browser:${n}`

    if (!taken.has(id)) {
      return id
    }
  }
}

/** The id `target` opens under: a file or an artifact by what it shows; a page
 *  under the first web tab's — `openPreview` picks the web tab a page actually
 *  opens in. */
export function previewTabId(target: PreviewTarget): RightRailTabId {
  return target.kind === 'url' ? BROWSER_TAB_ID : `${target.kind}:${target.url}`
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

  // Web tabs keep their ids. A URL tab from a build that keyed tabs by address
  // moves onto a web tab id its conversation doesn't hold — all of them onto
  // the same one, so the last (the most recently opened page) is the one kept.
  const isLegacy = (tab: PreviewTab) => tab.target.kind === 'url' && !BROWSER_TAB_ID_RE.test(tab.id)

  const rekeyed = tabs.map(tab =>
    isLegacy(tab)
      ? {
          ...tab,
          id: freeBrowserTabId(tabs.filter(item => ownerKey(item.owner) === ownerKey(tab.owner) && !isLegacy(item)))
        }
      : tab
  )

  // A conversation holds one tab per id: of duplicates, the last wins.
  const slot = (tab: PreviewTab) => `${ownerKey(tab.owner)}\u0000${tab.id}`
  const lastBySlot = new Map(rekeyed.map(tab => [slot(tab), tab]))

  return rekeyed.filter(tab => lastBySlot.get(slot(tab)) === tab)
}

/** Every conversation's tabs. Read the followed conversation's through
 *  `$previewTabs`; write through the functions below. */
export const $allPreviewTabs = connectionScopedAtom<PreviewTab[]>(TABS_STORAGE_KEY, [], {
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

function sanitizeOwnerStates(value: unknown): PreviewOwnerStates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const states: PreviewOwnerStates = {}

  for (const [profile, sessions] of Object.entries(value)) {
    if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) {
      continue
    }

    for (const [session, state] of Object.entries(sessions)) {
      if (!state || typeof state !== 'object' || Array.isArray(state)) {
        continue
      }

      const record = state as Record<string, unknown>
      const next: PreviewOwnerState = {}

      if (typeof record.active === 'string') {
        next.active = record.active as RightRailTabId
      }

      if (typeof record.lastWeb === 'string') {
        next.lastWeb = record.lastWeb as RightRailTabId
      }

      for (const field of PAGE_RECORDS) {
        const entries = sanitizeTabTexts(record[field])

        if (entries) {
          next[field] = entries
        }
      }

      if (next.active || next.lastWeb || PAGE_RECORDS.some(field => next[field])) {
        states[profile] = { ...states[profile], [session]: next }
      }
    }
  }

  return states
}

/** A stored tab id → text map, keeping its text entries; undefined when none. */
function sanitizeTabTexts(value: unknown): Partial<Record<RightRailTabId, string>> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [RightRailTabId, string] => typeof entry[1] === 'string'
  )

  return entries.length ? Object.fromEntries(entries) : undefined
}

const $ownerStates = connectionScopedAtom<PreviewOwnerStates>(
  OWNER_STATE_STORAGE_KEY,
  {},
  Codecs.json(sanitizeOwnerStates)
)

if (typeof window !== 'undefined') {
  try {
    LEGACY_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key))
  } catch {
    // Storage access can throw in locked-down contexts; nothing depends on it.
  }
}

/** The row a stored id names. Ids are per profile — two profiles can hold the
 *  same one, and the lists mix profiles — so a tie breaks toward the live
 *  gateway: opening or running a session swaps the gateway onto its profile.
 *  Same rule as the unread store. */
function ownerRow(stored: string, sessions: readonly OwnerRow[], activeProfile: string): OwnerRow | undefined {
  const matches = sessions.filter(session => sessionMatchesStoredId(session, stored))

  if (matches.length < 2) {
    return matches[0]
  }

  const live = normalizeProfileKey(activeProfile)

  return matches.find(row => normalizeProfileKey(row.profile) === live) ?? matches[0]
}

/** The owner a conversation's tabs are kept under: its profile plus its
 *  lineage root, or the profile's draft when there is no conversation (null).
 *  The profile is the row's own (absent → "default", as everywhere sessions
 *  are scoped); with no row yet, the live gateway's. */
export function previewOwnerFor(
  storedSessionId: null | string | undefined,
  sessions: readonly OwnerRow[] = $sessions.get(),
  activeProfile: string = $activeGatewayProfile.get()
): PreviewOwner {
  const stored = storedSessionId?.trim() || null
  const row = stored ? ownerRow(stored, sessions, activeProfile) : undefined

  return {
    profile: normalizeProfileKey(row ? row.profile : activeProfile),
    session: row ? sessionPinId(row) : (stored ?? PREVIEW_DRAFT)
  }
}

/** Whether `candidate` names the same conversation as `owner` — across
 *  compression too: a tab written under a tip id before the session row was
 *  known still belongs to the lineage root it resolves to now. */
function sameOwner(owner: PreviewOwner, candidate: PreviewOwner, sessions: readonly OwnerRow[]): boolean {
  if (owner.profile !== candidate.profile) {
    return false
  }

  if (owner.session === candidate.session) {
    return true
  }

  if (owner.session === PREVIEW_DRAFT || candidate.session === PREVIEW_DRAFT) {
    return false
  }

  return lineageAliases(owner.session, sessions).includes(candidate.session)
}

/** A session tile the content area follows instead of the primary chat — the
 *  conversation the user last worked in, kept current by the area's wiring
 *  (it knows the layout). Null = follow the primary chat. */
export const $previewTileSession = atom<null | string>(null)

export function followPreviewTile(storedSessionId: null | string) {
  if ($previewTileSession.get() !== storedSessionId) {
    $previewTileSession.set(storedSessionId)
  }
}

/** The conversation the content area follows (null = the primary chat's draft). */
export const $previewSession = computed(
  [$previewTileSession, $selectedStoredSessionId],
  (tile, selected) => tile ?? selected
)

let followedOwner: PreviewOwner = previewOwnerFor($previewSession.get())

/** Owner of the followed conversation's tabs. Keeps its identity until the
 *  conversation really changes, so listeners don't fire on list refreshes. */
export const $previewOwner = computed(
  [$previewSession, $sessions, $activeGatewayProfile],
  (session, sessions, profile) => {
    const next = previewOwnerFor(session, sessions, profile)

    return next.profile === followedOwner.profile && next.session === followedOwner.session
      ? followedOwner
      : (followedOwner = next)
  }
)

/** A stable string for an owner — a React key or a map key. */
export const previewOwnerKey = ownerKey

/** Whether `owner` is the conversation on screen (undefined = an unattributed
 *  request, which speaks for the screen as it always has). */
export function isFollowedPreviewOwner(owner: PreviewOwner | undefined): boolean {
  return !owner || sameOwner($previewOwner.get(), owner, $sessions.get())
}

function tabsOf(owner: PreviewOwner, tabs = $allPreviewTabs.get(), sessions = $sessions.get()): PreviewTab[] {
  return tabs.filter(tab => sameOwner(owner, tab.owner, sessions))
}

let followedTabs: readonly PreviewTab[] = []

/** The followed conversation's tabs — what the strip, ⌘W, the panes and the
 *  agent's page tools read. */
export const $previewTabs = computed(
  [$allPreviewTabs, $previewOwner, $sessions],
  (tabs, owner, sessions) => (followedTabs = stableArray(followedTabs, tabsOf(owner, tabs, sessions)))
)

let allTabIds: readonly string[] = []

/** Every open tab id across conversations. A tab of a conversation that is off
 *  screen is out of view, not closed — its pane keeps its place in the layout. */
export const $allPreviewTabIds = computed(
  $allPreviewTabs,
  tabs => (allTabIds = stableArray(allTabIds, [...new Set(tabs.map(tab => tab.id))]))
)

function ownerStateKey(owner: PreviewOwner, states = $ownerStates.get(), sessions = $sessions.get()) {
  const bucket = states[owner.profile]

  if (!bucket) {
    return undefined
  }

  if (bucket[owner.session]) {
    return owner.session
  }

  return Object.keys(bucket).find(session => sameOwner(owner, { profile: owner.profile, session }, sessions))
}

function readOwnerState(owner: PreviewOwner): PreviewOwnerState | undefined {
  const key = ownerStateKey(owner)

  return key ? $ownerStates.get()[owner.profile]?.[key] : undefined
}

function writeOwnerState(owner: PreviewOwner, update: (state: PreviewOwnerState) => PreviewOwnerState) {
  const states = $ownerStates.get()
  const key = ownerStateKey(owner, states) ?? owner.session
  const bucket = { ...states[owner.profile] }
  const next = update(bucket[key] ?? {})

  const state: PreviewOwnerState = {
    ...(next.active ? { active: next.active } : {}),
    ...(next.lastWeb ? { lastWeb: next.lastWeb } : {})
  }

  for (const field of PAGE_RECORDS) {
    const entries = next[field]

    if (entries && Object.keys(entries).length) {
      state[field] = entries
    }
  }

  if (Object.keys(state).length) {
    bucket[key] = state
  } else {
    delete bucket[key]
  }

  const nextStates = { ...states }

  if (Object.keys(bucket).length) {
    nextStates[owner.profile] = bucket
  } else {
    delete nextStates[owner.profile]
  }

  $ownerStates.set(nextStates)
}

/** `state` without `tabId`'s entry in its `field` record. */
function withoutEntry(state: PreviewOwnerState, field: PageRecord, tabId: RightRailTabId): PreviewOwnerState {
  const entries = state[field]

  if (!entries?.[tabId]) {
    return state
  }

  const { [tabId]: _dropped, ...rest } = entries

  return { ...state, [field]: rest }
}

/** `tabId`'s page forgotten — where it had navigated, what it was called and
 *  its icon — for a tab that closed or was handed a new page. */
const withoutPage = (state: PreviewOwnerState, tabId: RightRailTabId) =>
  PAGE_RECORDS.reduce((next, field) => withoutEntry(next, field, tabId), state)

/** Two records of one conversation folded into one; `kept`'s entries win. */
function mergedOwnerState(kept: PreviewOwnerState, other: PreviewOwnerState): PreviewOwnerState {
  const merged: PreviewOwnerState = { active: kept.active ?? other.active, lastWeb: kept.lastWeb ?? other.lastWeb }

  for (const field of PAGE_RECORDS) {
    merged[field] = { ...other[field], ...kept[field] }
  }

  return merged
}

/** The tab the rail actually shows. A stale or missing selection falls back to
 *  the first tab, so the strip, `⌘W`, and the pane never disagree about which
 *  tab is on screen. */
function resolveActiveTab(tabs: readonly PreviewTab[], activeTabId: RightRailTabId | null): PreviewTab | null {
  return tabs.find(tab => tab.id === activeTabId) ?? tabs[0] ?? null
}

const isWebTab = (tab: PreviewTab | undefined): tab is PreviewTab => tab?.target.kind === 'url'

/** `state` with `tab` in front — and, a web tab, as the web tab last in front. */
function fronted(state: PreviewOwnerState, tab: PreviewTab): PreviewOwnerState {
  return { ...state, active: tab.id, ...(isWebTab(tab) ? { lastWeb: tab.id } : {}) }
}

/** Front `tabId` in the followed conversation, and remember it as the tab that
 *  conversation shows when the user comes back to it (and a web tab as the
 *  one it last had in front). */
export function selectPreviewTab(tabId: RightRailTabId | null) {
  const owner = $previewOwner.get()
  const tab = tabId ? tabsOf(owner).find(item => item.id === tabId) : undefined
  const state = readOwnerState(owner)

  selectRightRailTab(tabId)

  if ((state?.active ?? null) !== tabId || (isWebTab(tab) && state?.lastWeb !== tabId)) {
    writeOwnerState(owner, current => (tab ? fronted(current, tab) : { ...current, active: tabId ?? undefined }))
  }
}

let reconciledOwner = $previewOwner.get()

// The selection always names one of the followed conversation's tabs. Coming
// back to a conversation fronts the tab it had in front; otherwise a selection
// that no longer exists (a restored id that didn't survive validation, a tab
// closed elsewhere) falls back to the first tab.
function reconcileActiveTab() {
  const owner = $previewOwner.get()
  const tabs = $previewTabs.get()
  const current = $rightRailActiveTabId.get()
  const remembered = readOwnerState(owner)?.active
  const preferred = owner === reconciledOwner ? [current, remembered] : [remembered, current]

  reconciledOwner = owner

  const id = preferred.find(candidate => candidate && tabs.some(tab => tab.id === candidate)) ?? tabs[0]?.id ?? null

  if (id !== current) {
    selectRightRailTab(id)
  }
}

/** A draft just became a conversation: its tabs, and what it remembered about
 *  them, follow it. A tab the conversation already holds wins over the draft's. */
function adoptDraftPreviewTabs(storedSessionId: string) {
  const owner = previewOwnerFor(storedSessionId)
  const draft: PreviewOwner = { profile: owner.profile, session: PREVIEW_DRAFT }
  const all = $allPreviewTabs.get()

  if (owner.session === PREVIEW_DRAFT || !all.some(tab => sameOwner(draft, tab.owner, []))) {
    return
  }

  const held = new Set(tabsOf(owner, all).map(tab => tab.id))
  const draftState = readOwnerState(draft)

  $allPreviewTabs.set(
    all.flatMap(tab => (!sameOwner(draft, tab.owner, []) ? [tab] : held.has(tab.id) ? [] : [{ ...tab, owner }]))
  )

  if (draftState) {
    writeOwnerState(owner, state => mergedOwnerState(state, draftState))
    writeOwnerState(draft, () => ({}))
  }
}

// A draft's first message creates its conversation: the runtime goes live,
// then the stored id lands. Tabs opened meanwhile were the draft's; they belong
// to the conversation it just became. Resuming another conversation from an
// empty draft has no live runtime yet, so it never adopts. (Registered before
// the selection reconcile below, so the conversation already holds the draft's
// tabs when the area switches to it.)
let lastSelectedSessionId = $selectedStoredSessionId.get()

$selectedStoredSessionId.listen(selected => {
  const previous = lastSelectedSessionId

  lastSelectedSessionId = selected

  if (previous === null && selected && $activeSessionId.get()) {
    adoptDraftPreviewTabs(selected)
  }
})

// A tab (or remembered state) written under a conversation's live id before
// its session row was known moves onto the lineage root as soon as the row
// says what that is — the live id rotates on every compression, the root
// never does. Same move the composer makes for drafts.
function rootPreviewOwners(sessions: readonly OwnerRow[]) {
  // Only the owner's own profile's rows: the same id in another profile is
  // another conversation.
  const rootOf = ({ profile, session }: PreviewOwner) => {
    if (session === PREVIEW_DRAFT) {
      return session
    }

    const row = sessions.find(
      candidate => normalizeProfileKey(candidate.profile) === profile && sessionMatchesStoredId(candidate, session)
    )

    return row ? sessionPinId(row) : session
  }

  const tabs = $allPreviewTabs.get()

  if (tabs.some(tab => rootOf(tab.owner) !== tab.owner.session)) {
    $allPreviewTabs.set(
      tabs.map(tab => {
        const session = rootOf(tab.owner)

        return session === tab.owner.session ? tab : { ...tab, owner: { ...tab.owner, session } }
      })
    )
  }

  const states = $ownerStates.get()

  for (const [profile, bucket] of Object.entries(states)) {
    for (const [session, state] of Object.entries(bucket)) {
      const root = rootOf({ profile, session })

      if (root !== session) {
        writeOwnerState({ profile, session }, () => ({}))
        writeOwnerState({ profile, session: root }, current => mergedOwnerState(current, state))
      }
    }
  }
}

rootPreviewOwners($sessions.get())
$sessions.listen(rootPreviewOwners)

// What a conversation remembers is only about its tabs. One whose tabs didn't
// survive the restart (artifacts and remote pages are never kept) has nothing
// left to remember, so it isn't carried forward.
for (const [profile, bucket] of Object.entries($ownerStates.get())) {
  for (const session of Object.keys(bucket)) {
    if (!$allPreviewTabs.get().some(tab => sameOwner({ profile, session }, tab.owner, []))) {
      writeOwnerState({ profile, session }, () => ({}))
    }
  }
}

reconcileActiveTab()
$previewOwner.listen(reconcileActiveTab)
$previewTabs.listen(reconcileActiveTab)

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
 *  its target so a stale label/path can't outlive the thing it points at. A
 *  page opens in its site's web tab (`webTabFor`). The only way anything
 *  reaches a preview.
 *
 *  `owner` is the conversation the tab belongs to — the followed one unless
 *  said otherwise (an agent opens into its own conversation). A tab for a
 *  conversation that is off screen waits there, in front for when the user
 *  comes back; it never pulls the area over to it. */
export function openPreview(target: PreviewTarget, source: PreviewRecordSource = 'manual', owner?: PreviewOwner) {
  const resolved = previewTargetForSource(target, source)
  const tabOwner = owner ?? $previewOwner.get()
  const id = resolved.kind === 'url' ? webTabFor(tabOwner, resolved.url) : previewTabId(resolved)

  showInTab(id, resolved, tabOwner)
}

/** The site a page is on — its origin; null for a page without one (the blank
 *  page, a file). */
function siteOf(url: string): null | string {
  try {
    const { origin } = new URL(url)

    return origin === 'null' ? null : origin
  } catch {
    return null
  }
}

/** The web tab `owner`'s conversation opens `url` in — one tab per site: the
 *  tab already on that site, else a blank tab, else a new one. Where several
 *  qualify, the tab in front, then the web tab last in front, then the strip's
 *  order. */
function webTabFor(owner: PreviewOwner, url: string): RightRailTabId {
  const held = tabsOf(owner)
  const state = readOwnerState(owner)
  const front = isFollowedPreviewOwner(owner) ? $rightRailActiveTabId.get() : state?.active
  const preferred = [front, state?.lastWeb]

  const rank = (tab: PreviewTab) => {
    const at = preferred.indexOf(tab.id)

    return at === -1 ? preferred.length : at
  }

  const web = held.filter(isWebTab).sort((a, b) => rank(a) - rank(b))
  const pageOf = (tab: PreviewTab) => state?.urls?.[tab.id] ?? tab.target.url
  const site = siteOf(url)

  return (
    (site ? web.find(tab => siteOf(pageOf(tab)) === site) : undefined)?.id ??
    web.find(tab => isBlankPageUrl(pageOf(tab)))?.id ??
    freeBrowserTabId(held)
  )
}

/** Show `target` in `owner`'s tab `id` — a new tab when the conversation holds
 *  none under it — and bring the tab to the front of its conversation. */
function showInTab(id: RightRailTabId, target: PreviewTarget, owner: PreviewOwner) {
  const followed = $previewOwner.get()
  const sessions = $sessions.get()
  const current = $allPreviewTabs.get()
  const index = current.findIndex(tab => tab.id === id && sameOwner(owner, tab.owner, sessions))
  const previous = index === -1 ? null : current[index]
  const tab: PreviewTab = { id, owner: previous?.owner ?? owner, target }

  $allPreviewTabs.set(index === -1 ? [...current, tab] : current.map((item, i) => (i === index ? tab : item)))

  // A new page for the same tab: where the old page had navigated to, what it
  // was called and its icon no longer apply.
  if (previous && previous.target.url !== target.url) {
    writeOwnerState(tab.owner, state => withoutPage(state, id))
  }

  if (sameOwner(followed, tab.owner, sessions)) {
    selectPreviewTab(id)
  } else {
    writeOwnerState(tab.owner, state => fronted(state, tab))
  }
}

const BLANK_PAGE: PreviewTarget = { kind: 'url', label: 'Browser', source: 'about:blank', url: 'about:blank' }

/** Bring back the Browser — the surface, not a page: the conversation's web
 *  tab last in front, showing whatever it was, so the shortcut re-fronts your
 *  page instead of wiping it. With no web tab, a new one. */
export function openBrowserTab() {
  const owner = $previewOwner.get()
  const tab = lastWebTab(owner)

  if (tab) {
    showInTab(tab.id, tab.target, owner)
  } else {
    openNewBrowserTab()
  }
}

/** A new web tab on `about:blank`, where the pane shows the new tab page — the
 *  "+" in the area's strip. Always a new tab: the open ones keep their pages. */
export function openNewBrowserTab() {
  const owner = $previewOwner.get()

  showInTab(freeBrowserTabId(tabsOf(owner)), BLANK_PAGE, owner)
}

/** Close `owner`'s tab `tabId` (the followed conversation's by default). */
export function closeRightRailTab(tabId: string, owner?: PreviewOwner) {
  const followed = $previewOwner.get()
  const sessions = $sessions.get()
  const tabOwner = owner ?? followed
  const all = $allPreviewTabs.get()
  const owned = tabsOf(tabOwner, all, sessions)
  const index = owned.findIndex(tab => tab.id === tabId)

  if (index === -1) {
    return
  }

  const closing = owned[index]
  const next = owned.filter(tab => tab !== closing)
  const neighbour = next[Math.min(index, next.length - 1)]?.id ?? null

  $allPreviewTabs.set(all.filter(tab => tab !== closing))
  writeOwnerState(tabOwner, state => withoutPage(state, closing.id))

  if (sameOwner(followed, tabOwner, sessions)) {
    if ($rightRailActiveTabId.get() === tabId || next.length === 0) {
      selectPreviewTab(next.length ? neighbour : null)
    }
  } else if (readOwnerState(tabOwner)?.active === tabId) {
    writeOwnerState(tabOwner, state => ({ ...state, active: neighbour ?? undefined }))
  }
}

/** Close the tab showing `source`, if one is open. Returns whether it closed. */
export function closePreviewForSource(source: string): boolean {
  return closePreviewMatching(source)
}

/** Close the followed conversation's first tab whose source, url, or label
 *  matches any candidate. */
export function closePreviewMatching(...candidates: string[]): boolean {
  return closePreviewMatchingIn(undefined, ...candidates)
}

/** Close `owner`'s first tab whose source, url, or label matches any
 *  candidate (the followed conversation's when `owner` is undefined). Empty
 *  candidates are a no-op so a missed match cannot wipe the rail — closing
 *  every tab is `closeRightRail`. */
export function closePreviewMatchingIn(owner: PreviewOwner | undefined, ...candidates: string[]): boolean {
  const queries = [...new Set(candidates.map(value => value.trim()).filter(Boolean))]

  if (queries.length === 0) {
    return false
  }

  const tab = tabsOf(owner ?? $previewOwner.get()).find(item => {
    const fields = [item.target.source, item.target.url, item.target.label]

    return queries.some(query => fields.includes(query))
  })

  if (!tab) {
    return false
  }

  closeRightRailTab(tab.id, owner)

  return true
}

/** Artifact tabs can't outlive the registry they read from, so clearing it
 *  closes them — in every conversation. File and URL tabs re-read from their
 *  source and are left alone. */
export function closeArtifactPreviewTabs() {
  for (const tab of $allPreviewTabs.get()) {
    if (tab.target.kind === 'artifact') {
      closeRightRailTab(tab.id, tab.owner)
    }
  }
}

/** Close every tab of `owner` (the followed conversation by default), so its
 *  panes leave the tree. Other conversations keep theirs. */
export function closeRightRail(owner?: PreviewOwner) {
  const followed = $previewOwner.get()
  const sessions = $sessions.get()
  const tabOwner = owner ?? followed

  $allPreviewTabs.set($allPreviewTabs.get().filter(tab => !sameOwner(tabOwner, tab.owner, sessions)))
  writeOwnerState(tabOwner, () => ({}))

  if (sameOwner(followed, tabOwner, sessions)) {
    selectRightRailTab(null)
  }
}

/** The conversation is gone from the user's world (archived or deleted): its
 *  tabs and what it remembered about them go with it. Drops every candidate id
 *  (stored id, live id, lineage root) in `profile` — the row's own, absent →
 *  "default", like `forgetSessionUnread`. Same ids in other profiles survive. */
export function forgetPreviewSessions(
  candidateIds: readonly (null | string | undefined)[],
  profile?: null | string
): void {
  const ids = new Set(candidateIds.filter((id): id is string => Boolean(id) && id !== PREVIEW_DRAFT))

  if (!ids.size) {
    return
  }

  const key = normalizeProfileKey(profile)
  const gone = (owner: PreviewOwner) => owner.profile === key && ids.has(owner.session)
  const all = $allPreviewTabs.get()
  const kept = all.filter(tab => !gone(tab.owner))

  if (kept.length !== all.length) {
    $allPreviewTabs.set(kept)
  }

  const bucket = $ownerStates.get()[key]

  if (bucket && Object.keys(bucket).some(session => ids.has(session))) {
    for (const session of Object.keys(bucket)) {
      if (ids.has(session)) {
        writeOwnerState({ profile: key, session }, () => ({}))
      }
    }
  }
}

/** `owner`'s tabs and the one it shows in front — for reading a conversation
 *  that is off screen. */
export function previewTabsOf(owner: PreviewOwner): { active: PreviewTab | null; tabs: PreviewTab[] } {
  const tabs = tabsOf(owner)

  if (isFollowedPreviewOwner(owner)) {
    return { active: resolveActiveTab(tabs, $rightRailActiveTabId.get()), tabs }
  }

  return { active: resolveActiveTab(tabs, readOwnerState(owner)?.active ?? null), tabs }
}

/** `owner`'s web tab last in front — else its last web tab in the strip; null
 *  when it holds none. */
function lastWebTab(owner: PreviewOwner): PreviewTab | null {
  const web = tabsOf(owner).filter(isWebTab)
  const last = readOwnerState(owner)?.lastWeb

  return web.find(tab => tab.id === last) ?? web.at(-1) ?? null
}

/** Whether `target` shows a live page — a web tab, or an HTML file rendered as
 *  one: what the pane runs in a webview, and what the agent's page tools (read,
 *  drive, tour) work on. */
export function isPagePreview(target: PreviewTarget): boolean {
  return (
    target.kind === 'url' || (target.kind === 'file' && target.previewKind === 'html' && target.renderMode !== 'source')
  )
}

/** The tab the agent's page tools work on in `owner`'s conversation (the
 *  followed one by default): the tab in front when it shows a page, else the
 *  web tab last in front, else the tab in front — whose identity tells the
 *  agent what is there. Null when the conversation holds no tab. */
export function agentPreviewTab(owner: PreviewOwner = $previewOwner.get()): PreviewTab | null {
  const { active } = previewTabsOf(owner)

  if (active && isPagePreview(active.target)) {
    return active
  }

  return lastWebTab(owner) ?? active
}

/** Where `owner`'s web tab `tabId` had navigated to (the followed
 *  conversation's by default), when it left the page it was opened on — the
 *  address it reopens at. */
export function previewResumeUrl(tabId: string, owner: PreviewOwner = $previewOwner.get()): string | undefined {
  return readOwnerState(owner)?.urls?.[tabId as RightRailTabId]
}

/** Remember where `owner`'s web tab `tabId` has navigated (the followed
 *  conversation's by default), so switching away and back (or reopening the
 *  app) returns to that page instead of the one it was opened on. */
export function rememberPreviewUrl(tabId: string, url: string, owner: PreviewOwner = $previewOwner.get()) {
  const tab = tabsOf(owner).find(item => item.id === tabId)

  if (!tab || !url) {
    return
  }

  if (url === tab.target.url) {
    if (previewResumeUrl(tab.id, owner)) {
      writeOwnerState(owner, state => withoutEntry(state, 'urls', tab.id))
    }

    return
  }

  if (previewResumeUrl(tab.id, owner) !== url) {
    writeOwnerState(owner, state => ({ ...state, urls: { ...state.urls, [tab.id]: url } }))
  }
}

/** Keep `text` as `owner`'s web tab `tabId`'s entry in its `field` record;
 *  empty forgets it. A file is named by the file, so only a web tab keeps
 *  one. */
function rememberPageEntry(field: 'icons' | 'titles', tabId: string, text: string, owner: PreviewOwner) {
  const tab = tabsOf(owner).find(item => item.id === tabId)

  if (!tab || tab.target.kind !== 'url' || (readOwnerState(owner)?.[field]?.[tab.id] ?? '') === text) {
    return
  }

  writeOwnerState(owner, state =>
    text ? { ...state, [field]: { ...state[field], [tab.id]: text } } : withoutEntry(state, field, tab.id)
  )
}

/** Remember what the page in `owner`'s web tab `tabId` is called (the
 *  followed conversation's by default) — the tab's label, kept with its
 *  address so the tab is named before the page loads again. Empty forgets it. */
export function rememberPreviewTitle(tabId: string, title: string, owner: PreviewOwner = $previewOwner.get()) {
  rememberPageEntry('titles', tabId, title.trim(), owner)
}

/** Remember the icon the page in `owner`'s web tab `tabId` names (the
 *  followed conversation's by default) — beside the tab's label, kept with its
 *  title. Only an http(s) icon is kept: anything else forgets it. */
export function rememberPreviewIcon(tabId: string, url: string, owner: PreviewOwner = $previewOwner.get()) {
  rememberPageEntry('icons', tabId, previewFaviconTarget(url) ?? '', owner)
}

/** Where a web tab is, what its page is called, and its icon. */
export interface PreviewPage {
  /** The icon its page named, once it has — http(s) only. */
  icon?: string
  /** The title its page reported, once it has. */
  title?: string
  /** The address it is on: where it had navigated, else where it opened. */
  url: string
}

/** The followed conversation's web tabs as pages, by tab id — what the strip
 *  labels them with, live. */
export const $previewPages = computed(
  [$previewTabs, $ownerStates, $previewOwner, $sessions],
  (tabs, states, owner, sessions): Partial<Record<RightRailTabId, PreviewPage>> => {
    const key = ownerStateKey(owner, states, sessions)
    const state = key ? states[owner.profile]?.[key] : undefined

    return Object.fromEntries(
      tabs.flatMap(({ id, target }) => {
        if (target.kind !== 'url') {
          return []
        }

        const page: PreviewPage = {
          icon: state?.icons?.[id],
          title: state?.titles?.[id],
          url: state?.urls?.[id] ?? target.url
        }

        return [[id, page]]
      })
    )
  }
)

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
