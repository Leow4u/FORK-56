/**
 * Free vs paid model access.
 * Plus/Super/Ultra unlock the official catalog; Free unlocks Operis only.
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
export const HOUSE_MODEL_ID = 'openai/gpt-5.6-luna'
export const HOUSE_MODEL_DISPLAY = 'Operis 4.0'

/** Official Work4You catalog — same as `_PROVIDER_MODELS["work4you"]`. */
export const OFFICIAL_WORK4YOU_MODEL_IDS: readonly string[] = [
  'openai/gpt-5.6-luna',
  'anthropic/claude-fable-5',
  'anthropic/claude-opus-5',
  'anthropic/claude-opus-4.8',
  'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4.5',
  'openai/gpt-5.6-sol',
  'openai/gpt-5.6-sol-pro',
  'openai/gpt-5.6-terra',
  'openai/gpt-5.6-terra-pro',
  'openai/gpt-5.6-luna-pro',
  'openai/gpt-5.5',
  'openai/gpt-5.5-pro',
  'openai/gpt-5.4-mini',
  'google/gemini-3.1-pro-preview',
  'google/gemini-3.7-flash',
  'x-ai/grok-4.6',
  'qwen/qwen3.8-max',
  'moonshotai/kimi-k3',
  'minimax/minimax-m3',
  'z-ai/glm-5.2',
  'z-ai/glm-5.1',
  'xiaomi/mimo-v2.5-pro',
  'tencent/hy3',
  'stepfun/step-3.7-flash',
  'nvidia/nemotron-3-super-120b-a12b',
  'sakana/fugu-ultra',
]

export const OFFICIAL_PAID_VISION_MODEL = 'google/gemini-3.7-flash'
export const OFFICIAL_PAID_COMPACTION_MODEL = 'openai/gpt-5.4-mini'

const HOUSE_MODEL_SLUGS = new Set([
  'gpt-5.6-luna',
  'gemini-3.8-flash',
  'deepseek-v4-flash-0731',
])

const CURATED_MODEL_DISPLAY: Record<string, string> = {
  'claude-fable-5': 'Claude Fable 5',
  'claude-opus-5': 'Claude Opus 5',
  'claude-opus-4.8': 'Claude Opus 4.8',
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-haiku-4.5': 'Claude Haiku 4.5',
  'gpt-5.6-sol': 'GPT-5.6 Sol',
  'gpt-5.6-sol-pro': 'GPT-5.6 Sol Pro',
  'gpt-5.6-terra': 'GPT-5.6 Terra',
  'gpt-5.6-terra-pro': 'GPT-5.6 Terra Pro',
  'gpt-5.6-luna-pro': 'GPT-5.6 Luna Pro',
  'gpt-5.5': 'GPT-5.5',
  'gpt-5.5-pro': 'GPT-5.5 Pro',
  'gpt-5.4-mini': 'GPT-5.4 Mini',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'gemini-3.7-flash': 'Gemini 3.7 Flash',
  'grok-4.6': 'Grok 4.6',
  'qwen3.8-max': 'Qwen 3.8 Max',
  'kimi-k3': 'Kimi K3',
  'minimax-m3': 'MiniMax M3',
  'glm-5.2': 'GLM 5.2',
  'glm-5.1': 'GLM 5.1',
  'mimo-v2.5-pro': 'MiMo 2.5 Pro',
  hy3: 'Hunyuan 3',
  'step-3.7-flash': 'Step 3.7 Flash',
  'nemotron-3-super-120b-a12b': 'Nemotron 3 Super',
  'fugu-ultra': 'Fugu Ultra',
}

export function isHouseModel(modelId: string): boolean {
  const slug = modelId.trim().toLowerCase().split('/').pop() || ''
  return HOUSE_MODEL_SLUGS.has(slug)
}

export function isOfficialWork4YouModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase()
  return OFFICIAL_WORK4YOU_MODEL_IDS.some((official) => official.toLowerCase() === id)
}

export function officialModelDisplayName(modelId: string): string {
  if (isHouseModel(modelId)) {
    return HOUSE_MODEL_DISPLAY
  }
  const slug = modelId.trim().toLowerCase().split('/').pop() || ''
  return CURATED_MODEL_DISPLAY[slug] || modelId
}

export function isAllowedOnFreePlan(
  modelId: string,
  _pricing?: ModelPricing | null,
): boolean {
  return isHouseModel(modelId)
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

/** Legacy $0 / :free detector — not the Free-plan unlock (Operis is). */
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
  let sawHouse = false
  for (const m of params.models) {
    if (!m?.id) continue
    const house = isHouseModel(m.id)
    if (house) {
      if (sawHouse) continue
      sawHouse = true
      out.push({
        id: HOUSE_MODEL_ID,
        name: HOUSE_MODEL_DISPLAY,
        free: false,
        locked: !params.paidPlan,
        pricing: m.pricing,
      })
      continue
    }
    out.push({
      id: m.id,
      name: m.name || m.id,
      free: false,
      locked: !params.paidPlan,
      pricing: m.pricing,
    })
  }
  // Unlocked first (Operis on Free); otherwise keep official catalog order.
  out.sort((a, b) => Number(a.locked) - Number(b.locked))
  return out
}

export function pickDefaultUnlocked(models: AnnotatedModel[]): string {
  const house = models.find((m) => isHouseModel(m.id) && !m.locked)
  if (house) return HOUSE_MODEL_ID
  const first = models.find((m) => !m.locked)
  return first?.id || HOUSE_MODEL_ID
}
