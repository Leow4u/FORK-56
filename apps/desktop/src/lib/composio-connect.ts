import { completeComposioConnect, COMPOSIO_CONNECT_CANCELLED } from '@work4you/shared'

import { type ProfileScope } from '@/api/client'
import { authorizeConnector, bootstrapConnectors, waitConnector } from '@/api/mcp'
import { McpOAuthCancelled } from '@/lib/mcp-dashboard-oauth'

function rethrowConnectCancel(error: unknown): never {
  if (error instanceof Error && error.message === COMPOSIO_CONNECT_CANCELLED) {
    throw new McpOAuthCancelled()
  }

  throw error
}

/** Capabilities / chat Connect for a Work4You App directory slug. */
export async function connectWork4YouApp(
  slug: string,
  opts: {
    open: (url: string) => void | Promise<void>
    profile?: ProfileScope
    cancelled?: () => boolean
  }
): Promise<boolean> {
  await bootstrapConnectors(opts.profile)

  try {
    return await completeComposioConnect({
      authorize: () => authorizeConnector(slug, opts.profile),
      wait: connectionId => waitConnector(slug, opts.profile, connectionId),
      open: opts.open,
      cancelled: opts.cancelled
    })
  } catch (error) {
    rethrowConnectCancel(error)
  }
}
