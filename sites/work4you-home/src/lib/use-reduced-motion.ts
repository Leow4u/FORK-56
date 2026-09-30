import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** true quando o visitante pediu menos movimento no sistema. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(QUERY)
    const sync = () => setReduced(query.matches)

    sync()
    query.addEventListener('change', sync)

    return () => query.removeEventListener('change', sync)
  }, [])

  return reduced
}
