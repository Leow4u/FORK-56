import type {
  BillingResult,
  BillingStateResponse,
  SubscriptionStateResponse,
  SubscriptionTierOption,
} from "@work4you/shared";

type Current = NonNullable<SubscriptionStateResponse["current"]>;

export const tierCatalog = (currentTierId: null | string): SubscriptionTierOption[] =>
  [
    { name: "Free", order: 0, price: "$0", credits: "0.1", id: "tier_free" },
    { name: "Plus", order: 1, price: "$20", credits: "22", id: "tier_plus" },
    { name: "Super", order: 2, price: "$100", credits: "110", id: "tier_super" },
  ].map((tier) => ({
    dollars_per_month_display: tier.price,
    is_current: tier.id === currentTierId,
    is_enabled: true,
    monthly_credits: tier.credits,
    name: tier.name,
    tier_id: tier.id,
    tier_order: tier.order,
  }));

export const paidCurrent = (overrides: Partial<Current> = {}): Current => ({
  cancel_at_period_end: false,
  cancellation_effective_at: null,
  cancellation_effective_display: null,
  credits_remaining: "11",
  cycle_ends_at: "2026-11-01T00:00:00Z",
  monthly_credits: "22",
  pending_downgrade_at: null,
  pending_downgrade_display: null,
  pending_downgrade_tier_name: null,
  tier_id: "tier_plus",
  tier_name: "Plus",
  ...overrides,
});

export const billingState = (
  overrides: Partial<BillingStateResponse> = {},
): BillingStateResponse => ({
  auto_reload: {
    card: { kind: "canonical" },
    enabled: true,
    reload_to_display: "$50",
    reload_to_usd: "50",
    threshold_display: "$10",
    threshold_usd: "10",
  },
  balance_display: "$42.50",
  balance_usd: "42.50",
  can_charge: true,
  card: { brand: "visa", last4: "4242", masked: "visa ....4242" },
  charge_presets: ["25", "50"],
  charge_presets_display: ["$25", "$50"],
  cli_billing_enabled: true,
  is_admin: true,
  logged_in: true,
  max_usd: "1000",
  min_usd: "10",
  monthly_cap: null,
  ok: true,
  org_name: "Acme",
  portal_url: "https://portal.work4you.ai/billing",
  role: "OWNER",
  ...overrides,
});

export const subscriptionState = (
  overrides: Partial<SubscriptionStateResponse> = {},
): SubscriptionStateResponse => ({
  can_change_plan: true,
  context: "personal",
  current: paidCurrent(),
  is_admin: true,
  logged_in: true,
  ok: true,
  org_id: "org_1",
  org_name: "Acme",
  portal_url: "https://portal.work4you.ai/billing",
  role: "OWNER",
  tiers: tierCatalog("tier_plus"),
  ...overrides,
});

export const freeSubscriptionState = (
  overrides: Partial<SubscriptionStateResponse> = {},
): SubscriptionStateResponse =>
  subscriptionState({ current: null, tiers: tierCatalog(null), ...overrides });

export const ok = <T>(data: T): BillingResult<T> => ({ data, ok: true });
