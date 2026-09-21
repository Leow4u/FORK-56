import { readDesktopFileDataUrl } from '@/lib/desktop-fs'
import { capitalize } from '@/lib/text'
import { $connection } from '@/store/session'

export type MediaKind = 'audio' | 'image' | 'video' | 'file'

interface MediaInfo {
  kind: MediaKind
  mime: string
}

const MEDIA_BY_EXT: Record<string, MediaInfo> = {
  avi: { kind: 'video', mime: 'video/x-msvideo' },
  bmp: { kind: 'image', mime: 'image/bmp' },
  flac: { kind: 'audio', mime: 'audio/flac' },
  gif: { kind: 'image', mime: 'image/gif' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  jpg: { kind: 'image', mime: 'image/jpeg' },
  m4a: { kind: 'audio', mime: 'audio/mp4' },
  mkv: { kind: 'video', mime: 'video/x-matroska' },
  mov: { kind: 'video', mime: 'video/quicktime' },
  mp3: { kind: 'audio', mime: 'audio/mpeg' },
  mp4: { kind: 'video', mime: 'video/mp4' },
  ogg: { kind: 'audio', mime: 'audio/ogg' },
  opus: { kind: 'audio', mime: 'audio/ogg; codecs=opus' },
  png: { kind: 'image', mime: 'image/png' },
  svg: { kind: 'image', mime: 'image/svg+xml' },
  wav: { kind: 'audio', mime: 'audio/wav' },
  webm: { kind: 'video', mime: 'video/webm' },
  webp: { kind: 'image', mime: 'image/webp' }
}

export function pathExtension(path: string): string {
  const base = (path.split(/[?#]/, 1)[0] || path).split(/[\\/]/).filter(Boolean).pop() || ''
  const idx = base.lastIndexOf('.')

  return idx > 0 ? base.slice(idx + 1).toLowerCase() : ''
}

function mediaInfo(path: string): MediaInfo | undefined {
  const ext = pathExtension(path)

  return ext ? MEDIA_BY_EXT[ext] : undefined
}

export function mediaKind(path: string): MediaKind {
  return mediaInfo(path)?.kind ?? 'file'
}

// Markdown is renderable content, not an opaque download: the preview rail
// already knows how to render a `.md` file (rendered/source toggle), so the
// MEDIA delivery path routes these to a preview instead of a download link.
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd'])

// Delivered documents that already have a rail path: markdown + PDF iframe,
// or the existing binary empty-state (Office / zip). Same PreviewAttachment
// card — no new previewKind and no new viewer.
const DELIVERED_DOCUMENT_EXTENSIONS = new Set([
  ...MARKDOWN_EXTENSIONS,
  'csv',
  'docx',
  'ods',
  'pdf',
  'pptx',
  'xls',
  'xlsm',
  'xlsx',
  'zip'
])

export function isMarkdownDocumentPath(path: string): boolean {
  const ext = pathExtension(path)

  return ext ? MARKDOWN_EXTENSIONS.has(ext) : false
}

export function isDeliveredDocumentPath(path: string): boolean {
  const ext = pathExtension(path)

  return ext ? DELIVERED_DOCUMENT_EXTENSIONS.has(ext) : false
}

export function documentExtensionLabel(path: string): string {
  const ext = pathExtension(path)

  if (ext === 'markdown' || ext === 'mdown' || ext === 'mkd') {
    return 'MD'
  }

  return ext.toUpperCase()
}

export type DocumentKindKey = 'archive' | 'document' | 'file' | 'markdown' | 'presentation' | 'spreadsheet'
export type DocumentIconName = DocumentKindKey | 'pdf'
export type DocumentTone = 'blue' | 'green' | 'muted' | 'orange' | 'red'

export interface DocumentCardMeta {
  extLabel: string
  icon: DocumentIconName
  kindKey: DocumentKindKey
  tone: DocumentTone
}

const BINARY_DELIVERED_DOCUMENT_EXTENSIONS = new Set([
  'csv',
  'docx',
  'ods',
  'pdf',
  'pptx',
  'xls',
  'xlsm',
  'xlsx',
  'zip'
])

const DOCUMENT_KIND_BY_EXT: Record<string, DocumentKindKey> = {
  csv: 'spreadsheet',
  docx: 'document',
  markdown: 'markdown',
  md: 'markdown',
  mdown: 'markdown',
  mkd: 'markdown',
  ods: 'spreadsheet',
  pdf: 'document',
  pptx: 'presentation',
  xls: 'spreadsheet',
  xlsm: 'spreadsheet',
  xlsx: 'spreadsheet',
  zip: 'archive'
}

const DOCUMENT_TONE_BY_EXT: Record<string, DocumentTone> = {
  csv: 'green',
  docx: 'blue',
  ods: 'green',
  pdf: 'red',
  pptx: 'orange',
  xls: 'green',
  xlsm: 'green',
  xlsx: 'green'
}

const DOCUMENT_KIND_EN: Record<DocumentKindKey, string> = {
  archive: 'Archive',
  document: 'Document',
  file: 'File',
  markdown: 'Markdown',
  presentation: 'Presentation',
  spreadsheet: 'Spreadsheet'
}

export function documentCardMeta(path: string): DocumentCardMeta {
  const ext = pathExtension(path)
  const kindKey = (ext && DOCUMENT_KIND_BY_EXT[ext]) || 'file'

  return {
    extLabel: documentExtensionLabel(path),
    icon: ext === 'pdf' ? 'pdf' : kindKey,
    kindKey,
    tone: (ext && DOCUMENT_TONE_BY_EXT[ext]) || 'muted'
  }
}

export function documentKindLabel(path: string): string {
  return DOCUMENT_KIND_EN[documentCardMeta(path).kindKey]
}

// "PDF · PDF" is noise. Repeat the extension only when the kind name is
// actually a different word ("Document · PDF", "Spreadsheet · XLSX").
export function documentKindLine(kindLabel: string, extLabel: string): string {
  const kind = kindLabel.trim()
  const ext = extLabel.trim()

  if (!ext) {
    return kind
  }

  if (!kind || kind.toLocaleUpperCase() === ext.toLocaleUpperCase()) {
    return ext
  }

  return `${kind} · ${ext}`
}

const WRAPPED_DELIVERY_PROTOCOL_RE = /^(?:sandbox):/i

export function unwrapDeliveredDocumentHref(href: string): string {
  return href.replace(/^<|>$/g, '').trim().replace(WRAPPED_DELIVERY_PROTOCOL_RE, '')
}

// Filesystem and relative Office/PDF/zip hrefs are not safe `<a>` targets —
// rehype-harden appends " [blocked]". Resolve the real path so preprocess can
// rewrite to `#preview/…`. Leave relative `.md` and http alone.
export function resolveDeliveredDocumentHref(href: string): string | null {
  const path = unwrapDeliveredDocumentHref(href)

  if (!path || path.startsWith('#') || path.startsWith('?')) {
    return null
  }

  if (/^https?:/i.test(path) || /^mailto:/i.test(path)) {
    return null
  }

  if (isFileMediaPath(path)) {
    return path
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    return null
  }

  const ext = pathExtension(path)

  return ext && BINARY_DELIVERED_DOCUMENT_EXTENSIONS.has(ext) ? path : null
}

export function isRelativeDeliveredDocumentHref(href: string): boolean {
  const resolved = resolveDeliveredDocumentHref(href)

  return Boolean(resolved && !isFileMediaPath(resolved))
}

export function formatByteSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

export function mediaMime(path: string): string {
  return mediaInfo(path)?.mime ?? 'application/octet-stream'
}

export function mediaName(path: string): string {
  try {
    const url = new URL(path)

    return url.pathname.split('/').filter(Boolean).pop() || path
  } catch {
    return path.split(/[\\/]/).filter(Boolean).pop() || path
  }
}

export function mediaMarkdownHref(path: string): string {
  return `#media:${encodeURIComponent(path)}`
}

export function isInlineMediaSrc(path: string): boolean {
  return /^(?:https?|data):/i.test(path)
}

export function isFileMediaPath(path: string): boolean {
  return /^(?:file:|\/|~\/|[a-z]:[\\/]|\\\\)/i.test(path)
}

export async function resolveMediaDisplaySrc(path: string): Promise<string> {
  if (isInlineMediaSrc(path) || !isFileMediaPath(path)) {
    return path
  }

  if (window.work4youDesktop && isRemoteGateway()) {
    return gatewayMediaDataUrl(path)
  }

  if (!window.work4youDesktop?.readFileDataUrl) {
    return mediaExternalUrl(path)
  }

  return window.work4youDesktop.readFileDataUrl(filePathFromMediaPath(path))
}

// Audio/video need a seekable source instead of a whole-file data URL. Keep
// remote URLs untouched and route filesystem paths through the Electron media
// protocol. Its main-process handler reads local files directly or proxies a
// remote gateway with the connection's bearer/cookie/token authentication.
export async function resolveMediaPlaybackSrc(path: string): Promise<string> {
  if (isInlineMediaSrc(path)) {
    return path
  }

  if (window.work4youDesktop && ['audio', 'video'].includes(mediaKind(path))) {
    return isRemoteGateway() ? mediaGatewayStreamUrl(path) : mediaStreamUrl(path)
  }

  return resolveMediaDisplaySrc(path)
}

// Resolve a media path to a URL the shell can open. Remote mode rewrites
// gateway-local paths to an authenticated /api/files/download URL (the file
// lives on the gateway, not this disk); local mode keeps the file:// form.
export function mediaExternalUrl(path: string): string {
  if (/^https?:/i.test(path)) {
    return path
  }

  if (isRemoteGateway()) {
    const conn = $connection.get()

    if (conn?.baseUrl && conn.token) {
      const file = encodeURIComponent(filePathFromMediaPath(path))

      return `${conn.baseUrl}/api/files/download?path=${file}&token=${encodeURIComponent(conn.token)}`
    }
  }

  return /^file:/i.test(path) ? path : `file://${path}`
}

// Remote gateway audio/video is proxied by the Electron main process. OAuth
// connections intentionally expose no static token to the renderer, so a bare
// HTTPS source cannot authenticate reliably. The custom protocol keeps secrets
// out of renderer URLs while forwarding Range requests to /api/files/stream.
export function mediaGatewayStreamUrl(path: string): string {
  const conn = $connection.get()

  if (isRemoteGateway()) {
    const file = encodeURIComponent(filePathFromMediaPath(path))
    const profile = conn?.profile ? `?profile=${encodeURIComponent(conn.profile)}` : ''

    return `work4you-media://remote/${file}${profile}`
  }

  return mediaExternalUrl(path)
}

// Custom Electron scheme (registered in electron/main.ts) that streams a local
// file with Range support. Used for audio/video so playback bypasses the data
// URL size cap and supports seeking. `path` may be a plain path or `file://…`.
export function mediaStreamUrl(path: string): string {
  return `work4you-media://stream/${encodeURIComponent(filePathFromMediaPath(path))}`
}

export function mediaPathFromMarkdownHref(href?: string): string | null {
  if (!href?.startsWith('#media:')) {
    return null
  }

  try {
    return decodeURIComponent(href.slice('#media:'.length))
  } catch {
    return null
  }
}

export function filePathFromMediaPath(path: string): string {
  if (!path.startsWith('file:')) {
    return path
  }

  try {
    return decodeURIComponent(new URL(path).pathname)
  } catch {
    return path.replace(/^file:\/\//, '')
  }
}

// True when this desktop shell is wired to a remote gateway. Local media paths
// then live on the gateway machine, not this disk, so we fetch them over the API.
export function isRemoteGateway(): boolean {
  return $connection.get()?.mode === 'remote'
}

// Fetch gateway-local media as a data URL via the authenticated desktop FS
// bridge. Remote Desktop artifacts can live anywhere the gateway can read
// (workspace, skills, ~/.work4you/cache, etc.); /api/media is intentionally
// narrower and rejects non-images plus images outside its media roots.
export async function gatewayMediaDataUrl(path: string): Promise<string> {
  return readDesktopFileDataUrl(filePathFromMediaPath(path))
}

// Remote-mode replacement for opening gateway-local file paths with file://.
// The file lives on the gateway, so ask the Electron main process to fetch the
// bytes through the authenticated backend connection and save them locally. This
// avoids browser/OS downloads losing OAuth cookies and avoids the data-URL cap
// used by preview endpoints.
export async function downloadGatewayMediaFile(
  path: string
): Promise<{ canceled?: boolean; path?: string; saved: boolean }> {
  const file = filePathFromMediaPath(path)
  const conn = $connection.get()

  if (!window.work4youDesktop?.saveGatewayFile) {
    throw new Error('Desktop file download bridge is unavailable')
  }

  return window.work4youDesktop.saveGatewayFile({
    path: file,
    profile: conn?.profile,
    suggestedName: mediaName(file)
  })
}

// Card download: use the existing gateway save dialog when the desktop
// bridge is present; otherwise open the authenticated download URL or a
// browser <a download> fallback. No new IPC.
export async function downloadDeliveredFile(
  path: string
): Promise<{ canceled?: boolean; path?: string; saved: boolean }> {
  if (typeof window !== 'undefined' && window.work4youDesktop?.saveGatewayFile) {
    return downloadGatewayMediaFile(path)
  }

  const url = mediaExternalUrl(path)

  if (typeof window !== 'undefined' && window.work4youDesktop?.openExternal) {
    await window.work4youDesktop.openExternal(url)

    return { saved: true }
  }

  if (typeof document === 'undefined') {
    throw new Error('File download is unavailable')
  }

  const link = document.createElement('a')

  link.href = url
  link.download = mediaName(path)
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()

  return { saved: true }
}

export function mediaDisplayLabel(path: string): string {
  const escaped = mediaName(path).replace(/[[\]\\]/g, '\\$&')
  const kind = mediaKind(path)

  return `${capitalize(kind)}: ${escaped}`
}
