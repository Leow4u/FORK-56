/**
 * Copy-free plan selectors over the Remote Spending wire shapes.
 *
 * Which tier is current, whether the account is on Free, whether it may change
 * plans in-app, and how each catalog tier relates to the current one. Every
 * surface renders its own copy on top of these verdicts, so the rules live in
 * one place instead of drifting between the desktop and the web dashboard.
 */
import type { BillingResult } from './billing-client'
import type { BillingStateResponse, SubscriptionStateResponse, SubscriptionTierOption } from './billing-types'

export const FALLBACK_PORTAL_URL = 'https://portal.work4you.ai'
export const FALLBACK_PORTAL_BILLING_URL = 'https://portal.work4you.ai/billing'

type SubscriptionCurrent = NonNullable<SubscriptionStateResponse['current']>

export function isFreeCatalogTier(tier: { name?: string; tier_id?: string }): boolean {
  return (tier.name || '').trim().toLowerCase() === 'free' || (tier.tier_id || '').trim().toLowerCase() === 'free'
}

function isPaidSubscriptionCurrent(current: null | SubscriptionCurrent | undefined): boolean {
  if (!current?.tier_id || current.tier_id === 'free') {
    return false
  }

  return (current.tier_name || '').trim().toLowerCase() !== 'free'
}

/**
 * The active tier from the UNFILTERED catalog — a grandfathered current tier is
 * is_enabled:false, so it must still resolve here (by is_current or matching id).
 * A Free account (`current: null`) may only resolve to a Free catalog tile —
 * never a stale `is_current` on a paid tier, and never the cheapest paid tier.
 */
export function findCurrentTier(subscription: null | SubscriptionStateResponse): SubscriptionTierOption | undefined {
  const current = subscription?.current
  const tiers = subscription?.tiers

  if (!tiers?.length) {
    return undefined
  }

  if (!isPaidSubscriptionCurrent(current)) {
    return tiers.find(isFreeCatalogTier)
  }

  return tiers.find(tier => tier.is_current || tier.tier_id === current?.tier_id)
}

export function isFreePlan(
  billing: Pick<BillingStateResponse, 'usage'>,
  subscription: null | SubscriptionStateResponse
): boolean {
  const current = subscription?.current

  if (current?.tier_id && current.tier_id !== 'free') {
    return false
  }

  const plan = (current?.tier_name ?? billing.usage?.plan_name ?? '').trim().toLowerCase()

  if (plan && plan !== 'free') {
    return false
  }

  if (current?.tier_id === 'free' || plan === 'free') {
    return true
  }

  // NAS Free: subscription payload loaded with current: null.
  return subscription != null && current == null
}

/**
 * Whether this account can change plans in-app: a personal (non-team)
 * subscription the server says the user can change, whose payload loaded.
 */
export function plansCapable(
  subscription: null | SubscriptionStateResponse,
  subscriptionResult: BillingResult<SubscriptionStateResponse> | undefined
): boolean {
  if (!subscription || (subscriptionResult && !subscriptionResult.ok)) {
    return false
  }

  return subscription.context !== 'team' && Boolean(subscription.can_change_plan)
}

export function buildManageSubscriptionUrl(
  subscription?: null | Pick<SubscriptionStateResponse, 'org_id' | 'portal_url'>,
  fallbackPortalUrl?: null | string,
  // Optional tier to pre-select on the portal, appended as `plan=<tierId>`.
  tierId?: null | string
): string {
  // The hard-coded portal is the LAST-RESORT origin, not a bare early return:
  // org_id / plan must still be applied to it so a null portal_url never silently
  // strips the params that route the user to the right org + pre-selected tier.
  const portalUrls = [subscription?.portal_url, fallbackPortalUrl, FALLBACK_PORTAL_BILLING_URL].filter(
    (url): url is string => typeof url === 'string' && url.length > 0
  )

  for (const portalUrl of portalUrls) {
    try {
      const url = new URL('/manage-subscription', new URL(portalUrl).origin)

      if (subscription?.org_id) {
        url.searchParams.set('org_id', subscription.org_id)
      }

      if (tierId) {
        url.searchParams.set('plan', tierId)
      }

      return url.toString()
    } catch {
      // Try the next candidate; malformed portal URLs should not break settings.
    }
  }

  return FALLBACK_PORTAL_BILLING_URL
}

export type PlanTierState = 'current' | 'downgrade' | 'scheduled' | 'upgrade'

export interface ClassifiedPlanTier {
  state: PlanTierState
  tier: SubscriptionTierOption
}

/**
 * The plans-grid catalog, low→high: the enabled catalog plus the grandfathered
 * current tier. Each tier's state follows its order relative to the current one:
 * current = inert, lower = an in-app chargeless downgrade, higher = an upgrade.
 * The already-scheduled downgrade target (matched by name — NAS sends no id for
 * it, and SubscriptionTypes.name is unique) is `scheduled`. With no paid
 * subscription only a Free tile may stand in as current, so a catalog that
 * omits Free makes every paid tile an upgrade.
 */
export function classifyPlanTiers(
  subscription: SubscriptionStateResponse,
  pendingDowngradeTierName?: null | string
): ClassifiedPlanTier[] {
  const currentTier = findCurrentTier(subscription)
  const currentOrder = currentTier?.tier_order

  return (subscription.tiers ?? [])
    .filter(tier => tier.is_enabled || tier.tier_id === currentTier?.tier_id)
    .slice()
    .sort((a, b) => a.tier_order - b.tier_order)
    .map((tier): ClassifiedPlanTier => {
      if (currentTier && tier.tier_id === currentTier.tier_id) {
        return { state: 'current', tier }
      }

      if (pendingDowngradeTierName && tier.name === pendingDowngradeTierName) {
        return { state: 'scheduled', tier }
      }

      if (currentOrder != null && tier.tier_order < currentOrder) {
        return { state: 'downgrade', tier }
      }

      return { state: 'upgrade', tier }
    })
}
