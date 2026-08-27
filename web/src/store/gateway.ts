import { atom } from "nanostores";

import type { GatewayClient } from "@/lib/gatewayClient";

export const $gateway = atom<GatewayClient | null>(null);

export function activeGatewayConnectionId(): string | null {
  return null;
}

export function activeGateway(): GatewayClient | null {
  return $gateway.get();
}
