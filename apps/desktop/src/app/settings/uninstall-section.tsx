import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Loader2, Trash2 } from '@/lib/icons'

import { SectionHeading } from './primitives'

// The desktop app can also uninstall the Python agent (lite / full). That
// stays in the Electron bridge. Settings only offers removing the app itself.
export function UninstallSection() {
  const { t } = useI18n()
  const a = t.settings.about
  const [pending, setPending] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bridge = window.work4youDesktop?.uninstall

  if (!bridge) {
    return null
  }

  const handleConfirm = async () => {
    setRunning(true)
    setError(null)

    try {
      const result = await bridge.run('gui')

      if (!result.ok) {
        setError(result.message || result.error || a.removeAppFailed)
        setRunning(false)
        setPending(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setRunning(false)
      setPending(false)
    }
  }

  return (
    <div className="mt-8 w-full">
      <SectionHeading title={a.removeApp} variant="group" />

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        {pending ? (
          <div>
            <p className="text-sm font-medium text-destructive">{a.removeAppConfirmTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{a.removeAppConfirm}</p>
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button disabled={running} onClick={() => void handleConfirm()} size="sm" variant="destructive">
                {running && <Loader2 className="size-3 animate-spin" />}
                {running ? a.removeAppWorking : a.removeApp}
              </Button>
              <Button disabled={running} onClick={() => setPending(false)} size="sm" variant="text">
                {a.removeAppCancel}
              </Button>
            </div>
          </div>
        ) : (
          <button
            aria-label={a.removeApp}
            className="flex w-full items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-left transition hover:border-destructive/40 hover:bg-destructive/5"
            onClick={() => {
              setError(null)
              setPending(true)
            }}
            type="button"
          >
            <Trash2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{a.removeApp}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{a.removeAppDesc}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
