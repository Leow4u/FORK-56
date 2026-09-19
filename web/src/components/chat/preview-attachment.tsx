// @ts-nocheck — desktop parity port; web shims pending.
import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { useI18n } from '@/i18n'
import { Download, FileText } from '@/lib/icons'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { documentExtensionLabel, downloadDeliveredFile } from '@/lib/media'
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
  const isActive = openSources.includes(target)

  cwdRef.current = cwd
  targetRef.current = target

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      requestTokenRef.current += 1
    }
  }, [])

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

  return (
    <span className="group/preview relative block min-w-0 max-w-72">
      <button
        aria-label={previewLabel}
        className={cn(
          'flex w-full items-center gap-2 rounded-2xl border border-border/60 bg-background/50 px-2 py-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors',
          'hover:border-primary/35 hover:bg-accent/45 disabled:cursor-default disabled:opacity-50'
        )}
        disabled={opening}
        onClick={() => void togglePreview()}
        type="button"
      >
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/55 bg-muted/35 text-[0.58rem] font-semibold tracking-wide text-muted-foreground">
          {extLabel || <FileText className="size-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.72rem] font-medium leading-4 text-foreground/90" title={target}>
            {name}
          </span>
          {extLabel && (
            <span className="block truncate text-[0.62rem] leading-3.5 text-muted-foreground/65">{extLabel}</span>
          )}
        </span>
      </button>
      <button
        aria-label={t.fileMenu.download}
        className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border border-border/70 bg-background text-muted-foreground opacity-0 shadow-xs transition hover:bg-accent hover:text-foreground group-hover/preview:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
        disabled={downloading}
        onClick={() => void downloadFile()}
        type="button"
      >
        <Download className="size-3" />
      </button>
    </span>
  )
}
