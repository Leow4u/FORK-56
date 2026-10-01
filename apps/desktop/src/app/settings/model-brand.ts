import { type ModelBrand } from './model-brand-paths'

// First match wins. More specific names stay above the company they belong to.
const MODEL_BRAND_RULES: ReadonlyArray<readonly [RegExp, ModelBrand]> = [
  [/grok/, 'grok'],
  [/gpt[- ]?image|\bopenai\b/, 'openai'],
  [/nano[- ]?banana|\bgemini\b/, 'gemini'],
  [/\bveo\b/, 'deepmind'],
  [/\bflux\b/, 'flux'],
  [/ideogram/, 'ideogram'],
  [/recraft/, 'recraft'],
  [/\bkrea\b/, 'krea'],
  [/qwen/, 'qwen'],
  [/z[- ]?image|happy[- ]?horse/, 'alibaba'],
  [/seedance|seedream/, 'bytedance'],
  [/\bmai\b|\bmicrosoft\b/, 'microsoft'],
  [/\bltx\b|lightricks/, 'lightricks'],
  [/pixverse/, 'pixverse'],
  [/minimax/, 'minimax'],
  [/kling/, 'kling']
]

/** Brand mark for an image or video catalog row, from the model id and label. */
export function resolveModelBrand(id: string, display: string): ModelBrand | null {
  const haystack = `${id} ${display}`.toLowerCase()

  for (const [pattern, brand] of MODEL_BRAND_RULES) {
    if (pattern.test(haystack)) {
      return brand
    }
  }

  return null
}
