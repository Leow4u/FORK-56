import { useStore } from '@nanostores/react'
import { FileText, RefreshCw } from 'lucide-react'

import { Button } from '../components/button'
import {
  $logPath,
  $mode,
  type BootstrapStateModel,
  openLogDir,
  startInstall,
  startUpdate
} from '../store'

interface FailureProps {
  bootstrap: BootstrapStateModel
}

/*
 * Failure screen. Same quiet hero as Welcome/Success — destructive
 * headline, muted body, existing Retry / Open logs actions.
 */
export default function Failure({ bootstrap }: FailureProps) {
  const logPath = useStore($logPath)
  const mode = useStore($mode)
  const isUpdate = mode === 'update'

  return (
    <div className="work4you-fade-in flex h-full flex-col items-center justify-center gap-6 px-8 py-10">
      <div className="w-full max-w-md min-w-0 text-center">
        <h1 className="mb-2 text-xl font-semibold leading-snug tracking-tight text-destructive">
          {isUpdate ? 'Update didn\u2019t finish' : 'Install didn\u2019t finish'}
        </h1>
        <p className="m-0 text-sm leading-normal tracking-tight text-muted-foreground">
          {bootstrap.error ??
            (isUpdate
              ? 'Something went wrong during the update.'
              : 'Something went wrong during installation.')}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button className="gap-1.5" onClick={() => void (isUpdate ? startUpdate() : startInstall())}>
          <RefreshCw />
          {isUpdate ? 'Retry update' : 'Retry install'}
        </Button>
        <Button className="gap-1.5" onClick={() => void openLogDir()} variant="text">
          <FileText />
          Open logs
        </Button>
      </div>

      {logPath && (
        <p className="max-w-lg text-center text-xs text-muted-foreground/70">
          Log: <code className="font-mono">{logPath}</code>
        </p>
      )}
    </div>
  )
}
