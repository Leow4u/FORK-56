import { useStore } from "@nanostores/react";
import { useEffect, useMemo } from "react";

import { deriveAccountView, type AccountView } from "./account-view";
import { useAccountCopy, type AccountCopy } from "./copy";
import {
  $accountRefreshing,
  $billingResult,
  $subscriptionResult,
  loadPortalIdentity,
  refreshAccount,
} from "./store";

const FOCUS_REFRESH_GAP_MS = 5000;

/**
 * Account view for the current locale. Re-reads billing on mount and when the
 * tab regains focus, so a checkout finished in the portal tab shows up here.
 */
export function useAccountView(): {
  copy: AccountCopy;
  refreshing: boolean;
  view: AccountView;
} {
  const copy = useAccountCopy();
  const billing = useStore($billingResult);
  const subscription = useStore($subscriptionResult);
  const refreshing = useStore($accountRefreshing);

  useEffect(() => {
    void refreshAccount();
    void loadPortalIdentity();
    let last = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < FOCUS_REFRESH_GAP_MS) return;
      last = Date.now();
      void refreshAccount();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const view = useMemo(
    () => deriveAccountView(billing, subscription, copy),
    [billing, subscription, copy],
  );

  return { copy, refreshing, view };
}
