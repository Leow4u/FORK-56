/**
 * Pure copy-selection for the updates overlay's "available" state.
 *
 * Names the update target (client vs the connected backend in remote mode) and
 * degrades honestly when there's no commit changelog to show (e.g. a pip /
 * non-git backend where `git log` yields nothing) instead of generic filler.
 *
 * Extracted from updates-overlay.tsx so the wording logic is unit-testable.
 */

export type UpdateTarget = 'client' | 'backend'
export type UpdateChannel = 'git' | 'installer' | 'chrome'

export interface UpdateCopyStrings {
  availableTitle: string
  availableBody: string
  availableTitleBackend: string
  availableBodyBackend: string
  availableBodyNoChangelog: string
  availableBodyInstaller: string
  availableBodyChrome: string
}

export interface UpdateFinalizeCopy {
  restartToFinish: string
  updateNow: string
}

export interface ResolveUpdateFinalizeInput {
  channel?: UpdateChannel
  prefetchReady?: boolean
  prefetchError?: string | null
  prefetchPercent?: number | null
  copy: UpdateFinalizeCopy
}

export interface UpdateFinalizeAction {
  disabled: boolean
  label: string
}

export interface ResolveUpdateCopyInput {
  target: UpdateTarget
  /** Number of commit rows actually shown in the changelog. 0 → no notes. */
  shownItems: number
  copy: UpdateCopyStrings
  channel?: UpdateChannel
}

export interface UpdateCopyResult {
  title: string
  body: string
}

export function resolveUpdateCopy({ target, shownItems, copy, channel }: ResolveUpdateCopyInput): UpdateCopyResult {
  const title = target === 'backend' ? copy.availableTitleBackend : copy.availableTitle

  if (channel === 'chrome' && target === 'client') {
    return { title, body: copy.availableBodyChrome }
  }

  if (channel === 'installer' && target === 'client') {
    return { title, body: copy.availableBodyInstaller }
  }

  const body =
    shownItems === 0
      ? copy.availableBodyNoChangelog
      : target === 'backend'
        ? copy.availableBodyBackend
        : copy.availableBody

  return { title, body }
}

export function resolveUpdateFinalizeAction({
  channel,
  copy,
  prefetchError,
  prefetchPercent,
  prefetchReady
}: ResolveUpdateFinalizeInput): UpdateFinalizeAction {
  // Installer clicks download then quit. Only the dormant chrome channel
  // waits on a background prefetch.
  if (channel !== 'chrome') {
    return { disabled: false, label: copy.updateNow }
  }

  if (prefetchReady) {
    return {
      disabled: false,
      label: channel === 'chrome' ? copy.restartToFinish : copy.updateNow
    }
  }

  if (prefetchError) {
    return { disabled: false, label: copy.updateNow }
  }

  if (typeof prefetchPercent === 'number' && Number.isFinite(prefetchPercent)) {
    return { disabled: true, label: `${Math.max(0, Math.min(100, Math.round(prefetchPercent)))}%` }
  }

  return { disabled: true, label: copy.updateNow }
}
