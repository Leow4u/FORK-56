/**
 * Free vs paid model access (Hermes-style binary gate).
 * Plus/Super/Ultra all unlock the full catalog; Free locks paid models
 * except the billed house model (Operis).
 */
import type { Org } from '@prisma/client'
import { getTier } from './tiers'

export type ModelPricing = { prompt?: string; completion?: string }

export type AnnotatedModel = {
  id: string
  name: string
  free: boolean
  locked: boolean
  pricing?: ModelPricing
}

/** Billed house model on Free. Ceiling is existing NAS authorize/debit. */
export const HOUSE_MODEL_ID = 'deepseek/deepseek-v4-flash-0731'
export const HOUSE_MODEL_DISPLAY = 'Operis 4.0 Flash'

export function isHouseModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase()
  return id === HOUSE_MODEL_ID || id.endsWith('/deepseek-v4-flash-0731')
}

export function isAllowedOnFreePlan(
  modelId: string,
  pricing?: ModelPricing | null,
): boolean {
  return isHouseModel(modelId) || isModelFreeForPlan(modelId, pricing)
}

/** Paid subscription (Plus/Super/Ultra) — not the Free plan. */
export function orgHasPaidPlan(org: Org): boolean {
  const tier = getTier(org.subscriptionTierId || 'free')
  return tier.tierId !== 'free'
}

export function isZeroPrice(pricing: ModelPricing | null | undefined): boolean {
  if (!pricing) return false
  const p = Number(pricing.prompt ?? NaN)
  const c = Number(pricing.completion ?? NaN)
  return Number.isFinite(p) && Number.isFinite(c) && p === 0 && c === 0
}

/** Free for Free-plan users: :free suffix or zero prompt+completion price. */
export function isModelFreeForPlan(
  modelId: string,
  pricing?: ModelPricing | null,
): boolean {
  const id = modelId.toLowerCase()
  if (id.includes(':free') || id.endsWith('/free')) return true
  return isZeroPrice(pricing || undefined)
}

export function annotateModels(params: {
  models: Array<{ id: string; name?: string; pricing?: ModelPricing }>
  paidPlan: boolean
}): AnnotatedModel[] {
  const out: AnnotatedModel[] = []
  for (const m of params.models) {
    if (!m?.id) continue
    const house = isHouseModel(m.id)
    const free = isModelFreeForPlan(m.id, m.pricing)
    out.push({
      id: m.id,
      name: house ? HOUSE_MODEL_DISPLAY : m.name || m.id,
      free,
      locked: !params.paidPlan && !free && !house,
      pricing: m.pricing,
    })
  }
  // Unlocked first, then locked; within each group prefer free / stable ids.
  out.sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? 1 : -1
    if (a.free !== b.free) return a.free ? -1 : 1
    return a.id.localeCompare(b.id)
  })
  return out
}

export function pickDefaultUnlocked(models: AnnotatedModel[]): string {
  const preferred = [
    HOUSE_MODEL_ID,
    'openrouter/free',
    'openai/gpt-4o-mini',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-chat',
    'deepseek/deepseek-v4-flash',
  ]
  for (const id of preferred) {
    const hit = models.find((m) => m.id === id && !m.locked)
    if (hit) return hit.id
  }
  const first = models.find((m) => !m.locked)
  return first?.id || 'openrouter/free'
}
