import { describe, expect, it } from "vitest";

import {
  deriveAccountView,
  formatUsd,
  paymentMethodLabel,
  presentRefusal,
  validateAmount,
  validateAutoReload,
} from "./account-view";
import { accountCopyFor } from "./copy";
import {
  billingState,
  freeSubscriptionState,
  ok,
  paidCurrent,
  subscriptionState,
} from "./fixtures.test-util";

const en = accountCopyFor("en");
const pt = accountCopyFor("pt");

describe("deriveAccountView", () => {
  it("is loading until billing answers", () => {
    expect(deriveAccountView(undefined, undefined, en).status).toBe("loading");
  });

  it("surfaces a billing refusal instead of an empty account", () => {
    const view = deriveAccountView(
      { ok: false, refusal: { kind: "transport", message: "socket closed" } },
      undefined,
      en,
    );
    expect(view.status).toBe("refusal");
    expect(view.notice?.action).toEqual({ type: "retry" });
  });

  it("points a logged-out agent at the portal", () => {
    const view = deriveAccountView(
      ok(billingState({ logged_in: false, portal_url: "https://portal.example/login" })),
      ok(subscriptionState({ logged_in: false })),
      en,
    );
    expect(view.status).toBe("logged_out");
    expect(view.notice?.action).toEqual({
      type: "portal",
      url: "https://portal.example/login",
    });
  });

  it("Free: every paid tier is an in-app upgrade that opens portal checkout for this org", () => {
    const view = deriveAccountView(ok(billingState()), ok(freeSubscriptionState()), en);
    expect(view.plan?.isFree).toBe(true);
    expect(view.plan?.canChangeInApp).toBe(true);

    const current = view.tiers.filter((tier) => tier.state === "current");
    expect(current.map((tier) => tier.name)).toEqual(["Free"]);

    const upgrades = view.tiers.filter((tier) => tier.state === "upgrade");
    expect(upgrades.length).toBeGreaterThan(0);
    for (const tier of upgrades) {
      const url = new URL(tier.upgradeUrl ?? "");
      expect(url.pathname).toBe("/manage-subscription");
      expect(url.searchParams.get("org_id")).toBe("org_1");
      expect(url.searchParams.get("plan")).toBe(tier.tierId);
    }
  });

  it("Free: usage is a single allowance row, never paid credit math", () => {
    const view = deriveAccountView(ok(billingState()), ok(freeSubscriptionState()), en);
    expect(view.usage.map((row) => row.id)).toEqual(["allowance"]);
  });

  it("paid: tiers below the current one are downgrades and above are upgrades", () => {
    const view = deriveAccountView(ok(billingState()), ok(subscriptionState()), en);
    const order = view.tiers.map((tier) => tier.state);
    const currentIndex = order.indexOf("current");
    expect(currentIndex).toBeGreaterThan(-1);
    expect(order.slice(0, currentIndex).every((state) => state === "downgrade")).toBe(true);
    expect(order.slice(currentIndex + 1).every((state) => state === "upgrade")).toBe(true);
    expect(view.tiers.filter((tier) => tier.state !== "upgrade").every((t) => !t.upgradeUrl)).toBe(
      true,
    );
  });

  it("paid: subscription credit fill never leaves 0..1, even when overdrawn", () => {
    const view = deriveAccountView(
      ok(billingState()),
      ok(subscriptionState({ current: paidCurrent({ credits_remaining: "-3" }) })),
      en,
    );
    const row = view.usage.find((r) => r.id === "subscription_credits");
    expect(row?.fraction).toBeGreaterThanOrEqual(0);
    expect(row?.fraction).toBeLessThanOrEqual(1);
    expect(row?.danger).toBe(true);
    expect(row?.value).not.toContain("-$");
  });

  it("a scheduled downgrade marks its tier and offers the undo", () => {
    const view = deriveAccountView(
      ok(billingState()),
      ok(
        subscriptionState({
          current: paidCurrent({
            pending_downgrade_at: "2026-11-01T00:00:00Z",
            pending_downgrade_tier_name: "Free",
          }),
        }),
      ),
      en,
    );
    expect(view.plan?.pending).toMatchObject({ kind: "downgrade", tierName: "Free" });
    expect(view.tiers.find((tier) => tier.name === "Free")?.state).toBe("scheduled");
  });

  it("team accounts change plans on the portal, not in-app", () => {
    const view = deriveAccountView(
      ok(billingState()),
      ok(subscriptionState({ context: "team" })),
      en,
    );
    expect(view.tiers).toEqual([]);
    expect(view.plan?.canChangeInApp).toBe(false);
    expect(new URL(view.plan?.manageUrl ?? "").pathname).toBe("/manage-subscription");
  });

  it("profile link targets this org's settings on the portal origin", () => {
    const view = deriveAccountView(ok(billingState()), ok(subscriptionState()), en);
    expect(view.profileUrl).toBe("https://portal.work4you.ai/orgs/org_1/settings");
  });

  it("buying credits is disabled with a reason when no payment method is on file", () => {
    const view = deriveAccountView(
      ok(billingState({ card: null, payment_method: null })),
      ok(subscriptionState()),
      en,
    );
    expect(view.buy?.enabled).toBe(false);
    expect(view.buy?.disabledReason).toBe(en.credits.noCard);
  });

  it("renders in the user's language", () => {
    const view = deriveAccountView(ok(billingState()), ok(freeSubscriptionState()), pt);
    expect(view.plan?.name).toBe(pt.plan.free);
    expect(view.usage[0]?.title).toBe(pt.usage.allowance);
  });
});

describe("paymentMethodLabel", () => {
  it("prefers the typed payment method, so a Link customer is not 'no card'", () => {
    expect(
      paymentMethodLabel({
        card: null,
        payment_method: { email: "a@b.co", kind: "link", resolved_via: null },
      }),
    ).toContain("a@b.co");
  });

  it("falls back to the legacy card only when the gateway omits payment_method", () => {
    expect(paymentMethodLabel({ card: billingState().card })).toContain("4242");
    expect(paymentMethodLabel({ card: billingState().card, payment_method: null })).toBeNull();
  });
});

describe("amount validation", () => {
  const bounds = { max_usd: "1000", min_usd: "10" };

  it("accepts dollar amounts within the server bounds and normalizes them", () => {
    expect(validateAmount("$25.50", bounds, en)).toEqual({ amount: "25.5" });
  });

  it("rejects amounts outside the bounds or with sub-cent precision", () => {
    for (const raw of ["5", "5000", "12.345", "abc", "0"]) {
      expect(validateAmount(raw, bounds, en)).toHaveProperty("error");
    }
  });

  it("auto-reload requires the reload amount to exceed the threshold", () => {
    expect(validateAutoReload("50", "20", bounds, en)).toEqual({
      error: en.autoReload.reloadAboveThreshold,
    });
    expect(validateAutoReload("10", "50", bounds, en)).toEqual({
      reloadTo: "50",
      threshold: "10",
    });
  });
});

describe("presentRefusal", () => {
  it("routes a missing billing scope to the in-app step-up", () => {
    expect(
      presentRefusal({ kind: "insufficient_scope", message: "scope" }, en).action,
    ).toEqual({ type: "step_up" });
  });

  it("sends portal-recoverable refusals to the URL the server named", () => {
    expect(
      presentRefusal(
        { kind: "no_payment_method", message: "", portalUrl: "https://portal.example/x" },
        en,
      ).action,
    ).toEqual({ type: "portal", url: "https://portal.example/x" });
  });
});

describe("formatUsd", () => {
  it("renders whole and fractional dollars", () => {
    expect(formatUsd("20")).toBe("$20");
    expect(formatUsd("20.5")).toBe("$20.50");
    expect(formatUsd(null)).toBe("—");
  });
});
