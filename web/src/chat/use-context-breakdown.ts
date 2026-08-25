import { useEffect, useState } from "react";

import type { GatewayClient } from "@/lib/gatewayClient";

import { parseContextBreakdown, type ContextBreakdown } from "./context-breakdown";

interface UseContextBreakdownOptions {
  busy: boolean;
  enabled: boolean;
  gateway: GatewayClient | null;
  sessionId: string | null | undefined;
}

/**
 * Fetch ``session.context_breakdown`` when idle — mirrors desktop hook.
 */
export function useContextBreakdown({
  busy,
  enabled,
  gateway,
  sessionId,
}: UseContextBreakdownOptions) {
  const [fetched, setFetched] = useState<{
    breakdown: ContextBreakdown;
    sessionId: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !sessionId || !gateway || busy) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    void gateway
      .request<unknown>("session.context_breakdown", {
        session_id: sessionId,
      })
      .then((payload) => {
        const breakdown = parseContextBreakdown(payload);
        if (!cancelled && breakdown) {
          setFetched({ breakdown, sessionId });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [busy, enabled, gateway, sessionId]);

  return {
    breakdown:
      fetched && fetched.sessionId === sessionId ? fetched.breakdown : null,
    loading,
  };
}
