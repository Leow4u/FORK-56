import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { useI18n } from '@/i18n'
import { Download, FileText } from '@/lib/icons'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { documentExtensionLabel, documentKindLabel, downloadDeliveredFile } from '@/lib/media'
import { previewName } from '@/lib/preview-targets'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { $previewTabSources, closePreviewForSource, openPreview, type PreviewRecordSource } from '@/store/preview'

export function PreviewAttachment({ source = 'manual', target }: { source?: PreviewRecordSource; target: string }) {
  const { t } = useI18n()
  // This link lives in one session's transcript; resolve it against THAT
  // session's cwd, not the primary chat's.
  const cwd = useStore(useSessionView().$cwd)
  const openSources = useStore($previewTabSources)
  const [opening, setOpening] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const cwdRef = useRef(cwd)
  const mountedRef = useRef(false)
  const requestTokenRef = useRef(0)
  const targetRef = useRef(target)
  const name = previewName(target)
  const extLabel = documentExtensionLabel(target)
  const kindLabel = documentKindLabel(target)
  const isActive = openSources.includes(target)

  cwdRef.current = cwd
  targetRef.current = target

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      requestTokenRef.current += 1
    }
  }, [])

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    requestTokenRef.current += 1
    setOpening(false)
  }, [cwd, target])

  async function togglePreview() {
    if (opening) {
      return
    }

    if (isActive) {
      closePreviewForSource(target)

      return
    }

    const requestToken = ++requestTokenRef.current
    const requestTarget = target
    const requestCwd = cwd

    setOpening(true)

    try {
      const preview = await normalizeOrLocalPreviewTarget(requestTarget, requestCwd || undefined)

      if (
        !mountedRef.current ||
        requestTokenRef.current !== requestToken ||
        targetRef.current !== requestTarget ||
        cwdRef.current !== requestCwd
      ) {
        return
      }

      if (!preview) {
        throw new Error(`Could not open preview target: ${requestTarget}`)
      }

      openPreview(preview, source)
    } catch (error) {
      if (
        !mountedRef.current ||
        requestTokenRef.current !== requestToken ||
        targetRef.current !== requestTarget ||
        cwdRef.current !== requestCwd
      ) {
        return
      }

      notifyError(error, t.preview.unavailable)
    } finally {
      if (mountedRef.current && requestTokenRef.current === requestToken) {
        setOpening(false)
      }
    }
  }

  async function downloadFile() {
    if (downloading) {
      return
    }

    setDownloading(true)

    try {
      const result = await downloadDeliveredFile(target)

      if (result.canceled || !result.saved) {
        return
      }

      if (window.work4youDesktop?.saveGatewayFile) {
        notify({ durationMs: 1500, kind: 'info', message: t.fileMenu.downloadSaved })
      }
    } catch (error) {
      notifyError(error, t.fileMenu.downloadFailed)
    } finally {
      if (mountedRef.current) {
        setDownloading(false)
      }
    }
  }

  const previewLabel = opening ? t.preview.opening : isActive ? t.preview.hide : t.preview.openPreview
  const kindLine = extLabel ? `${kindLabel} · ${extLabel}` : kindLabel

  return (
    <span className="inline-flex max-w-md min-w-0 items-center gap-1 rounded-2xl border border-border bg-background py-1.5 pl-2 pr-1.5 align-middle">
      <button
        aria-label={previewLabel}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-0.5 text-left transition-colors',
          'hover:bg-accent/45 disabled:cursor-default disabled:opacity-50'
        )}
        disabled={opening}
        onClick={() => void togglePreview()}
        type="button"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
          <FileText className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-5 text-foreground" title={target}>
            {name}
          </span>
          <span className="block truncate text-xs leading-4 text-muted-foreground">{kindLine}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{previewLabel}</span>
      </button>
      <button
        aria-label={t.fileMenu.download}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
        disabled={downloading}
        onClick={() => void downloadFile()}
        type="button"
      >
        <Download className="size-3.5" />
      </button>
    </span>
  )
}
