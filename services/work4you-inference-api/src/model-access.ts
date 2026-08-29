/** Free vs paid model gate (Hermes binary: Free plan → free models + house). */

export type ModelPricing = { prompt?: string; completion?: string }

/** Billed house model on Free. Ceiling is existing NAS authorize/debit. */
export const HOUSE_MODEL_ID = 'deepseek/deepseek-v4-flash-0731'
export const HOUSE_MODEL_DISPLAY = 'Operis 4.0 Flash'

export function isHouseModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase()
  return id === HOUSE_MODEL_ID || id.endsWith('/deepseek-v4-flash-0731')
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
  pricing?: ModelPricing | null,
): boolean {
  return isHouseModel(modelId) || isModelFreeForPlan(modelId, pricing)
}
