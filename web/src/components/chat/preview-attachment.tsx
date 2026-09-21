// @ts-nocheck — desktop parity port; web shims pending.
import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { WIDGET_SHELL_CLASS } from '@/components/chat/widget-shell'
import { Button } from '@/components/ui/button'
import { ToolIcon } from '@/components/ui/tool-icon'
import { useI18n } from '@/i18n'
import { Download } from '@/lib/icons'
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
  const kindLine = extLabel ? `${kindLabel} · ${extLabel}` : kindLabel

  return (
    <span
      className={cn(
        WIDGET_SHELL_CLASS,
        'group/preview my-1.5 inline-flex w-full max-w-md min-w-0 items-center gap-2.5 align-middle'
      )}
    >
      <button
        aria-label={previewLabel}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default disabled:opacity-50"
        disabled={opening}
        onClick={() => void togglePreview()}
        type="button"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted/55 text-muted-foreground">
          <ToolIcon name="file" size="1rem" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[length:var(--conversation-text-font-size)] font-medium text-foreground">
            {name}
          </span>
          <span className="block truncate text-[length:var(--conversation-tool-font-size)] text-muted-foreground">
            {kindLine}
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 text-[length:var(--conversation-tool-font-size)] font-medium text-muted-foreground transition-opacity',
            opening || isActive ? 'opacity-100' : 'opacity-0 group-hover/preview:opacity-100'
          )}
        >
          {previewLabel}
        </span>
      </button>
      <Button
        aria-label={t.fileMenu.download}
        disabled={downloading}
        onClick={() => void downloadFile()}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Download />
      </Button>
    </span>
  )
}
