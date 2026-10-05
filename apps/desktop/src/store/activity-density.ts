import { type Codec, persistentAtom } from '@/lib/persisted'

/**
 * How much of the agent's work the transcript shows, a device preference.
 *
 * - `compact`: while the agent works, one status line; a finished turn is one
 *   line that opens into the work list.
 * - `balanced` (default): a summary of what is done, the newest note the agent
 *   wrote along the way, and the status line — never more than a few lines
 *   however long the turn runs.
 * - `detailed`: every thought, call and payload, as it happens. Nothing is
 *   folded or hidden.
 *
 * Questions, approvals and the files a turn changed stay on screen at every
 * level: they ask for something, or they are what the turn delivered.
 */
export type ActivityDensity = 'balanced' | 'compact' | 'detailed'

const STORAGE_KEY = 'work4you.desktop.activityDensity'

const densityCodec: Codec<ActivityDensity> = {
  decode: raw => (raw === 'compact' || raw === 'detailed' ? raw : 'balanced'),
  encode: value => value
}

export const $activityDensity = persistentAtom<ActivityDensity>(STORAGE_KEY, 'balanced', densityCodec)

export function setActivityDensity(density: ActivityDensity) {
  $activityDensity.set(density)
}
