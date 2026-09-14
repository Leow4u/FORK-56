import { completeComposioConnect, COMPOSIO_CONNECT_CANCELLED } from "@work4you/shared";

import { api } from "@/lib/api";
import { McpOAuthCancelled } from "@/lib/mcp-dashboard-oauth";

function rethrowConnectCancel(error: unknown): never {
  if (error instanceof Error && error.message === COMPOSIO_CONNECT_CANCELLED) {
    throw new McpOAuthCancelled();
  }

  throw error;
}

/** Capabilities / chat Connect for a Work4You App directory slug. */
export async function connectWork4YouApp(
  slug: string,
  open: (url: string) => void | Promise<void>,
  cancelled?: () => boolean,
): Promise<boolean> {
  await api.bootstrapConnectors();

  try {
    return await completeComposioConnect({
      authorize: () => api.authorizeConnector(slug),
      wait: (connectionId) => api.waitConnector(slug, connectionId),
      open,
      cancelled,
    });
  } catch (error) {
    rethrowConnectCancel(error);
  }
}

export function openComposioConnectUrl(url: string, popup?: Window | null): void {
  if (popup && !popup.closed) {
    popup.location.href = url;
    return;
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");

  if (!opened) {
    throw new Error("Connect popup was blocked — allow popups for this dashboard and retry");
  }

  opened.opener = null;
}
