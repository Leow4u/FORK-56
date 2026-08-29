import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const HOUSE_MODEL_ID = 'deepseek/deepseek-v4-flash-0731'
const HOUSE_MODEL_DISPLAY = 'Operis 4.0 Flash'

/**
 * GET /api/work4you/recommended-models
 * Public catalog hints for CLI/Desktop free vs paid pickers (Hermes shape).
 * Live free set is still priced via inference /v1/models; this list is curated.
 */
export async function GET() {
  const now = new Date().toISOString()
  const freeRecommendedModels = [
    HOUSE_MODEL_ID,
    'openrouter/free',
    'deepseek/deepseek-chat:free',
    'google/gemma-3-27b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
  ].map((modelName, position) => ({
    modelName,
    displayName: modelName === HOUSE_MODEL_ID ? HOUSE_MODEL_DISPLAY : modelName,
    source: 'local',
    href: null,
    tokenPrice: modelName === HOUSE_MODEL_ID ? null : '$0.00/1M',
    contextLength: null,
    inputModalities: [] as string[],
    outputModalities: [] as string[],
    position,
    isVisionModel: false,
    isCompactionModel: false,
    updatedAt: now,
  }))

  const paidRecommendedModels = [
    'openai/gpt-4o-mini',
    'google/gemini-2.5-flash',
    'anthropic/claude-sonnet-4',
    'deepseek/deepseek-chat',
    'deepseek/deepseek-v4-flash',
    HOUSE_MODEL_ID,
    ...freeRecommendedModels
      .map((m) => m.modelName)
      .filter((id) => id !== HOUSE_MODEL_ID),
  ].map((modelName, position) => ({
    modelName,
    displayName: modelName === HOUSE_MODEL_ID ? HOUSE_MODEL_DISPLAY : modelName,
    source: 'local',
    href: null,
    tokenPrice: null as string | null,
    contextLength: null,
    inputModalities: [] as string[],
    outputModalities: [] as string[],
    position,
    isVisionModel: false,
    isCompactionModel: false,
    updatedAt: now,
  }))

  return NextResponse.json({
    paidRecommendedModels,
    freeRecommendedModels,
    paidRecommendedVisionModel: paidRecommendedModels[1] || null,
    paidRecommendedCompactionModel: paidRecommendedModels[0] || null,
    freeRecommendedVisionModel: freeRecommendedModels[0] || null,
    freeRecommendedCompactionModel: freeRecommendedModels[0] || null,
  })
}
