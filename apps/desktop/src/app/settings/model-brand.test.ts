import { describe, expect, it } from 'vitest'

import { resolveModelBrand } from './model-brand'
import { MODEL_BRAND_PATHS, MODEL_BRANDS } from './model-brand-paths'

describe('resolveModelBrand', () => {
  it('maps each shipped image and video family to the brand that makes it', () => {
    expect(resolveModelBrand('fal-ai/flux-2-pro', 'FLUX 2 Pro')).toBe('flux')
    expect(resolveModelBrand('fal-ai/nano-banana-2', 'Nano Banana 2 (Gemini 3.1 Flash Image)')).toBe('gemini')
    expect(resolveModelBrand('fal-ai/gpt-image-2', 'GPT Image 2')).toBe('openai')
    expect(resolveModelBrand('fal-ai/ideogram/v3', 'Ideogram V3')).toBe('ideogram')
    expect(resolveModelBrand('fal-ai/recraft/v4/pro/text-to-image', 'Recraft V4 Pro')).toBe('recraft')
    expect(resolveModelBrand('fal-ai/krea/v2/medium/text-to-image', 'Krea 2 Medium')).toBe('krea')
    expect(resolveModelBrand('fal-ai/qwen-image', 'Qwen Image')).toBe('qwen')
    expect(resolveModelBrand('fal-ai/z-image/turbo', 'Z-Image Turbo')).toBe('alibaba')
    expect(resolveModelBrand('bytedance/seedream/v5/pro/text-to-image', 'Seedream 5.0 Pro')).toBe('bytedance')
    expect(resolveModelBrand('microsoft/mai-image-2.5-pro', 'MAI Image 2.5 Pro')).toBe('microsoft')
    expect(resolveModelBrand('xai/grok-imagine-image/v2.0/text-to-image', 'Grok Imagine Image 2.0')).toBe('grok')
    expect(resolveModelBrand('veo3.1', 'Veo 3.1')).toBe('deepmind')
    expect(resolveModelBrand('seedance-2.0', 'Seedance 2.0')).toBe('bytedance')
    expect(resolveModelBrand('minimax-h3', 'MiniMax H3')).toBe('minimax')
    expect(resolveModelBrand('ltx-2.3', 'LTX 2.3 (22B)')).toBe('lightricks')
    expect(resolveModelBrand('pixverse-v6', 'Pixverse v6')).toBe('pixverse')
    expect(resolveModelBrand('kling-v3-4k', 'Kling v3 4K')).toBe('kling')
    expect(resolveModelBrand('happy-horse', 'Happy Horse 1.0')).toBe('alibaba')
    expect(resolveModelBrand('flux-3', 'FLUX 3 (via FAL)')).toBe('flux')
    expect(resolveModelBrand('gemini-omni-flash', 'Gemini Omni Flash (via FAL)')).toBe('gemini')
  })

  it('leaves an unknown model without a brand so the row can fall back', () => {
    expect(resolveModelBrand('custom/new-model', 'Some Future Model')).toBeNull()
  })

  it('has a drawn mark for every brand the resolver can return', () => {
    for (const brand of MODEL_BRANDS) {
      expect(MODEL_BRAND_PATHS[brand].length).toBeGreaterThan(0)
      expect(MODEL_BRAND_PATHS[brand].every(path => path.length > 0)).toBe(true)
    }
  })
})