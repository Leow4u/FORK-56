import { atom, computed, type ReadableAtom } from 'nanostores'

import { $activityDensity } from './activity-density'

export type ToolViewMode = 'product' | 'technical'

type ToolDisclosureStates = Record<string, boolean>

const TOOL_DISCLOSURE_STORAGE_KEY = 'work4you.desktop.toolDisclosure.v1'
const MAX_DISCLOSURE_STATES = 240

// How a tool row renders follows the transcript density. Detailed is the
// technical view — every row expands and carries its raw payload; Compact and
// Balanced are the product view. The old standalone technical toggle is gone,
// and a choice it stored is not restored.
export const $toolViewMode: ReadableAtom<ToolViewMode> = computed($activityDensity, density =>
  density === 'detailed' ? 'technical' : 'product'
)
export const $toolDisclosureStates = atom<ToolDisclosureStates>(loadToolDisclosureStates())
const disclosureOpenCache = new Map<string, ReadableAtom<boolean | undefined>>()
const anyDisclosureOpenCache = new Map<string, ReadableAtom<boolean>>()

$toolDisclosureStates.subscribe(persistToolDisclosureStates)

export function $toolDisclosureOpen(id: string): ReadableAtom<boolean | undefined> {
  let cached = disclosureOpenCache.get(id)

  if (!cached) {
    cached = computed($toolDisclosureStates, states => states[id])
    disclosureOpenCache.set(id, cached)
  }

  return cached
}

/**
 * Whether any of a set of disclosures is open — a run asking about its rows.
 *
 * Computed rather than reading the whole map so a toggle anywhere in the
 * transcript only re-renders the runs whose own answer changed.
 */
export function $anyToolDisclosureOpen(ids: readonly string[]): ReadableAtom<boolean> {
  const key = ids.join('|')
  let cached = anyDisclosureOpenCache.get(key)

  if (!cached) {
    cached = computed($toolDisclosureStates, states => ids.some(id => Boolean(states[id])))
    anyDisclosureOpenCache.set(key, cached)
  }

  return cached
}

function loadToolDisclosureStates(): ToolDisclosureStates {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(TOOL_DISCLOSURE_STORAGE_KEY)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, boolean] => typeof entry[0] === 'string' && typeof entry[1] === 'boolean')
        .slice(-MAX_DISCLOSURE_STATES)
    )
  } catch {
    return {}
  }
}

function persistToolDisclosureStates(states: ToolDisclosureStates) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const entries = Object.entries(states).slice(-MAX_DISCLOSURE_STATES)

    window.localStorage.setItem(TOOL_DISCLOSURE_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Tool disclosure is a local UI preference; ignore storage failures.
  }
}

export function setToolDisclosureOpen(id: string, open: boolean) {
  if (!id) {
    return
  }

  const current = $toolDisclosureStates.get()

  if (current[id] === open) {
    return
  }

  $toolDisclosureStates.set({ ...current, [id]: open })
}
