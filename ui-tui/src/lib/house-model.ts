/** Free-plan house model: wire id is Gemini 3.8 Flash; chrome shows Operis. */

export const WORK4YOU_HOUSE_MODEL_ID = 'google/gemini-3.8-flash'
export const WORK4YOU_HOUSE_MODEL_DISPLAY = 'Operis 4.0 Flash'

export function isWork4YouHouseModel(model: string): boolean {
  const slug = model.trim().toLowerCase().split('/').pop() || ''

  return slug === 'gemini-3.8-flash' || slug === 'deepseek-v4-flash-0731'
}

/** Splash / status / picker label. Wire ids are unchanged. */
export function houseModelDisplayName(model: string): string {
  return isWork4YouHouseModel(model) ? WORK4YOU_HOUSE_MODEL_DISPLAY : model.split('/').pop() || model
}
