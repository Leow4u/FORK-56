import { isTrustedComposioLogoUrl } from '@work4you/shared'
import { useEffect, useState } from 'react'

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

export function resetComposioLogoCache(): void {
  cache.clear()
  inflight.clear()
}

function desktopLogoFetch(): ((url: string) => Promise<null | string>) | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.work4youDesktop?.fetchComposioLogo
}

/** Packaged Electron must proxy the SVG through main; file:// cannot paint the CDN `<img>`. */
export async function resolveComposioLogoSrc(url: string): Promise<string> {
  if (!isTrustedComposioLogoUrl(url)) {
    throw new Error('untrusted composio logo url')
  }

  const hit = cache.get(url)

  if (hit) {
    return hit
  }

  const pending = inflight.get(url)

  if (pending) {
    return pending
  }

  const fetchLogo = desktopLogoFetch()

  const task = (fetchLogo ? fetchLogo(url) : Promise.resolve(url)).then(resolved => {
    if (typeof resolved !== 'string' || !resolved) {
      throw new Error('composio logo empty')
    }

    if (resolved !== url && !resolved.startsWith('data:image/')) {
      throw new Error('composio logo is not an image data url')
    }

    cache.set(url, resolved)

    return resolved
  })

  inflight.set(url, task)

  return task.finally(() => {
    inflight.delete(url)
  })
}

export function useComposioLogoSrc(logo?: null | string): { failed: boolean; src: string | null } {
  const remote = typeof logo === 'string' && isTrustedComposioLogoUrl(logo) ? logo : null
  const proxy = Boolean(desktopLogoFetch())
  const [src, setSrc] = useState<null | string>(() => (remote && !proxy ? remote : null))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!remote) {
      setSrc(null)
      setFailed(false)

      return
    }

    if (!proxy) {
      setSrc(remote)
      setFailed(false)

      return
    }

    let cancelled = false

    setFailed(false)
    setSrc(null)
    void resolveComposioLogoSrc(remote).then(
      next => {
        if (!cancelled) {
          setSrc(next)
          setFailed(false)
        }
      },
      () => {
        if (!cancelled) {
          setSrc(null)
          setFailed(true)
        }
      }
    )

    return () => {
      cancelled = true
    }
  }, [proxy, remote])

  return { failed, src }
}
