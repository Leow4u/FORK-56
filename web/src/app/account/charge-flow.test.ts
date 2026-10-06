import type {
  BillingApi,
  BillingChargeResponse,
  BillingChargeResult,
  BillingChargeStatusResponse,
  BillingResult,
} from "@work4you/shared";
import { describe, expect, it, vi } from "vitest";

import { createChargeRunner, pollChargeSettlement } from "./charge-flow";
import { accountCopyFor } from "./copy";

const copy = accountCopyFor("en");

function fakeClock() {
  let now = 0;
  return {
    now: () => now,
    sleep: async (ms: number) => {
      now += ms;
    },
  };
}

const status = (
  data: Partial<BillingChargeStatusResponse>,
): BillingResult<BillingChargeStatusResponse> => ({
  data: { ok: true, ...data },
  ok: true,
});

describe("pollChargeSettlement", () => {
  it("reports success once the charge settles", async () => {
    const chargeStatus = vi
      .fn<BillingApi["chargeStatus"]>()
      .mockResolvedValueOnce(status({ status: "pending" }))
      .mockResolvedValueOnce(status({ amount_usd: "25", status: "settled" }));
    const outcome = await pollChargeSettlement({ chargeStatus }, "ch_1", copy, null, fakeClock());
    expect(outcome).toEqual({ kind: "success", message: copy.credits.success("$25") });
    expect(chargeStatus).toHaveBeenCalledTimes(2);
  });

  it("explains a declined card", async () => {
    const chargeStatus = vi
      .fn<BillingApi["chargeStatus"]>()
      .mockResolvedValue(status({ reason: "card_declined", status: "failed" }));
    const outcome = await pollChargeSettlement({ chargeStatus }, "ch_1", copy, null, fakeClock());
    expect(outcome).toMatchObject({ kind: "failure", message: copy.credits.declined });
  });

  it("never claims failure for a charge still pending after the poll cap", async () => {
    const chargeStatus = vi
      .fn<BillingApi["chargeStatus"]>()
      .mockResolvedValue(status({ status: "pending" }));
    const outcome = await pollChargeSettlement(
      { chargeStatus },
      "ch_1",
      copy,
      "https://portal.example/billing",
      fakeClock(),
    );
    expect(outcome).toEqual({
      kind: "ambiguous",
      message: copy.credits.ambiguousMessage,
      portalUrl: "https://portal.example/billing",
      title: copy.credits.ambiguousTitle,
    });
  });
});

describe("createChargeRunner", () => {
  const sent = (
    result: BillingResult<BillingChargeResponse>,
    key = "k",
  ): BillingChargeResult => ({ ...result, idempotencyKey: key });

  it("reuses the idempotency key after a send that may have reached the server", async () => {
    const charge = vi
      .fn<BillingApi["charge"]>()
      .mockResolvedValueOnce(
        sent({ ok: false, refusal: { kind: "timeout", message: "timed out" } }, "key-1"),
      )
      .mockResolvedValueOnce(sent({ data: { charge_id: "ch_1", ok: true }, ok: true }, "key-1"));
    const chargeStatus = vi
      .fn<BillingApi["chargeStatus"]>()
      .mockResolvedValue(status({ amount_usd: "25", status: "settled" }));
    const runner = createChargeRunner({ charge, chargeStatus }, copy, fakeClock());

    expect((await runner.run("25")).kind).toBe("failure");
    expect((await runner.run("25")).kind).toBe("success");
    expect(charge.mock.calls[0]?.[1]).toBeUndefined();
    expect(charge.mock.calls[1]?.[1]).toBe("key-1");
  });

  it("starts a fresh key when the amount changes or the refusal was final", async () => {
    const charge = vi
      .fn<BillingApi["charge"]>()
      .mockResolvedValueOnce(
        sent({ ok: false, refusal: { kind: "timeout", message: "" } }, "key-1"),
      )
      .mockResolvedValueOnce(
        sent({ ok: false, refusal: { kind: "no_payment_method", message: "" } }, "key-2"),
      )
      .mockResolvedValueOnce(
        sent({ ok: false, refusal: { kind: "no_payment_method", message: "" } }, "key-3"),
      );
    const runner = createChargeRunner(
      { charge, chargeStatus: vi.fn<BillingApi["chargeStatus"]>() },
      copy,
      fakeClock(),
    );

    await runner.run("25");
    await runner.run("50");
    await runner.run("50");
    expect(charge.mock.calls.map((call) => call[1])).toEqual([undefined, undefined, undefined]);
  });

  it("only reports polling once the server accepted the charge", async () => {
    const onPolling = vi.fn();
    const charge = vi
      .fn<BillingApi["charge"]>()
      .mockResolvedValue(sent({ ok: false, refusal: { kind: "role_required", message: "" } }));
    const runner = createChargeRunner(
      { charge, chargeStatus: vi.fn<BillingApi["chargeStatus"]>() },
      copy,
      fakeClock(),
    );
    const outcome = await runner.run("25", onPolling);
    expect(onPolling).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ action: { type: "portal" }, kind: "failure" });
  });
});
