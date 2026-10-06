import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

/**
 * How much of the agent's work the transcript shows, a device preference —
 * the same three levels as the desktop app (apps/desktop/src/store/activity-density.ts).
 *
 * - `compact` (default): while the agent works, one status line; a finished
 *   turn is one line that opens into the work list.
 * - `balanced`: a summary of what is done, the newest note the agent wrote
 *   along the way, and the status line — never more than a few lines however
 *   long the turn runs.
 * - `detailed`: every thought, call and payload, as it happens. Nothing is
 *   folded or hidden.
 *
 * Questions, approvals and the files a turn changed stay on screen at every
 * level: they ask for something, or they are what the turn delivered.
 */
export type ActivityDensity = 'balanced' | 'compact' | 'detailed'

const STORAGE_KEY = 'work4you.desktop.activityDensity'

function decode(raw: null | string): ActivityDensity {
  return raw === 'balanced' || raw === 'detailed' ? raw : 'compact'
}

export const $activityDensity = atom<ActivityDensity>(decode(storedString(STORAGE_KEY)))

$activityDensity.subscribe(value => persistString(STORAGE_KEY, value))

export function setActivityDensity(density: ActivityDensity) {
  $activityDensity.set(density)
}
