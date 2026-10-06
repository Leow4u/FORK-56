import {
  type BillingRefusal,
  type BillingResult,
  type BillingStateResponse,
  buildManageSubscriptionUrl,
  classifyPlanTiers,
  FALLBACK_PORTAL_BILLING_URL,
  FALLBACK_PORTAL_URL,
  findCurrentTier,
  isFreeCatalogTier,
  isFreePlan,
  type PlanTierState,
  plansCapable,
  refusalPolicy,
  type SubscriptionStateResponse,
} from "@work4you/shared";

import type { AccountCopy } from "./copy";

export const EMPTY_VALUE = "—";

export type RefusalAction =
  | { type: "none" }
  | { type: "portal"; url: string }
  | { type: "retry" }
  | { type: "step_up" };

export interface AccountNotice {
  action: RefusalAction;
  message: string;
  title: string;
}

export type PendingChange =
  | { kind: "cancellation"; when: string }
  | { kind: "downgrade"; tierName: string; when: string };

export interface AccountPlanView {
  caption: string;
  /** Whether the in-app plans grid has an upgrade or downgrade to offer. */
  canChangeInApp: boolean;
  isFree: boolean;
  manageUrl: string;
  name: string;
  pending?: PendingChange;
  price?: string;
}

export interface AccountTierView {
  credits?: string;
  name: string;
  price: string;
  state: PlanTierState;
  tierId: string;
  upgradeUrl?: string;
}

export interface AccountUsageRow {
  caption: string;
  danger?: boolean;
  /** 0..1 fill for rows with a real denominator. */
  fraction?: number;
  id: "allowance" | "monthly_cap" | "subscription_credits" | "topup_credits";
  title: string;
  value: string;
}

export interface AutoReloadView {
  caption?: string;
  description: string;
  kind: "distinct" | "off" | "on" | "unavailable";
  /** Request-ready amounts ("" when unknown), used to prefill the editor. */
  reloadTo: string;
  threshold: string;
}

export interface BuyCreditsView {
  disabledReason?: string;
  enabled: boolean;
  presets: { amount: string; label: string }[];
}

export interface AccountView {
  autoReload?: AutoReloadView;
  balance: string;
  bounds: Pick<BillingStateResponse, "max_usd" | "min_usd">;
  buy?: BuyCreditsView;
  notice?: AccountNotice;
  orgName: string | null;
  payment?: { label: string | null; url: string };
  plan?: AccountPlanView;
  portalUrl: string;
  profileUrl: string;
  status: "loading" | "logged_out" | "normal" | "refusal";
  tiers: AccountTierView[];
  usage: AccountUsageRow[];
}

export function parseAmount(value?: null | number | string): null | number {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatUsd(value?: null | number | string): string {
  const amount = parseAmount(value);
  if (amount == null) return EMPTY_VALUE;
  const whole = amount % 1 === 0;
  // Pinned to en-US so USD always renders as "$" next to server *_display strings.
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: whole ? 0 : 2,
    minimumFractionDigits: whole ? 0 : 2,
    style: "currency",
  }).format(amount);
}

export function formatAccountDate(
  value: null | string | undefined,
  locale: string,
): string {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function requestAmount(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** Validate a typed dollar amount against the server's min/max bounds. */
export function validateAmount(
  raw: string,
  bounds: Pick<BillingStateResponse, "max_usd" | "min_usd">,
  copy: AccountCopy,
): { amount: string } | { error: string } {
  const cleaned = raw.trim().replace(/^\$/, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned) || !(Number(cleaned) > 0)) {
    return { error: copy.credits.invalidAmount };
  }
  const amount = Number(cleaned);
  const min = parseAmount(bounds.min_usd);
  if (min != null && amount < min) {
    return { error: copy.credits.minimum(formatUsd(min)) };
  }
  const max = parseAmount(bounds.max_usd);
  if (max != null && amount > max) {
    return { error: copy.credits.maximum(formatUsd(max)) };
  }
  return { amount: requestAmount(amount) };
}

export function validateAutoReload(
  thresholdRaw: string,
  reloadToRaw: string,
  bounds: Pick<BillingStateResponse, "max_usd" | "min_usd">,
  copy: AccountCopy,
): { error: string } | { reloadTo: string; threshold: string } {
  const threshold = validateAmount(thresholdRaw, bounds, copy);
  if ("error" in threshold) return threshold;
  const reloadTo = validateAmount(reloadToRaw, bounds, copy);
  if ("error" in reloadTo) return reloadTo;
  if (Number(reloadTo.amount) <= Number(threshold.amount)) {
    return { error: copy.autoReload.reloadAboveThreshold };
  }
  return { reloadTo: reloadTo.amount, threshold: threshold.amount };
}

export function presentRefusal(
  refusal: BillingRefusal,
  copy: AccountCopy,
  fallbackPortalUrl: string = FALLBACK_PORTAL_URL,
): AccountNotice {
  const r = copy.refusal;
  const portal: RefusalAction = {
    type: "portal",
    url: refusal.portalUrl ?? fallbackPortalUrl,
  };

  switch (refusal.kind) {
    case "insufficient_scope":
      return { action: { type: "step_up" }, message: r.stepUpMessage, title: r.stepUpTitle };
    case "consent_required":
    case "no_payment_method":
      return { action: portal, message: r.noCardMessage, title: r.noCardTitle };
    case "role_required":
      return { action: portal, message: r.roleMessage, title: r.roleTitle };
    case "cli_billing_disabled":
    case "remote_spending_disabled":
    case "remote_spending_revoked":
      return { action: portal, message: r.remoteOffMessage, title: r.remoteOffTitle };
    case "monthly_cap_exceeded":
      return { action: portal, message: r.capMessage, title: r.capTitle };
    case "rate_limited":
    case "stripe_unavailable":
    case "temporarily_unavailable":
      return { action: { type: "retry" }, message: r.busyMessage, title: r.busyTitle };
    case "session_revoked":
      return { action: { type: "none" }, message: r.sessionMessage, title: r.sessionTitle };
    case "endpoint_unavailable":
    case "network_error":
    case "timeout":
    case "transport":
      return {
        action: { type: "retry" },
        message: r.connectionMessage,
        title: r.connectionTitle,
      };
  }

  const recovery = refusalPolicy(refusal.kind).recovery;
  const action: RefusalAction =
    recovery === "portal" || recovery === "reconnect"
      ? portal
      : recovery === "retry"
        ? { type: "retry" }
        : recovery === "step_up"
          ? { type: "step_up" }
          : { type: "none" };
  return { action, message: refusal.message, title: r.genericTitle };
}

export function chargeFailureMessage(
  reason: null | string | undefined,
  copy: AccountCopy,
): string {
  switch ((reason || "").trim()) {
    case "authentication_required":
    case "subscription_payment_intent_requires_action":
      return copy.credits.authRequired;
    case "payment_method_expired":
      return copy.credits.expired;
    case "card_declined":
      return copy.credits.declined;
    default:
      return copy.credits.genericFailure(reason || "processing_error");
  }
}

function emptyView(
  status: AccountView["status"],
  notice?: AccountNotice,
): AccountView {
  return {
    balance: EMPTY_VALUE,
    bounds: { max_usd: null, min_usd: null },
    notice,
    orgName: null,
    portalUrl: FALLBACK_PORTAL_URL,
    profileUrl: FALLBACK_PORTAL_URL,
    status,
    tiers: [],
    usage: [],
  };
}

function portalOrigin(url: null | string | undefined): string {
  try {
    return new URL(url || FALLBACK_PORTAL_URL).origin;
  } catch {
    return FALLBACK_PORTAL_URL;
  }
}

function pendingChange(
  current: SubscriptionStateResponse["current"] | undefined,
  locale: string,
): PendingChange | undefined {
  if (current?.pending_downgrade_tier_name && current.pending_downgrade_at) {
    return {
      kind: "downgrade",
      tierName: current.pending_downgrade_tier_name,
      when: formatAccountDate(current.pending_downgrade_at, locale),
    };
  }
  if (current?.cancel_at_period_end && current.cancellation_effective_at) {
    return {
      kind: "cancellation",
      when: formatAccountDate(current.cancellation_effective_at, locale),
    };
  }
  return undefined;
}

function creditsLabel(monthlyCredits: null | string, copy: AccountCopy) {
  const credits = parseAmount(monthlyCredits);
  return credits != null && credits > 0
    ? copy.tiers.creditsPerMonth(formatUsd(credits))
    : undefined;
}

function cardLabel(brand: null | string | undefined, last4: null | string | undefined) {
  if (!brand || !last4) return null;
  return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} •••• ${last4}`;
}

/**
 * The typed `payment_method` wins when present. The gateway sends it as null
 * whenever the Portal omits `paymentMethod`, so null still falls back to the
 * compatibility `card`; a Link customer has `card: null`.
 */
export function paymentMethodLabel(
  billing: Pick<BillingStateResponse, "card" | "payment_method">,
): null | string {
  const method = billing.payment_method;
  if (!method) {
    return billing.card ? cardLabel(billing.card.brand, billing.card.last4) : null;
  }
  switch (method.kind) {
    case "card":
      return cardLabel(method.brand, method.last4) ?? method.brand;
    case "link":
      return method.email ? `Link · ${method.email}` : "Link";
    case "unknown":
      return method.raw_kind || EMPTY_VALUE;
  }
}

function autoReloadView(
  billing: BillingStateResponse,
  copy: AccountCopy,
): AutoReloadView {
  const auto = billing.auto_reload;
  const reloadTo = requestOrEmpty(auto?.reload_to_usd);
  const threshold = requestOrEmpty(auto?.threshold_usd);

  if (!auto) {
    return {
      description: copy.autoReload.offDescription,
      kind: "unavailable",
      caption: copy.autoReload.unavailable,
      reloadTo,
      threshold,
    };
  }
  if (!auto.enabled) {
    return {
      description: copy.autoReload.offDescription,
      kind: "off",
      reloadTo,
      threshold,
    };
  }
  const description = copy.autoReload.description(
    auto.reload_to_display || formatUsd(auto.reload_to_usd),
    auto.threshold_display || formatUsd(auto.threshold_usd),
  );
  if (auto.card?.kind === "distinct") {
    return {
      caption: copy.autoReload.distinctCard(
        cardLabel(auto.card.brand, auto.card.last4) ?? "—",
      ),
      description,
      kind: "distinct",
      reloadTo,
      threshold,
    };
  }
  return { description, kind: "on", reloadTo, threshold };
}

function requestOrEmpty(value: null | string | undefined): string {
  const amount = parseAmount(value);
  return amount != null && amount > 0 ? requestAmount(amount) : "";
}

function buyCreditsView(
  billing: BillingStateResponse,
  copy: AccountCopy,
): BuyCreditsView {
  const presets = billing.charge_presets.map((amount, index) => ({
    amount,
    label: billing.charge_presets_display[index] || formatUsd(amount),
  }));
  const disabledReason = !paymentMethodLabel(billing)
    ? copy.credits.noCard
    : !billing.is_admin
      ? copy.credits.notAdmin
      : !billing.cli_billing_enabled || !billing.can_charge
        ? copy.credits.disabled
        : undefined;
  return { disabledReason, enabled: !disabledReason, presets };
}

function usageRows(
  billing: BillingStateResponse,
  subscription: null | SubscriptionStateResponse,
  free: boolean,
  copy: AccountCopy,
): AccountUsageRow[] {
  const current = subscription?.current;
  const usage = subscription?.usage ?? billing.usage;
  const resetAt = formatAccountDate(
    current?.cycle_ends_at ?? usage?.renews_at,
    copy.locale,
  );
  const resets =
    resetAt !== EMPTY_VALUE ? copy.usage.resets(resetAt) : copy.usage.resetsNextCycle;

  if (free) {
    const balance = parseAmount(billing.balance_usd);
    return [
      {
        caption: resets,
        id: "allowance",
        title: copy.usage.allowance,
        value:
          balance != null && balance <= 0
            ? copy.usage.allowanceUsed
            : copy.usage.allowanceAvailable,
      },
    ];
  }

  const rows: AccountUsageRow[] = [];
  const remaining = parseAmount(current?.credits_remaining);
  const monthly = parseAmount(current?.monthly_credits);
  let subscriptionValue =
    usage?.subscription_remaining_display ??
    usage?.plan_bar?.remaining_display ??
    EMPTY_VALUE;
  let fraction: number | undefined;
  if (remaining != null && monthly != null) {
    // Remaining can dip below zero (usage settles after credits hit zero);
    // clamp to $0 and name the overage instead of printing "-$0.79 left".
    subscriptionValue =
      remaining < 0
        ? `${copy.usage.left(formatUsd(0), formatUsd(monthly))} · ${copy.usage.over(formatUsd(Math.abs(remaining)))}`
        : copy.usage.left(formatUsd(remaining), formatUsd(monthly));
    if (monthly > 0) fraction = clamp01(remaining / monthly);
  }
  rows.push({
    caption: resets,
    danger: fraction != null && fraction <= 0.1,
    fraction,
    id: "subscription_credits",
    title: copy.usage.subscriptionCredits,
    value: subscriptionValue,
  });

  rows.push({
    caption: copy.usage.neverExpire,
    id: "topup_credits",
    title: copy.usage.topupCredits,
    value:
      usage?.topup_remaining_display ??
      usage?.topup_bar?.remaining_display ??
      (billing.balance_display || formatUsd(billing.balance_usd)),
  });

  const cap = billing.monthly_cap;
  if (cap && cap.limit_usd != null) {
    const limit = parseAmount(cap.limit_usd);
    const spent = parseAmount(cap.spent_this_month_usd) ?? 0;
    const used = limit != null && limit > 0 ? clamp01(spent / limit) : undefined;
    rows.push({
      caption: cap.is_default_ceiling
        ? copy.usage.defaultCeiling
        : copy.usage.remoteSpending,
      danger: used != null && used >= 0.9,
      fraction: used,
      id: "monthly_cap",
      title: copy.usage.monthlyCap,
      value: copy.usage.capUsed(
        cap.spent_display || formatUsd(spent),
        cap.limit_display || formatUsd(limit),
      ),
    });
  }

  return rows;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function deriveAccountView(
  billingResult: BillingResult<BillingStateResponse> | undefined,
  subscriptionResult: BillingResult<SubscriptionStateResponse> | undefined,
  copy: AccountCopy,
): AccountView {
  if (!billingResult) return emptyView("loading");

  if (!billingResult.ok) {
    return emptyView("refusal", presentRefusal(billingResult.refusal, copy));
  }

  const billing = billingResult.data;
  const subscription = subscriptionResult?.ok ? subscriptionResult.data : null;
  const portalUrl =
    billing.portal_url ?? subscription?.portal_url ?? FALLBACK_PORTAL_URL;

  if (!billing.logged_in || subscription?.logged_in === false) {
    return {
      ...emptyView("logged_out", {
        action: { type: "portal", url: portalUrl },
        message: copy.status.loggedOutMessage,
        title: copy.status.loggedOutTitle,
      }),
      portalUrl,
      profileUrl: portalUrl,
    };
  }

  const current = subscription?.current;
  const free = isFreePlan(billing, subscription);
  const capable = plansCapable(subscription, subscriptionResult);
  const pending = pendingChange(current, copy.locale);
  const manageBase = subscription?.portal_url ?? billing.portal_url;

  const tiers: AccountTierView[] =
    capable && subscription
      ? classifyPlanTiers(
          subscription,
          pending?.kind === "downgrade" ? pending.tierName : null,
        ).map(({ state, tier }) => {
          const freeTile = isFreeCatalogTier(tier);
          return {
            credits: freeTile ? undefined : creditsLabel(tier.monthly_credits, copy),
            name: tier.name,
            price: freeTile ? "" : tier.dollars_per_month_display,
            state,
            tierId: tier.tier_id,
            upgradeUrl:
              state === "upgrade"
                ? buildManageSubscriptionUrl(subscription, manageBase, tier.tier_id)
                : undefined,
          };
        })
      : [];

  const renewal = formatAccountDate(
    current?.cycle_ends_at ?? billing.usage?.renews_at,
    copy.locale,
  );
  const caption = pending
    ? pending.kind === "downgrade"
      ? copy.plan.changesTo(pending.tierName, pending.when)
      : copy.plan.cancels(pending.when)
    : free
      ? renewal !== EMPTY_VALUE
        ? copy.plan.allowanceResets(renewal)
        : copy.plan.freeCaption
      : current
        ? copy.plan.renews(renewal)
        : copy.plan.noSubscription;

  const orgId = subscription?.org_id;
  const balance = free
    ? (() => {
        const amount = parseAmount(billing.balance_usd);
        if (amount == null) return copy.plan.free;
        return amount <= 0 ? copy.usage.allowanceUsed : copy.usage.allowanceAvailable;
      })()
    : billing.balance_display || formatUsd(billing.balance_usd);

  return {
    autoReload: autoReloadView(billing, copy),
    balance,
    bounds: { max_usd: billing.max_usd, min_usd: billing.min_usd },
    buy: buyCreditsView(billing, copy),
    notice: undefined,
    orgName: billing.org_name ?? subscription?.org_name ?? null,
    payment: {
      label: paymentMethodLabel(billing),
      url: billing.portal_url ?? FALLBACK_PORTAL_BILLING_URL,
    },
    plan: {
      caption,
      canChangeInApp: tiers.some(
        (tier) => tier.state === "upgrade" || tier.state === "downgrade",
      ),
      isFree: free,
      manageUrl: buildManageSubscriptionUrl(subscription, manageBase),
      name: free
        ? copy.plan.free
        : (current?.tier_name ?? billing.usage?.plan_name ?? copy.plan.free),
      pending,
      price: free
        ? undefined
        : findCurrentTier(subscription)?.dollars_per_month_display,
    },
    portalUrl,
    profileUrl: orgId
      ? `${portalOrigin(portalUrl)}/orgs/${encodeURIComponent(orgId)}/settings`
      : portalUrl,
    status: "normal",
    tiers,
    usage: usageRows(billing, subscription, free, copy),
  };
}
