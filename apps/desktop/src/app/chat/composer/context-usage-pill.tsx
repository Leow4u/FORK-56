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

import { contextUsagePercentLabel, mergeContextGaugeUsage } from './context-usage-label'
import { useComposerScope } from './scope'

const EMPTY_USAGE: UsageStats = { calls: 0, input: 0, output: 0, total: 0 }

const PILL = cn(
  'h-(--composer-control-size) max-w-16 shrink-0 justify-center rounded-md px-2 text-xs font-normal tabular-nums',
  'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
)

async function requestComposerGateway<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
  const gateway = $gateway.get()

  if (!gateway) {
    throw new Error('Work4You gateway is not connected')
  }

  return gateway.request<T>(method, params)
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
  const percent = contextUsagePercentLabel(gaugeUsage)

  const setMenuOpen = (next: boolean) => {
    setOpen(next)

    if (!next) {
      releaseTypingFocus()
    }
  }

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={open}>
      <Tip label={copy.contextUsage} side="top">
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={copy.contextUsage}
            className={PILL}
            data-slot="context-usage-pill"
            type="button"
            variant="ghost"
          >
            {percent}
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="end" className="w-auto border-(--ui-stroke-secondary) p-0" side="top" sideOffset={8}>
        <ContextUsagePanel breakdown={breakdown} loading={loading} usage={gaugeUsage} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
