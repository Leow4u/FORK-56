import { completeComposioConnect } from "@work4you/shared";

import { api } from "@/lib/api";

/** Capabilities / chat Connect for a Work4You App directory slug. */
export async function connectWork4YouApp(
  slug: string,
  open: (url: string) => void | Promise<void>,
): Promise<boolean> {
  await api.bootstrapConnectors();

  return completeComposioConnect({
    authorize: () => api.authorizeConnector(slug),
    wait: () => api.waitConnector(slug),
    open,
  });
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
