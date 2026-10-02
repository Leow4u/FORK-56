/** Free vs paid model gate: Free plan → Operis only. */

export type ModelPricing = { prompt?: string; completion?: string }

/** Billed house model on Free. Ceiling is existing NAS authorize/debit. */
export const HOUSE_MODEL_ID = 'openai/gpt-6-luna'
export const HOUSE_MODEL_DISPLAY = 'Operis 5.0'

const HOUSE_MODEL_SLUGS = new Set(['gpt-6-luna'])

/**
 * Retired house wire ids (Operis 4.0 ran on GPT-5.6 Luna). Clients that have
 * not picked up the move still send these for "Operis"; the billing gate
 * rewrites them to HOUSE_MODEL_ID before forwarding, so a Free org keeps its
 * house model instead of a `paid_plan_required` 403 for a retired id.
 */
const LEGACY_HOUSE_MODEL_SLUGS = new Set(['gpt-5.6-luna'])

function houseModelSlug(modelId: string): string {
  return modelId.trim().toLowerCase().split('/').pop() || ''
}

export function isLegacyHouseModel(modelId: string): boolean {
  return LEGACY_HOUSE_MODEL_SLUGS.has(houseModelSlug(modelId))
}

/** Current or retired Operis wire id — both resolve to HOUSE_MODEL_ID. */
export function isHouseModel(modelId: string): boolean {
  const slug = houseModelSlug(modelId)
  return HOUSE_MODEL_SLUGS.has(slug) || LEGACY_HOUSE_MODEL_SLUGS.has(slug)
}

export function isZeroPrice(pricing: ModelPricing | null | undefined): boolean {
  if (!pricing) return false
  const p = Number(pricing.prompt ?? NaN)
  const c = Number(pricing.completion ?? NaN)
  return Number.isFinite(p) && Number.isFinite(c) && p === 0 && c === 0
}

export function isModelFreeForPlan(
  modelId: string,
  pricing?: ModelPricing | null,
): boolean {
  const id = modelId.toLowerCase()
  if (id.includes(':free') || id.endsWith('/free')) return true
  return isZeroPrice(pricing || undefined)
}

export function isAllowedOnFreePlan(
  modelId: string,
  _pricing?: ModelPricing | null,
): boolean {
  return isHouseModel(modelId)
}
