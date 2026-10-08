import { useEffect, useId, useRef, useState } from 'react'

import { usePaneVisible } from '@/components/pane-shell/pane-visibility'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { GlyphSpinner } from '@/components/ui/glyph-spinner'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import type { ComposerStatusItem } from '@/store/composer-status'

import { StatusItemRow } from './status-row'

interface TasksProgressProps {
  items: readonly ComposerStatusItem[]
}

/** A session's plan stays compact until the user previews or pins it. The
 * anchor keeps its height even when pinned, so neither opening mode moves the
 * composer. The popover is non-modal: a pinned plan can stay open while typing. */
export function TasksProgress({ items }: TasksProgressProps) {
  const { t } = useI18n()
  const s = t.statusStack
  const paneVisible = usePaneVisible()
  const [mode, setMode] = useState<'closed' | 'preview' | 'pinned'>('closed')
  const chipRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const minimizeRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suppressFocusPreview = useRef(false)
  const returnFocusOnClose = useRef(false)
  const panelId = useId()
  const titleId = useId()
  const pinned = mode === 'pinned'
  const open = paneVisible && mode !== 'closed'
  const counted = items.filter(item => item.todoStatus !== 'cancelled')
  const completed = counted.filter(item => item.todoStatus === 'completed').length

  const current =
    counted.find(item => item.todoStatus === 'in_progress') ?? counted.find(item => item.todoStatus === 'pending')

  const step = current ? counted.indexOf(current) + 1 : null
  const progress = counted.length ? s.tasksCompleted(completed, counted.length) : s.taskStates.cancelled
  const label = step ? t.assistant.thread.stepOf(step, counted.length) : progress

  const cancelClose = () => clearTimeout(closeTimer.current)

  const preview = () => {
    cancelClose()
    setMode(value => (value === 'pinned' ? value : 'preview'))
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      if (chipRef.current === document.activeElement || panelRef.current?.contains(document.activeElement)) {
        return
      }

      setMode(value => (value === 'pinned' ? value : 'closed'))
    }, 180)
  }

  const minimize = () => {
    cancelClose()
    returnFocusOnClose.current = true
    setMode('closed')
  }

  useEffect(() => () => clearTimeout(closeTimer.current), [])
  useEffect(() => {
    if (!paneVisible) {
      clearTimeout(closeTimer.current)
      setMode(value => (value === 'pinned' ? value : 'closed'))
    }
  }, [paneVisible])
  useEffect(() => {
    if (pinned) {
      minimizeRef.current?.focus({ preventScroll: true })
    }
  }, [pinned])

  return (
    <Popover
      onOpenChange={next => {
        if (!next) {
          setMode('closed')
        }
      }}
      open={open}
    >
      <PopoverAnchor asChild>
        <div className="mx-2 flex min-w-0 justify-center pb-1.5" data-slot="tasks-progress">
          <Button
            aria-controls={open ? panelId : undefined}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={`${s.tasksTitle}: ${label}${current ? ` · ${current.title}` : ''}`}
            className={cn('min-w-0 max-w-full transition-colors', pinned && 'invisible')}
            data-slot="tasks-progress-chip"
            onBlur={scheduleClose}
            onClick={() => {
              cancelClose()
              setMode('pinned')
            }}
            onFocus={() => {
              if (!suppressFocusPreview.current) {
                preview()
              }
            }}
            onPointerEnter={event => {
              if (event.pointerType !== 'touch') {
                preview()
              }
            }}
            onPointerLeave={scheduleClose}
            ref={chipRef}
            size="sm"
            tabIndex={pinned ? -1 : undefined}
            type="button"
            variant="chip"
          >
            {current?.todoStatus === 'in_progress' ? (
              <GlyphSpinner ariaLabel={s.running} className="shrink-0" spinner="braille" />
            ) : (
              <Codicon name="checklist" size="1em" />
            )}
            <span className="shrink-0 tabular-nums">{label}</span>
            {current && (
              <>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <span className="min-w-0 max-w-56 overflow-hidden text-start font-normal">
                  <span
                    className="block truncate motion-safe:animate-in motion-safe:slide-in-from-bottom-1 motion-safe:fade-in-0 motion-safe:duration-150"
                    key={current.id}
                  >
                    {current.title}
                  </span>
                </span>
              </>
            )}
            <Codicon name="chevron-up" size="1em" />
          </Button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        aria-describedby={undefined}
        aria-labelledby={titleId}
        arrow={false}
        className="flex max-h-[min(40vh,var(--radix-popover-content-available-height))] w-[min(28rem,var(--radix-popover-trigger-width))] flex-col overflow-hidden text-xs motion-reduce:animate-none"
        data-slot="tasks-progress-card"
        id={panelId}
        onBlur={scheduleClose}
        onCloseAutoFocus={event => {
          event.preventDefault()

          // Restore after the floating focus scope unmounts, not while its
          // exit animation can still move focus. Hover dismissals never steal it.
          if (returnFocusOnClose.current) {
            returnFocusOnClose.current = false
            suppressFocusPreview.current = true
            chipRef.current?.focus({ preventScroll: true })
            suppressFocusPreview.current = false
          }
        }}
        onEscapeKeyDown={event => {
          event.preventDefault()
          event.stopPropagation()
          minimize()
        }}
        onFocusCapture={cancelClose}
        onInteractOutside={event => {
          if (pinned || chipRef.current?.contains(event.target as Node)) {
            event.preventDefault()
          }
        }}
        onOpenAutoFocus={event => event.preventDefault()}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
        ref={panelRef}
        side="top"
        sideOffset={0}
      >
        <div className="flex shrink-0 items-center gap-2 px-1.5 pb-2">
          <Codicon name="checklist" size="1em" />
          <span className="font-medium" id={titleId}>
            {s.tasksTitle}
          </span>
          {pinned && <span className="min-w-0 truncate text-muted-foreground">{label}</span>}
          <div className="ms-auto shrink-0">
            {pinned ? (
              <Button onClick={minimize} ref={minimizeRef} size="micro" type="button" variant="text">
                {s.tasksMinimize}
                <Codicon name="chevron-down" size="1em" />
              </Button>
            ) : (
              <span className="text-muted-foreground">{progress}</span>
            )}
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain" role="list">
          {items.map(item => (
            <div key={item.id} role="listitem">
              <span className="sr-only">{s.taskStates[item.todoStatus!]}</span>
              <StatusItemRow item={item} wrapTitle />
            </div>
          ))}
        </div>
        <div className="shrink-0 px-1.5 pt-2 text-muted-foreground">{pinned ? progress : s.tasksPinHint}</div>
      </PopoverContent>
    </Popover>
  )
}
