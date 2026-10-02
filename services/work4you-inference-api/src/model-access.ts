/** Free vs paid model gate: Free plan → Operis only. */

export type ModelPricing = { prompt?: string; completion?: string }

/** Billed house model on Free. Ceiling is existing NAS authorize/debit. */
export const HOUSE_MODEL_ID = 'openai/gpt-6-luna'
export const HOUSE_MODEL_DISPLAY = 'Operis 5.0'

/**
 * Only the current Operis wire id unlocks on Free. Retired house ids
 * (openai/gpt-5.6-luna, Operis 4.0) are ordinary paid-catalog ids here; the
 * client canonicalizes a persisted retired id to HOUSE_MODEL_ID before it
 * reaches the wire (work4you_cli.models.canonical_work4you_house_model_id).
 */
const HOUSE_MODEL_SLUGS = new Set(['gpt-6-luna'])

export function isHouseModel(modelId: string): boolean {
  const slug = modelId.trim().toLowerCase().split('/').pop() || ''
  return HOUSE_MODEL_SLUGS.has(slug)
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
