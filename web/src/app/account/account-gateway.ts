import type { BillingRequestGateway } from "@work4you/shared";

import {
  GatewayClient,
  type GatewayEvent,
  type GatewayEventName,
} from "@/lib/gatewayClient";

// The billing step-up runs a device flow on the backend that blocks for the
// whole device-code lifetime, so its request must outlive the default timeout.
const STEP_UP_TIMEOUT_MS = 15 * 60 * 1000;

let client: GatewayClient | null = null;
let pendingConnect: Promise<GatewayClient> | null = null;

/**
 * One lazily-opened gateway socket for the account surfaces (footer plan,
 * account page). Billing RPCs need no chat session, so this socket stays
 * independent of the chat host and reconnects on the next call after a drop.
 */
function connectedClient(): Promise<GatewayClient> {
  if (client?.connectionState === "open") return Promise.resolve(client);
  pendingConnect ??= (async () => {
    try {
      const next = new GatewayClient();
      await next.connect();
      client = next;
      return next;
    } finally {
      pendingConnect = null;
    }
  })();
  return pendingConnect;
}

export const accountRequest: BillingRequestGateway = async (
  method,
  params,
  timeoutMs,
  signal,
) => {
  const gateway = await connectedClient();
  const timeout =
    timeoutMs ?? (method === "billing.step_up" ? STEP_UP_TIMEOUT_MS : undefined);
  return gateway.request(method, params, timeout, signal);
};

export async function onAccountEvent<P>(
  type: GatewayEventName,
  handler: (event: GatewayEvent<P>) => void,
): Promise<() => void> {
  const gateway = await connectedClient();
  return gateway.on<P>(type, handler);
}
