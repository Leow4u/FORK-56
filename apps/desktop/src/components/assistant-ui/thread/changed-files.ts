// Pure derivation for the assistant message's "N files changed" card: fold a
// turn's file-edit tool parts into one row per file. No React/DOM.

import {
  countDiffLineStats,
  fileEditBasename,
  fileEditPath,
  inlineDiffFromResult,
  isFileEditTool,
  parseMaybeObject
} from '@/components/assistant-ui/tool/fallback-model'

export interface ChangedFile {
  added: number
  /** Basename, for the row label. */
  name: string
  /** Path exactly as the tool reported it (absolute or repo-relative). */
  path: string
  removed: number
}

interface ChangedFilePart {
  args?: unknown
  isError?: unknown
  result?: unknown
  toolName?: unknown
  type?: unknown
}

/**
 * One row per file the turn edited, in first-touched order, with the +/- of
 * every edit to that file summed. A create that never persisted a diff still
 * counts — the closer has to name a landed `.pptx`, not only a patch hunk.
 * A call still running has no result; a failed one changed nothing.
 */
export function deriveChangedFiles(parts: readonly unknown[]): ChangedFile[] {
  const byPath = new Map<string, ChangedFile>()

  for (const raw of parts) {
    const part = (raw ?? {}) as ChangedFilePart

    if (part.type !== 'tool-call' || typeof part.toolName !== 'string' || !isFileEditTool(part.toolName)) {
      continue
    }

    if (part.isError === true || part.result === undefined || part.result === null) {
      continue
    }

    const result = parseMaybeObject(part.result)

    if (result.success === false) {
      continue
    }

    const path = fileEditPath(parseMaybeObject(part.args), result)

    if (!path) {
      continue
    }

    const diff = inlineDiffFromResult(result)
    const stats = diff ? countDiffLineStats(diff) : { added: 0, removed: 0 }
    const existing = byPath.get(path)

    if (existing) {
      existing.added += stats.added
      existing.removed += stats.removed
    } else {
      byPath.set(path, { added: stats.added, name: fileEditBasename(path), path, removed: stats.removed })
    }
  }

  return [...byPath.values()]
}
