import { previewFaviconTarget } from '@work4you/shared'

import { connectionScopedAtom } from '@/lib/connection-scoped'

import type { PreviewOwner, PreviewTarget } from './preview'

export interface RecentPreview {
  icon?: string
  openedAt: number
  owner: PreviewOwner
  target: PreviewTarget
}

// Metadata only, bounded across this connection. Never persist inline payloads
// or artifact IDs whose content disappears when the transcript unmounts.
const MAX_RECENTS = 200
const sameOwner = (a: PreviewOwner, b: PreviewOwner) => a.profile === b.profile && a.session === b.session
const sameTarget = (a: PreviewTarget, b: PreviewTarget) => a.kind === b.kind && a.url === b.url

function restorableTarget(target: PreviewTarget): PreviewTarget | null {
  if (target.transient || target.dataUrl || target.kind === 'artifact') {
    return null
  }

  if (target.kind === 'url') {
    try {
      const url = new URL(target.url)

      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        return null
      }
    } catch {
      return null
    }
  } else if (!target.path) {
    return null
  }

  return target
}

function compact(entries: RecentPreview[]): RecentPreview[] {
  const seen = new Set<string>()

  return entries
    .sort((a, b) => b.openedAt - a.openedAt)
    .filter(entry => {
      const key = JSON.stringify([entry.owner.profile, entry.owner.session, entry.target.kind, entry.target.url])

      if (seen.has(key)) {
        return false
      }

      seen.add(key)

      return true
    })
    .slice(0, MAX_RECENTS)
}

export function decodeRecentPreviews(raw: string): RecentPreview[] {
  const parsed: unknown = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    return []
  }

  return compact(
    parsed.filter((entry): entry is RecentPreview => {
      const target = entry?.target

      return (
        typeof entry?.owner?.profile === 'string' &&
        typeof entry?.owner?.session === 'string' &&
        Number.isFinite(entry.openedAt) &&
        Number.isFinite(new Date(entry.openedAt).getTime()) &&
        entry.openedAt > 0 &&
        target &&
        ['file', 'url'].includes(target.kind) &&
        typeof target.url === 'string' &&
        typeof target.label === 'string' &&
        typeof target.source === 'string' &&
        (target.kind !== 'file' || typeof target.path === 'string') &&
        Boolean(restorableTarget(target)) &&
        (entry.icon === undefined || previewFaviconTarget(entry.icon) === entry.icon)
      )
    })
  )
}

export const $recentPreviews = connectionScopedAtom<RecentPreview[]>('work4you.desktop.previewRecents.v1', [], {
  decode: decodeRecentPreviews,
  encode: JSON.stringify
})

export function recordPreviewVisit(target: PreviewTarget, owner: PreviewOwner) {
  const kept = restorableTarget(target)

  if (!kept) {
    return
  }

  const entries = $recentPreviews.get()
  const previous = entries.find(entry => sameOwner(entry.owner, owner) && sameTarget(entry.target, target))

  $recentPreviews.set(
    compact([
      {
        ...previous,
        openedAt: Date.now(),
        owner,
        target:
          previous && kept.kind === 'url' && kept.label === kept.url ? { ...kept, label: previous.target.label } : kept
      },
      ...entries.filter(entry => !sameOwner(entry.owner, owner) || !sameTarget(entry.target, target))
    ])
  )
}

/** Page metadata arriving after navigation must not count as another visit. */
export function updateRecentPage(owner: PreviewOwner, url: string, field: 'icon' | 'title', value: string) {
  const entries = $recentPreviews.get()

  const index = entries.findIndex(
    entry => sameOwner(entry.owner, owner) && entry.target.kind === 'url' && entry.target.url === url
  )

  const previous = entries[index]

  if (!previous || (field === 'icon' ? (previous.icon ?? '') : previous.target.label) === value) {
    return
  }

  const next =
    field === 'icon'
      ? { ...previous, icon: previewFaviconTarget(value) ?? undefined }
      : { ...previous, target: { ...previous.target, label: value || url } }

  $recentPreviews.set(entries.map((entry, i) => (i === index ? next : entry)))
}

export function moveRecentPreviewOwners(resolve: (owner: PreviewOwner) => PreviewOwner) {
  const entries = $recentPreviews.get()

  const next = entries.map(entry => {
    const owner = resolve(entry.owner)

    return sameOwner(entry.owner, owner) ? entry : { ...entry, owner }
  })

  if (next.some((entry, index) => entry !== entries[index])) {
    $recentPreviews.set(compact(next))
  }
}

export function forgetRecentPreviews(matches: (owner: PreviewOwner) => boolean) {
  const entries = $recentPreviews.get()
  const next = entries.filter(entry => !matches(entry.owner))

  if (next.length !== entries.length) {
    $recentPreviews.set(next)
  }
}

/** One shortcut per visited origin, using its latest page, in access order. */
export function suggestedPreviewSites(entries: readonly RecentPreview[]): RecentPreview[] {
  const origins = new Set<string>()

  return entries
    .filter(entry => {
      if (entry.target.kind !== 'url') {
        return false
      }

      const origin = new URL(entry.target.url).origin

      if (origins.has(origin)) {
        return false
      }

      origins.add(origin)

      return true
    })
    .slice(0, 3)
}
