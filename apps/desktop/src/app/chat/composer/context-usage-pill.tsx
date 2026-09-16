import { useStore } from '@nanostores/react'
import { useMemo, useState } from 'react'

import { ContextUsagePanel } from '@/app/shell/context-usage-panel'
import { useContextBreakdown } from '@/app/shell/hooks/use-context-breakdown'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { releaseTypingFocus } from '@/components/ui/keyboard-first'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { useStoreSelector } from '@/lib/use-session-slice'
import { cn } from '@/lib/utils'
import { $gateway } from '@/store/gateway'
import { $currentUsage } from '@/store/session'
import { $sessionStates } from '@/store/session-states'
import type { UsageStats } from '@/types/work4you'

import {
  contextUsageOccupancyTip,
  contextUsagePercent,
  mergeContextGaugeUsage
} from './context-usage-label'
import { useComposerScope } from './scope'

const EMPTY_USAGE: UsageStats = { calls: 0, input: 0, output: 0, total: 0 }

const CHIP = cn(
  'inline-flex size-5 shrink-0 items-center justify-center rounded-full p-0',
  'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
)

const RING_RADIUS = 5.5
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

async function requestComposerGateway<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
  const gateway = $gateway.get()

  if (!gateway) {
    throw new Error('Work4You gateway is not connected')
  }

  return gateway.request<T>(method, params)
}

function ContextUsageRing({ percent }: { percent: number }) {
  const filled = (percent / 100) * RING_CIRCUMFERENCE

  return (
    <svg aria-hidden className="size-3.5" data-percent={percent} data-slot="context-usage-ring" viewBox="0 0 16 16">
      <circle className="fill-none stroke-(--ui-stroke-tertiary)" cx="8" cy="8" r={RING_RADIUS} strokeWidth="2" />
      {percent > 0 ? (
        <circle
          className="fill-none stroke-current"
          cx="8"
          cy="8"
          r={RING_RADIUS}
          strokeDasharray={`${filled} ${RING_CIRCUMFERENCE}`}
          strokeLinecap="round"
          strokeWidth="2"
          transform="rotate(-90 8 8)"
        />
      ) : null}
    </svg>
  )
}

/** Underside mount: right-aligned sibling of the composer surface. Hidden
 *  while the host says so (empty transcript or an active voice conversation —
 *  the same gates the in-row pill used). */
export function ComposerContextUsage({
  busy,
  hidden,
  sessionId
}: {
  busy: boolean
  hidden: boolean
  sessionId?: null | string
}) {
  if (hidden) {
    return null
  }

  return (
    <div className="ml-auto" data-slot="composer-context-usage">
      <ContextUsagePill busy={busy} sessionId={sessionId} />
    </div>
  )
}

export function ContextUsagePill({ busy, sessionId }: { busy: boolean; sessionId?: null | string }) {
  const copy = useI18n().t.shell.statusbar
  const scope = useComposerScope()
  const primaryUsage = useStore($currentUsage)

  const sessionUsage = useStoreSelector($sessionStates, states =>
    sessionId ? (states[sessionId]?.usage ?? null) : null
  )

  const usage = sessionUsage ?? (scope.target === 'main' ? primaryUsage : EMPTY_USAGE)

  const { breakdown, loading } = useContextBreakdown({
    busy,
    enabled: true,
    requestGateway: requestComposerGateway,
    sessionId: sessionId ?? null
  })

  const gaugeUsage = useMemo(() => mergeContextGaugeUsage(usage, breakdown), [breakdown, usage])
  const [open, setOpen] = useState(false)
  const percent = contextUsagePercent(gaugeUsage)
  const occupancy = contextUsageOccupancyTip(gaugeUsage, copy.contextUsagePanel.tokenSummary)

  const setMenuOpen = (next: boolean) => {
    setOpen(next)

    if (!next) {
      releaseTypingFocus()
    }
  }

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={open}>
      <Tip label={occupancy} side="top">
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={copy.contextUsage}
            className={CHIP}
            data-slot="context-usage-pill"
            type="button"
            variant="ghost"
          >
            <ContextUsageRing percent={percent} />
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="end" className="w-auto border-(--ui-stroke-secondary) p-0" side="top" sideOffset={8}>
        <ContextUsagePanel breakdown={breakdown} loading={loading} usage={gaugeUsage} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
