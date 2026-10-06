import type { BillingApi } from "@work4you/shared";
import { describe, expect, it, vi } from "vitest";

import { billingState, ok, subscriptionState } from "./fixtures.test-util";

vi.mock("./account-gateway", () => ({
  accountRequest: vi.fn(),
  onAccountEvent: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: { getPortalAccount: vi.fn() } }));

const store = await import("./store");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function fakeApi(balances: string[]): Pick<
  BillingApi,
  "fetchBillingState" | "fetchSubscriptionState"
> & { gates: ReturnType<typeof deferred<void>>[] } {
  const gates: ReturnType<typeof deferred<void>>[] = [];
  let call = 0;
  return {
    fetchBillingState: vi.fn(async () => {
      const index = call++;
      const gate = deferred<void>();
      gates.push(gate);
      await gate.promise;
      return ok(billingState({ balance_display: balances[index] ?? "?" }));
    }),
    fetchSubscriptionState: vi.fn(async () => ok(subscriptionState())),
    gates,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("refreshAccount", () => {
  it("a refresh during an in-flight read runs one more pass and keeps the newest answer", async () => {
    const api = fakeApi(["$1", "$2"]);
    const first = store.refreshAccount(api);
    const second = store.refreshAccount(api);
    const third = store.refreshAccount(api);
    expect(store.$accountRefreshing.get()).toBe(true);

    await flush();
    api.gates[0]?.resolve();
    await flush();
    api.gates[1]?.resolve();
    await Promise.all([first, second, third]);

    expect(api.fetchBillingState).toHaveBeenCalledTimes(2);
    const result = store.$billingResult.get();
    expect(result?.ok && result.data.balance_display).toBe("$2");
    expect(store.$accountRefreshing.get()).toBe(false);
  });
});

describe("loadPortalIdentity", () => {
  it("reads the portal identity once and retries after a failure", async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ email: "ana@example.com", logged_in: true, name: "Ana" });

    await store.loadPortalIdentity(read);
    expect(store.$portalIdentity.get()).toBeNull();

    await store.loadPortalIdentity(read);
    await store.loadPortalIdentity(read);
    expect(read).toHaveBeenCalledTimes(2);
    expect(store.$portalIdentity.get()).toMatchObject({ name: "Ana" });
  });
});
