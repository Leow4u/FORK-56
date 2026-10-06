import type { BillingApi, GatewayEvent } from "@work4you/shared";
import { describe, expect, it, vi } from "vitest";

import { accountCopyFor } from "./copy";
import { runStepUp, type VerificationSubscriber } from "./step-up";

vi.mock("./account-gateway", () => ({
  accountRequest: vi.fn(),
  onAccountEvent: vi.fn(),
}));

const copy = accountCopyFor("en");

function subscriber() {
  let handler: ((event: GatewayEvent<{ user_code?: unknown; verification_url?: unknown }>) => void) | null =
    null;
  const off = vi.fn();
  const subscribe: VerificationSubscriber = async (next) => {
    handler = next;
    return off;
  };
  return {
    emit: (payload: { user_code?: unknown; verification_url?: unknown }) =>
      handler?.({ payload, type: "billing.step_up.verification" }),
    off,
    subscribe,
  };
}

describe("runStepUp", () => {
  it("shows the approval page mid-request, then reports the grant", async () => {
    const events = subscriber();
    const onVerification = vi.fn();
    const stepUp = vi.fn<BillingApi["stepUp"]>(async () => {
      events.emit({ user_code: "ABCD-1234", verification_url: "https://portal.example/device" });
      return { data: { granted: true, ok: true }, ok: true };
    });

    const outcome = await runStepUp({ stepUp }, copy, onVerification, events.subscribe);

    expect(onVerification).toHaveBeenCalledWith({
      code: "ABCD-1234",
      url: "https://portal.example/device",
    });
    expect(outcome).toEqual({ kind: "granted", message: copy.refusal.granted });
    expect(events.off).toHaveBeenCalled();
  });

  it("ignores verification events without a URL", async () => {
    const events = subscriber();
    const onVerification = vi.fn();
    const stepUp = vi.fn<BillingApi["stepUp"]>(async () => {
      events.emit({ user_code: "X" });
      return { data: { granted: true, ok: true }, ok: true };
    });
    await runStepUp({ stepUp }, copy, onVerification, events.subscribe);
    expect(onVerification).not.toHaveBeenCalled();
  });

  it("a finished flow that did not grant billing is an error, not a success", async () => {
    const events = subscriber();
    const stepUp = vi.fn<BillingApi["stepUp"]>(async () => ({
      data: { granted: false, ok: true },
      ok: true,
    }));
    const outcome = await runStepUp({ stepUp }, copy, vi.fn(), events.subscribe);
    expect(outcome).toMatchObject({ kind: "error", message: copy.refusal.notGranted });
    expect(events.off).toHaveBeenCalled();
  });

  it("still runs the step-up when the event stream is unavailable", async () => {
    const stepUp = vi.fn<BillingApi["stepUp"]>(async () => ({
      ok: false,
      refusal: { kind: "transport", message: "closed" },
    }));
    const outcome = await runStepUp({ stepUp }, copy, vi.fn(), async () => {
      throw new Error("no socket");
    });
    expect(stepUp).toHaveBeenCalled();
    expect(outcome.kind).toBe("error");
  });
});
