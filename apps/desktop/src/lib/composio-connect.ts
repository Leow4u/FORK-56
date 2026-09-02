import { completeComposioConnect } from '@work4you/shared'

import { type ProfileScope } from '@/api/client'
import { authorizeConnector, bootstrapConnectors, waitConnector } from '@/api/mcp'

/** Capabilities / chat Connect for a Work4You App directory slug. */
export async function connectWork4YouApp(
  slug: string,
  opts: {
    open: (url: string) => void | Promise<void>
    profile?: ProfileScope
  }
): Promise<boolean> {
  await bootstrapConnectors(opts.profile)

  return completeComposioConnect({
    authorize: () => authorizeConnector(slug, opts.profile),
    wait: () => waitConnector(slug, opts.profile),
    open: opts.open
  })
}
