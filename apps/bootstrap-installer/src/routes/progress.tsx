import { useStore } from '@nanostores/react'
import clsx from 'clsx'
import { Check, ChevronRight, FileText, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { BrandMark } from '../components/brand-mark'
import { Button } from '../components/button'
import { Loader } from '../components/loader'
import { formatDuration, formatElapsed } from '../lib/format'
import {
  $mode,
  $progress,
  type BootstrapStateModel,
  cancelInstall,
  type StageState
} from '../store'

interface ProgressProps {
  bootstrap: BootstrapStateModel
}

/*
 * Progress screen — stage list + collapsible log panel, framed like the
 * desktop install overlay (BrandMark header, hairline card, Fourier
 * loader on the running step). Pending steps stay off-screen until they
 * start; completed ones remain. Install order, cancel, and log toggle
 * are unchanged.
 */
export default function ProgressScreen({ bootstrap }: ProgressProps) {
  const progress = useStore($progress)
  const mode = useStore($mode)
  const [showLogs, setShowLogs] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [bootstrap.logs.length, showLogs])

  // Tick once a second while the run is in flight so the active step shows a
  // live elapsed timer — a long single step (e.g. the dependency download)
  // reads as working, not frozen. Stops when nothing is running.
  useEffect(() => {
    if (bootstrap.status !== 'running') {
      return
    }

    const id = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(id)
  }, [bootstrap.status])

  const isUpdate = mode === 'update'
  const title = bootstrap.status === 'completed' ? 'Done' : isUpdate ? 'Updating Work4You' : 'Setting up Work4You'

  const description = isUpdate
    ? 'Work4You is updating to the latest version — this only takes a moment.'
    : 'This is a one-time setup. The Work4You installer is downloading dependencies and configuring your machine. Subsequent launches will skip this step.'

  const pct = Math.round(progress.fraction * 100)

  const visibleStages = bootstrap.stageOrder.filter((name) => {
    const rec = bootstrap.stages[name]

    return rec != null && rec.state != null
  })

  return (
    <div className="work4you-fade-in flex h-full items-center justify-center p-6">
      <div
        className={clsx(
          'flex max-h-full w-full flex-col overflow-hidden rounded-xl border border-(--stroke-work4you) bg-card shadow-work4you',
          showLogs ? 'max-w-3xl' : 'max-w-lg'
        )}
      >
        <div className="flex shrink-0 items-start gap-4 px-6 pt-6 pb-4">
          <BrandMark className="size-11" />
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 pt-2 pb-4">
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className={clsx(bootstrap.status === 'running' && 'shimmer')}>
                  {progress.done} of {progress.total} steps complete
                </span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div
                aria-label={`${progress.done} of ${progress.total} steps complete`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={pct}
                className="h-1.5 w-full overflow-hidden rounded-full bg-(--ui-bg-tertiary)"
                role="progressbar"
              >
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(2, progress.fraction * 100)}%` }}
                />
              </div>
            </div>

            {visibleStages.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="size-10" />
              </div>
            ) : (
              <ol aria-live="polite" className="space-y-0.5">
                {visibleStages.map((name) => {
                  const rec = bootstrap.stages[name]

                  if (!rec) {
                    return null
                  }

                  const meta =
                    rec.state === 'running' && rec.startedAt != null
                      ? formatElapsed(now - rec.startedAt)
                      : rec.durationMs != null && rec.state !== 'failed'
                        ? formatDuration(rec.durationMs)
                        : null

                  return (
                    <li
                      aria-current={rec.state === 'running' ? 'step' : undefined}
                      className={clsx(
                        'work4you-fade-in flex items-center gap-2.5 px-1 py-1.5 text-sm',
                        rec.state === 'running' ? 'font-medium text-foreground' : 'text-muted-foreground'
                      )}
                      key={name}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center">
                        {rec.state === 'running' && <Loader className="size-8" />}
                      </span>
                      <span className="flex-1 truncate">{rec.info.title}</span>
                      {meta && <span className="text-xs tabular-nums text-muted-foreground/70">{meta}</span>}
                      <StateIcon state={rec.state ?? null} />
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          {showLogs && (
            <div className="flex w-1/2 flex-col border-l border-(--stroke-work4you)">
              <div className="flex shrink-0 items-center justify-between border-b border-(--stroke-work4you) px-3 py-2 text-xs">
                <span className="font-medium text-foreground/80">Live output</span>
                <span className="tabular-nums text-muted-foreground">{bootstrap.logs.length} lines</span>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[10.5px] leading-relaxed">
                {bootstrap.logs.map((entry, idx) => (
                  <div
                    className={clsx(
                      'whitespace-pre-wrap',
                      entry.stream === 'stderr' ? 'text-foreground/45' : 'text-foreground/70'
                    )}
                    key={idx}
                  >
                    {entry.line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between px-6 py-3">
          <button
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowLogs((v) => !v)}
            type="button"
          >
            <FileText size={14} />
            {showLogs ? 'Hide details' : 'Show details'}
            <ChevronRight className={clsx('transition-transform', showLogs && 'rotate-90')} size={12} />
          </button>

          {bootstrap.status === 'running' && (
            <Button onClick={() => void cancelInstall()} size="sm" variant="outline">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Terminal-state markers, neutral by design: a muted check for done/skipped
// (no celebratory green), a destructive cross for failure. Running renders its
// spinner on the left; pending stays icon-less.
function StateIcon({ state }: { state: StageState | null }) {
  if (state === 'succeeded') {
    return <Check className="shrink-0 text-muted-foreground" size={13} />
  }

  if (state === 'skipped') {
    return <Check className="shrink-0 text-muted-foreground/50" size={13} />
  }

  if (state === 'failed') {
    return <X className="shrink-0 text-destructive" size={13} />
  }

  return null
}
