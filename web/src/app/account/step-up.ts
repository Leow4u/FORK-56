import type { BillingApi, GatewayEvent } from "@work4you/shared";

import { presentRefusal } from "./account-view";
import { onAccountEvent } from "./account-gateway";
import type { AccountCopy } from "./copy";

export interface StepUpVerification {
  code: string | null;
  url: string;
}

export type StepUpOutcome =
  | { kind: "granted"; message: string }
  | { kind: "error"; message: string; title: string };

interface VerificationPayload {
  user_code?: unknown;
  verification_url?: unknown;
}

export type VerificationSubscriber = (
  handler: (event: GatewayEvent<VerificationPayload>) => void,
) => Promise<() => void>;

const subscribeVerification: VerificationSubscriber = (handler) =>
  onAccountEvent<VerificationPayload>("billing.step_up.verification", handler);

/**
 * Elevate this agent's Portal grant to billing scope. The backend blocks on a
 * device flow and announces the approval URL as an event mid-request; the
 * caller shows it (and opens it) while the request is still pending.
 */
export async function runStepUp(
  billingApi: Pick<BillingApi, "stepUp">,
  copy: AccountCopy,
  onVerification: (verification: StepUpVerification) => void,
  subscribe: VerificationSubscriber = subscribeVerification,
): Promise<StepUpOutcome> {
  let off: (() => void) | null = null;
  try {
    off = await subscribe((event) => {
      const url = event.payload?.verification_url;
      if (typeof url !== "string" || !url) return;
      const code = event.payload?.user_code;
      onVerification({ code: typeof code === "string" ? code : null, url });
    });
  } catch {
    off = null;
  }

  try {
    const result = await billingApi.stepUp();
    if (!result.ok) {
      const notice = presentRefusal(result.refusal, copy);
      return { kind: "error", message: notice.message, title: notice.title };
    }
    if (!result.data.granted) {
      return {
        kind: "error",
        message: copy.refusal.notGranted,
        title: copy.refusal.stepUpTitle,
      };
    }
    return { kind: "granted", message: copy.refusal.granted };
  } finally {
    off?.();
  }
}
