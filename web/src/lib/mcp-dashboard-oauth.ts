import type { McpOAuthFlow } from "./api";

type CompleteOptions = {
  serverName: string;
  start: (name: string) => Promise<McpOAuthFlow>;
  status: (flowId: string) => Promise<McpOAuthFlow>;
  open: (url?: string | URL, target?: string, features?: string) => unknown;
  sleep?: (milliseconds: number) => Promise<void>;
  maxPollFailures?: number;
};

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export async function completeMcpDashboardOAuth({
  serverName,
  start,
  status,
  open,
  sleep = defaultSleep,
  maxPollFailures = 3,
}: CompleteOptions): Promise<McpOAuthFlow> {
  // Open synchronously from the click handler, before the first await. Browsers
  // otherwise classify the later OAuth popup as unsolicited and block it.
  const authWindow = open("about:blank", "_blank") as Window | null;
  if (!authWindow) {
    throw new Error("OAuth popup was blocked — allow popups for this dashboard and retry");
  }
  authWindow.opener = null;
  let started: McpOAuthFlow;
  try {
    started = await start(serverName);
    if (started.status === "error") {
      throw new Error(started.error || "OAuth failed to start");
    }
    if (!started.authorization_url) {
      throw new Error("OAuth server did not provide an authorization URL");
    }
    authWindow.location.href = started.authorization_url;
  } catch (error) {
    authWindow.close();
    throw error;
  }

  let pollFailures = 0;
  for (;;) {
    let current: McpOAuthFlow;
    try {
      current = await status(started.flow_id);
      pollFailures = 0;
    } catch (error) {
      pollFailures += 1;
      if (pollFailures >= maxPollFailures) throw error;
      await sleep(1000);
      continue;
    }
    if (current.status === "approved") return current;
    if (current.status === "error") {
      throw new Error(current.error || "OAuth authorization failed");
    }
    if (authWindow.closed) {
      throw new Error("OAuth authorization window was closed before completion");
    }
    await sleep(1000);
  }
}

/** Thrown when the caller's `cancelled()` tripped — skip error toasts on user cancel. */
export class McpOAuthCancelled extends Error {
  constructor() {
    super("OAuth cancelled by user");
    this.name = "McpOAuthCancelled";
  }
}

type DesktopCompleteOptions = {
  serverName: string;
  start: (name: string) => Promise<McpOAuthFlow>;
  status: (flowId: string) => Promise<McpOAuthFlow>;
  openExternal: (url: string) => Promise<void>;
  cancelled?: () => boolean;
  cancel?: (flowId: string) => Promise<unknown>;
  sleep?: (milliseconds: number) => Promise<void>;
  maxPollFailures?: number;
};

/** Desktop / in-chat MCP setup OAuth — popup via `openExternal` with cancel support. */
export async function completeMcpDesktopOAuth({
  serverName,
  start,
  status,
  openExternal,
  cancelled,
  cancel,
  sleep = defaultSleep,
  maxPollFailures = 3,
}: DesktopCompleteOptions): Promise<McpOAuthFlow> {
  const started = await start(serverName);

  if (started.status === "error") {
    throw new Error(started.error || "OAuth failed to start");
  }

  if (!started.authorization_url) {
    throw new Error("OAuth server did not provide an authorization URL");
  }

  await openExternal(started.authorization_url);

  let pollFailures = 0;
  for (;;) {
    if (cancelled?.()) {
      await cancel?.(started.flow_id).catch(() => {});
      throw new McpOAuthCancelled();
    }

    let current: McpOAuthFlow;
    try {
      current = await status(started.flow_id);
      pollFailures = 0;
    } catch (error) {
      pollFailures += 1;
      if (pollFailures >= maxPollFailures) throw error;
      await sleep(1000);
      continue;
    }

    if (current.status === "approved") return current;
    if (current.status === "error") {
      throw new Error(current.error || "OAuth authorization failed");
    }

    await sleep(1000);
  }
}
