import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { desktopFsCacheKey } from '@/lib/desktop-fs'
import { $connection } from '@/store/session'
import { $workspaceChangeTick } from '@/store/workspace-events'

import { readFilterTree } from './filter'

export function useFileFilter(cwd: string, enabled: boolean, revision = 0) {
  const connection = useStore($connection)
  const tick = useStore($workspaceChangeTick)
  const scope = `${desktopFsCacheKey(connection)}:${cwd}:${tick}:${revision}`
  const [result, setResult] = useState<Awaited<ReturnType<typeof readFilterTree>> & { scope: string }>()

  useEffect(() => {
    if (!enabled || !cwd) {
      return
    }

    const controller = new AbortController()

    const timer = setTimeout(() => {
      void readFilterTree(cwd, controller.signal).then(next => {
        if (!controller.signal.aborted) {
          setResult({ ...next, scope })
        }
      })
    }, 180)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [cwd, enabled, scope])

  return {
    data: result?.scope === scope ? result.data : [],
    loading: enabled && result?.scope !== scope,
    partial: result?.scope === scope && result.partial
  }
}
