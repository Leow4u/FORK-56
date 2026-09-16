/** Free-plan house model: wire id is GPT-5.6 Luna; chrome shows Operis. */

export const WORK4YOU_HOUSE_MODEL_ID = 'openai/gpt-5.6-luna'
export const WORK4YOU_HOUSE_MODEL_DISPLAY = 'Operis 4.0'

const HOUSE_MODEL_SLUGS = new Set([
  'gpt-5.6-luna',
  'gemini-3.8-flash',
  'deepseek-v4-flash-0731',
])

export function isWork4YouHouseModel(model: string): boolean {
  const slug = model.trim().toLowerCase().split('/').pop() || ''

  return HOUSE_MODEL_SLUGS.has(slug)
}

/** Splash / status / picker label. Wire ids are unchanged. */
export function houseModelDisplayName(model: string): string {
  return isWork4YouHouseModel(model) ? WORK4YOU_HOUSE_MODEL_DISPLAY : model.split('/').pop() || model
}
