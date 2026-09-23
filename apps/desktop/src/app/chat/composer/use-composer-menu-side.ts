import { type RefObject, useLayoutEffect, useState } from 'react'

import { composerMenuSide, type DockedComposerAnchor } from '@/app/chat/composer-placement'

function readAnchor(node: Element | null): DockedComposerAnchor {
  const host = node?.closest('[data-composer-anchor]') ?? node
  const anchor = host?.getAttribute('data-composer-anchor')

  return anchor === 'bottom' ? 'bottom' : 'midline'
}

/** Preferred menu side for the composer that owns `host`. Defaults to opening
 *  downward (empty intro). Follows `data-composer-anchor` when the thread
 *  docks the composer on the bottom edge. */
export function useComposerMenuSide(host: RefObject<HTMLElement | null>): 'bottom' | 'top' {
  const [side, setSide] = useState<'bottom' | 'top'>('bottom')

  useLayoutEffect(() => {
    const read = () => setSide(composerMenuSide(readAnchor(host.current)))

    read()

    const surface = host.current?.closest('[data-composer-anchor]')

    if (!surface) {
      return
    }

    const observer = new MutationObserver(read)

    observer.observe(surface, { attributeFilter: ['data-composer-anchor'], attributes: true })

    return () => observer.disconnect()
  }, [host])

  return side
}
