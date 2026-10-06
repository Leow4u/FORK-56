import { useStore } from "@nanostores/react";
import { useEffect, useMemo } from "react";

import type { PortalAccountIdentity } from "@/lib/api";

import { deriveAccountView, type AccountView } from "./account-view";
import { useAccountCopy, type AccountCopy } from "./copy";
import {
  $billingResult,
  $portalIdentity,
  $subscriptionResult,
  loadPortalIdentity,
  refreshAccount,
} from "./store";

export interface FooterPlan {
  isFree: boolean;
  /** Footer caption: "Free plan" or the paid tier name. */
  label: string;
  /** True when the plans grid can take the user to a paid tier in-app. */
  upgradable: boolean;
}

export function footerPlan(view: AccountView, copy: AccountCopy): FooterPlan | null {
  if (view.status !== "normal" || !view.plan) return null;
  const { plan } = view;
  return {
    isFree: plan.isFree,
    label: plan.isFree ? copy.menu.planFree : plan.name,
    upgradable: plan.isFree && view.tiers.some((tier) => tier.state === "upgrade"),
  };
}

let started = false;

/** Identity + plan for the sidebar footer. Loads once per page lifetime. */
export function useAccountFooter(): {
  copy: AccountCopy;
  identity: PortalAccountIdentity | null;
  plan: FooterPlan | null;
} {
  const copy = useAccountCopy();
  const identity = useStore($portalIdentity);
  const billing = useStore($billingResult);
  const subscription = useStore($subscriptionResult);

  useEffect(() => {
    void loadPortalIdentity();
    if (started) return;
    started = true;
    void refreshAccount();
  }, []);

  const plan = useMemo(
    () => footerPlan(deriveAccountView(billing, subscription, copy), copy),
    [billing, subscription, copy],
  );

  return { copy, identity: identity?.logged_in === false ? null : identity, plan };
}
