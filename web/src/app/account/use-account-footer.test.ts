import { describe, expect, it, vi } from "vitest";

import { deriveAccountView } from "./account-view";
import { accountCopyFor } from "./copy";
import {
  billingState,
  freeSubscriptionState,
  ok,
  subscriptionState,
} from "./fixtures.test-util";

vi.mock("./account-gateway", () => ({
  accountRequest: vi.fn(),
  onAccountEvent: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: { getPortalAccount: vi.fn() } }));

const { footerPlan } = await import("./use-account-footer");
const copy = accountCopyFor("pt");

describe("footerPlan", () => {
  it("names the Free plan and offers the in-app upgrade", () => {
    const view = deriveAccountView(ok(billingState()), ok(freeSubscriptionState()), copy);
    expect(footerPlan(view, copy)).toEqual({
      isFree: true,
      label: copy.menu.planFree,
      upgradable: true,
    });
  });

  it("names the paid tier and offers no upgrade shortcut", () => {
    const view = deriveAccountView(ok(billingState()), ok(subscriptionState()), copy);
    expect(footerPlan(view, copy)).toMatchObject({ isFree: false, label: "Plus" });
  });

  it("is absent until the account is known", () => {
    expect(footerPlan(deriveAccountView(undefined, undefined, copy), copy)).toBeNull();
    const loggedOut = deriveAccountView(
      ok(billingState({ logged_in: false })),
      undefined,
      copy,
    );
    expect(footerPlan(loggedOut, copy)).toBeNull();
  });
});
