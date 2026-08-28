import { AlertCircle } from 'lucide-react'
import { useState } from 'react'

import { BrandMark } from '../components/brand-mark'
import { HackeryButton } from '../components/hackery-button'
import { launchWork4YouDesktop } from '../store'

/*
 * Success screen. Same quiet BrandMark hero as Welcome. Launching the
 * desktop can fail (e.g. Stage-Desktop was skipped and Work4You.exe
 * doesn't exist). We catch the Tauri error and surface it inline rather
 * than silently doing nothing — the previous version had
 * `onClick={() => void launchWork4YouDesktop()}` which swallowed the
 * rejection and left the user staring at an unresponsive button.
 */
export default function Success() {
  const [error, setError] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  async function handleLaunch() {
    setError(null)
    setLaunching(true)

    try {
      await launchWork4YouDesktop()
      // On success the installer exits — control never returns here.
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setLaunching(false)
    }
  }

  return (
    <div className="work4you-fade-in relative flex h-full flex-col items-center justify-center px-8 py-10">
      <div className="work4you-glow pointer-events-none absolute inset-0" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-8 text-center">
        <BrandMark className="size-16" />
        <div className="min-w-0">
          <h1 className="mb-2 text-xl font-semibold leading-snug tracking-tight text-foreground">
            Work4You is ready
          </h1>
          <p className="m-0 text-sm leading-normal tracking-tight text-muted-foreground">
            You can launch from here, or any time from your terminal with{' '}
            <code className="font-mono text-sm text-foreground/80">work4you desktop</code>.
          </p>
        </div>

        <HackeryButton
          disabled={launching}
          label={launching ? 'Launching' : 'Launch'}
          loading={launching}
          onClick={() => void handleLaunch()}
        />

        {error && (
          <div className="flex max-w-md items-start gap-2 text-left text-sm" role="alert">
            <AlertCircle className="mt-0.5 shrink-0 text-destructive" size={16} />
            <div className="min-w-0">
              <div className="font-medium text-destructive">Couldn&rsquo;t launch the desktop app</div>
              <div className="mt-0.5 text-muted-foreground">{error}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
