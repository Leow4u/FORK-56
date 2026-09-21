// @ts-nocheck — desktop parity port; web shims pending.
import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { ATTACHMENT_SHELL_CLASS } from '@/components/chat/widget-shell'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileTypeDocx,
  FileTypePdf,
  FileZip,
  iconSize,
  Markdown,
  Presentation,
  type IconComponent
} from '@/lib/icons'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import {
  documentCardMeta,
  documentKindLine,
  downloadDeliveredFile,
  type DocumentIconName,
  type DocumentTone
} from '@/lib/media'
import { previewName } from '@/lib/preview-targets'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { $previewTabSources, closePreviewForSource, openPreview, type PreviewRecordSource } from '@/store/preview'

const DOCUMENT_ICON: Record<DocumentIconName, IconComponent> = {
  archive: FileZip,
  document: FileTypeDocx,
  file: FileText,
  markdown: Markdown,
  pdf: FileTypePdf,
  presentation: Presentation,
  spreadsheet: FileSpreadsheet
}

const DOCUMENT_TONE_CLASS: Record<DocumentTone, { icon: string; tile: string }> = {
  blue: { icon: 'text-(--ui-blue)', tile: 'bg-(--ui-blue)/15' },
  green: { icon: 'text-(--ui-green)', tile: 'bg-(--ui-green)/15' },
  muted: { icon: 'text-muted-foreground', tile: 'bg-muted/55' },
  orange: { icon: 'text-(--ui-orange)', tile: 'bg-(--ui-orange)/15' },
  red: { icon: 'text-(--ui-red)', tile: 'bg-(--ui-red)/15' }
}

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
  const card = documentCardMeta(target)
  const kindLabel = t.preview.documentKind[card.kindKey]
  const kindLine = documentKindLine(kindLabel, card.extLabel)
  const Icon = DOCUMENT_ICON[card.icon]
  const tone = DOCUMENT_TONE_CLASS[card.tone]
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

  const previewLabel = opening ? t.preview.opening : isActive ? t.preview.hide : t.preview.open
  const previewAria = opening ? t.preview.opening : isActive ? t.preview.hide : t.preview.openPreview

  return (
    <span
      className={cn(ATTACHMENT_SHELL_CLASS, 'my-1.5 inline-flex w-full min-w-0 items-center gap-3 align-middle')}
      data-document-kind={card.kindKey}
      data-document-tone={card.tone}
      data-slot="aui_document-card"
    >
      <button
        aria-label={previewAria}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left disabled:cursor-default disabled:opacity-50"
        disabled={opening}
        onClick={() => void togglePreview()}
        type="button"
      >
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tone.tile, tone.icon)}>
          <Icon className={iconSize.xl} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[length:var(--conversation-text-font-size)] font-semibold text-foreground">
            {name}
          </span>
          <span className="block truncate text-[length:var(--conversation-tool-font-size)] text-muted-foreground">
            {kindLine}
          </span>
        </span>
      </button>
      <Button disabled={opening} onClick={() => void togglePreview()} size="inline" type="button" variant="text">
        {previewLabel}
      </Button>
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
