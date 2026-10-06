import {
  type BillingApi,
  type BillingChargeStatusResponse,
  type BillingRefusal,
  driveChargeSettlement,
  refusalPolicy,
} from "@work4you/shared";

import {
  chargeFailureMessage,
  formatUsd,
  presentRefusal,
  type RefusalAction,
} from "./account-view";
import type { AccountCopy } from "./copy";

export type ChargeOutcome =
  | { kind: "success"; message: string }
  | { action?: RefusalAction; kind: "failure"; message: string; title: string }
  | { kind: "ambiguous"; message: string; portalUrl?: string; title: string };

export interface ChargeClock {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// A send that failed before the server answered may still have created the
// charge; retrying the same amount must reuse its idempotency key.
const RETRYABLE_SEND_KINDS = new Set([
  "endpoint_unavailable",
  "rate_limited",
  "temporarily_unavailable",
  "timeout",
  "transport",
]);

function statusFromRefusal(refusal: BillingRefusal): BillingChargeStatusResponse {
  return {
    error: refusal.kind,
    message: refusal.message,
    ok: false,
    payload: refusal.payload,
    portal_url: refusal.portalUrl,
    retry_after: refusal.retryAfter,
  } as BillingChargeStatusResponse;
}

export async function pollChargeSettlement(
  billingApi: Pick<BillingApi, "chargeStatus">,
  chargeId: string,
  copy: AccountCopy,
  portalUrl: null | string | undefined,
  clock: ChargeClock = {},
): Promise<ChargeOutcome> {
  let lastRefusal: BillingRefusal | undefined;
  const settlement = await driveChargeSettlement({
    fetchStatus: async () => {
      const result = await billingApi.chargeStatus(chargeId);
      if (result.ok) {
        lastRefusal = undefined;
        return result.data;
      }
      lastRefusal = result.refusal;
      return statusFromRefusal(result.refusal);
    },
    isCancelled: () => false,
    now: clock.now ?? Date.now,
    sleep: clock.sleep ?? defaultSleep,
  });

  const ambiguous: ChargeOutcome = {
    kind: "ambiguous",
    message: copy.credits.ambiguousMessage,
    portalUrl: portalUrl ?? undefined,
    title: copy.credits.ambiguousTitle,
  };

  switch (settlement.kind) {
    case "settled": {
      const amount = settlement.status.amount_usd;
      return {
        kind: "success",
        message: copy.credits.success(amount ? formatUsd(amount) : "$"),
      };
    }
    case "failed":
      return {
        kind: "failure",
        message: chargeFailureMessage(settlement.status.reason, copy),
        title: copy.credits.failedTitle,
      };
    case "ambiguous":
      if (settlement.status && refusalPolicy(settlement.error).ambiguousMidPoll) {
        return ambiguous;
      }
      return {
        kind: "failure",
        message: lastRefusal?.message || copy.refusal.connectionMessage,
        title: copy.refusal.connectionTitle,
      };
    case "refused":
      return {
        kind: "failure",
        message:
          lastRefusal?.message ||
          settlement.status.message ||
          copy.refusal.connectionMessage,
        title: copy.refusal.genericTitle,
      };
    case "cancelled":
    case "timed_out":
      return ambiguous;
  }
}

export interface ChargeRunner {
  /** Resolves once the charge settles, fails, or its outcome is unknowable. */
  run: (
    amountUsd: string,
    onPolling?: () => void,
  ) => Promise<ChargeOutcome>;
}

/**
 * One buy-credits flow. Keeps the idempotency key of a send that failed in a
 * retryable way, so pressing Buy again for the same amount cannot double-charge.
 */
export function createChargeRunner(
  billingApi: Pick<BillingApi, "charge" | "chargeStatus">,
  copy: AccountCopy,
  clock: ChargeClock = {},
): ChargeRunner {
  let retry: { amountUsd: string; idempotencyKey: string } | null = null;

  return {
    run: async (amountUsd, onPolling) => {
      const key = retry?.amountUsd === amountUsd ? retry.idempotencyKey : undefined;
      const sent = await billingApi.charge(amountUsd, key);

      if (!sent.ok) {
        retry = RETRYABLE_SEND_KINDS.has(sent.refusal.kind)
          ? { amountUsd, idempotencyKey: sent.idempotencyKey }
          : null;
        const notice = presentRefusal(sent.refusal, copy);
        return {
          action: notice.action,
          kind: "failure",
          message: notice.message,
          title: notice.title,
        };
      }

      retry = null;
      const chargeId = sent.data.charge_id;
      if (!chargeId) {
        return {
          kind: "ambiguous",
          message: copy.credits.ambiguousMessage,
          portalUrl: sent.data.portal_url ?? undefined,
          title: copy.credits.ambiguousTitle,
        };
      }

      onPolling?.();
      return pollChargeSettlement(
        billingApi,
        chargeId,
        copy,
        sent.data.portal_url,
        clock,
      );
    },
  };
}
