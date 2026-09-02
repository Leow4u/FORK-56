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

function pageProtocolOf(pageProtocol?: string): string {
  if (typeof pageProtocol === 'string') {
    return pageProtocol
  }

  return typeof window === 'undefined' ? '' : window.location.protocol
}

/**
 * Packaged Electron (file://) must proxy the SVG through main via Chromium
 * net.fetch and paint a data URL. http(s) origins (web, Vite) keep the CDN.
 * Do not key the proxy on "is the IPC method present" — the packaged shell
 * always exposes it, and that is what sent #182 through Node fetch on every
 * origin including ones that could have loaded the CDN directly.
 */
export async function resolveComposioLogoSrc(url: string, pageProtocol?: string): Promise<string> {
  if (!isTrustedComposioLogoUrl(url)) {
    throw new Error('untrusted composio logo url')
  }

  if (pageProtocolOf(pageProtocol) !== 'file:') {
    return url
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

  if (!fetchLogo) {
    throw new Error('composio logo proxy unavailable')
  }

  const task = fetchLogo(url).then(resolved => {
    if (typeof resolved !== 'string' || !resolved.startsWith('data:image/')) {
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

export function useComposioLogoSrc(
  logo?: null | string,
  pageProtocol?: string
): { failed: boolean; src: string | null } {
  const remote = typeof logo === 'string' && isTrustedComposioLogoUrl(logo) ? logo : null
  const protocol = pageProtocolOf(pageProtocol)
  const needsProxy = protocol === 'file:'
  const [src, setSrc] = useState<null | string>(() => (remote && !needsProxy ? remote : null))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!remote) {
      setSrc(null)
      setFailed(false)

      return
    }

    if (!needsProxy) {
      setSrc(remote)
      setFailed(false)

      return
    }

    let cancelled = false

    setFailed(false)
    setSrc(null)
    void resolveComposioLogoSrc(remote, protocol).then(
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
  }, [needsProxy, protocol, remote])

  return { failed, src }
}
