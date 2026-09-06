/** Free-plan house model: wire id stays DeepSeek; chrome shows Operis. */

export const WORK4YOU_HOUSE_MODEL_ID = 'deepseek/deepseek-v4-flash-0731'
export const WORK4YOU_HOUSE_MODEL_DISPLAY = 'Operis 4.0 Flash'

export function isWork4YouHouseModel(model: string): boolean {
  const id = model.trim().toLowerCase()

  return id === 'deepseek-v4-flash-0731' || id.endsWith('/deepseek-v4-flash-0731')
}

/** Splash / status / picker label. Wire ids are unchanged. */
export function houseModelDisplayName(model: string): string {
  return isWork4YouHouseModel(model) ? WORK4YOU_HOUSE_MODEL_DISPLAY : model.split('/').pop() || model
}
