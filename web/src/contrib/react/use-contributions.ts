import { useCallback, useSyncExternalStore } from 'react'

import { registry } from '../registry'
import type { Contribution } from '../types'

export function useContributions(area: string): readonly Contribution[] {
  const subscribe = useCallback((onChange: () => void) => registry.subscribeArea(area, onChange), [area])
  const getSnapshot = useCallback(() => registry.getArea(area), [area])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
