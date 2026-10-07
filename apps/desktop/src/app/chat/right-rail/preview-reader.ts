/**
 * PREVIEW READER — the read_preview tool's window into the preview pane, the
 * preview analog of the terminal's buffer registry (see right-sidebar/
 * terminal/buffer.ts).
 *
 * A URL/HTML preview renders in a sandboxed <webview> owned by PreviewPane;
 * that pane registers a PAGE READER here (url + title + rendered text), keyed
 * by tab id. `readActivePreview` resolves the ACTIVE tab from the store and
 * owns the windowing: a registered reader answers with the live page's text;
 * a tab with no reader (a file peek, an artifact) still answers with its
 * identity and a note pointing the agent at the tool that reads that content
 * directly (read_file / the conversation's artifact).
 *
 * Tabs belong to conversations. An agent reads its OWN conversation's front
 * tab; when that conversation is not the one on screen, its pages aren't
 * mounted (and a same-id tab on screen is someone else's), so the answer is
 * the tab's identity with a note saying so.
 */

import { $previewOwner, agentPreviewTab, isFollowedPreviewOwner, type PreviewOwner } from '@/store/preview'

export interface PreviewReadOptions {
  /** Characters to return from `start` (capped at PREVIEW_READ_MAX_CHARS). */
  count?: number
  /** 0-indexed character offset into the page text. */
  start?: number
}

export interface PreviewReadResult {
  end: number
  kind: string
  note?: string
  path?: string
  start: number
  text: string
  title: string
  total_chars: number
  url: string
}

/** What a pane's page reader extracts — the reader module owns the windowing. */
interface PreviewPage {
  text: string
  title: string
  url: string
}

type PageReader = () => Promise<PreviewPage>

/** Default + hard cap on one read — a page's innerText can be megabytes, and
 *  this crosses the gateway into model context. Page with start/count. */
export const PREVIEW_READ_MAX_CHARS = 24_000

const readers = new Map<string, PageReader>()

/** Register a live preview's page reader; returns an idempotent unregister. */
export function registerPreviewPageReader(tabId: string, reader: PageReader): () => void {
  readers.set(tabId, reader)

  return () => {
    if (readers.get(tabId) === reader) {
      readers.delete(tabId)
    }
  }
}

function windowText(
  base: Omit<PreviewReadResult, 'end' | 'start' | 'text' | 'total_chars'>,
  text: string,
  opts: PreviewReadOptions
): PreviewReadResult {
  const total = text.length
  const from = Math.max(0, Math.min(opts.start ?? 0, total))
  const want = Math.min(Math.max(1, opts.count ?? PREVIEW_READ_MAX_CHARS), PREVIEW_READ_MAX_CHARS)
  const to = Math.max(from, Math.min(from + want, total))

  return { ...base, end: to, start: from, text: text.slice(from, to), total_chars: total }
}

/** Read the tab the agent's page tools work on in `owner`'s conversation (the
 *  one on screen when `owner` is undefined) — `agentPreviewTab`. Null only
 *  when that conversation has no tab open. */
export async function readActivePreview(
  opts: PreviewReadOptions = {},
  owner?: PreviewOwner
): Promise<PreviewReadResult | null> {
  const onScreen = isFollowedPreviewOwner(owner)
  const tab = agentPreviewTab(owner ?? $previewOwner.get())

  if (!tab) {
    return null
  }

  const { target } = tab
  // Off screen, the pane isn't mounted — and a reader under the same tab id
  // belongs to the conversation that IS on screen.
  const reader = onScreen ? readers.get(tab.id) : undefined

  if (reader) {
    try {
      const page = await reader()

      return windowText(
        { kind: target.kind, path: target.path, title: page.title || target.label, url: page.url || target.url },
        page.text,
        opts
      )
    } catch {
      // Webview not ready (still booting / just navigated) — fall through to
      // the identity answer, whose note says to retry.
    }
  }

  // No live webview behind the tab (a file peek, an artifact, or a page still
  // booting): answer with the tab's identity so the agent knows what's on
  // screen and which of its own tools reads the content directly.
  return windowText(
    {
      kind: target.kind,
      note:
        target.kind === 'file'
          ? 'File preview — read the file itself with read_file.'
          : target.kind === 'artifact'
            ? 'Generated artifact — its content is in the conversation that produced it.'
            : onScreen
              ? 'The page has not finished loading — retry in a moment.'
              : 'Not on screen — the user is viewing another conversation, so this page cannot be read now.',
      path: target.path,
      title: target.label,
      url: target.url
    },
    '',
    opts
  )
}
