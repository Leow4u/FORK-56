import {
  type BillingApi,
  type BillingResult,
  type BillingStateResponse,
  createBillingApi,
  type SubscriptionStateResponse,
} from "@work4you/shared";
import { atom } from "nanostores";

import { api, type PortalAccountIdentity } from "@/lib/api";

import { accountRequest } from "./account-gateway";

export const accountBillingApi: BillingApi = createBillingApi(accountRequest);

/** Undefined until the first `billing.state` answer lands. */
export const $billingResult = atom<
  BillingResult<BillingStateResponse> | undefined
>(undefined);
export const $subscriptionResult = atom<
  BillingResult<SubscriptionStateResponse> | undefined
>(undefined);
export const $accountRefreshing = atom(false);
/** Portal person (cadastro name + email); null until read or when unavailable. */
export const $portalIdentity = atom<PortalAccountIdentity | null>(null);

let inflight: Promise<void> | null = null;
let rerun = false;

/**
 * Re-read billing + subscription. A call that lands while a read is in flight
 * schedules one more pass instead of returning the older answer, so a refresh
 * after a mutation always reflects that mutation.
 */
export function refreshAccount(
  billingApi: Pick<
    BillingApi,
    "fetchBillingState" | "fetchSubscriptionState"
  > = accountBillingApi,
): Promise<void> {
  if (inflight) {
    rerun = true;
    return inflight;
  }
  inflight = (async () => {
    $accountRefreshing.set(true);
    try {
      do {
        rerun = false;
        const [billing, subscription] = await Promise.all([
          billingApi.fetchBillingState(),
          billingApi.fetchSubscriptionState(),
        ]);
        $billingResult.set(billing);
        $subscriptionResult.set(subscription);
      } while (rerun);
    } finally {
      $accountRefreshing.set(false);
      inflight = null;
    }
  })();
  return inflight;
}

let identityRead: Promise<void> | null = null;

export function loadPortalIdentity(
  read: () => Promise<PortalAccountIdentity> = api.getPortalAccount,
): Promise<void> {
  identityRead ??= read()
    .then((identity) => $portalIdentity.set(identity))
    .catch(() => {
      identityRead = null;
    });
  return identityRead;
}
