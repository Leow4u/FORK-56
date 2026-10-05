/** Free-plan house model: wire id is GPT-5.6 Luna; chrome shows Operis. */

export const WORK4YOU_HOUSE_MODEL_ID = 'openai/gpt-6-luna'
export const WORK4YOU_HOUSE_MODEL_DISPLAY = 'Operis 5.0'

const HOUSE_MODEL_SLUGS = new Set(['gpt-6-luna'])

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
  'claude-fable-5.1': 'Claude Fable 5.1',
  'claude-opus-5.5': 'Claude Opus 5.5',
  'claude-sonnet-5.5': 'Claude Sonnet 5.5',
  'gpt-6-astra': 'GPT-6 Astra',
  'gpt-6-astra-pro': 'GPT-6 Astra Pro',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-6.1-sol-pro': 'GPT-6.1 Sol Pro',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'grok-4.7': 'Grok 4.7',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'deepseek-v4.1-flash': 'DeepSeek V4.1 Flash',
  'qwen3.8-max-0902': 'Qwen 3.8 Max',
  'qwen3.8-flash': 'Qwen 3.8 Flash',
  'glm-5.3': 'GLM 5.3',
  'glm-5.3-flash': 'GLM 5.3 Flash',
  'mimo-v2.6-pro': 'MiMo 2.6 Pro',
  'mimo-v2.6-flash': 'MiMo 2.6 Flash'
}

const CURATED_VARIANT_SUFFIXES = ['-fast', '-thinking', '-latest'] as const

function curatedModelDisplay(model: string): string | undefined {
  const slug = model.trim().toLowerCase().split('/').pop() || ''

  if (!slug) {
    return undefined
  }

  if (CURATED_MODEL_DISPLAY[slug]) {
    return CURATED_MODEL_DISPLAY[slug]
  }

  for (const suffix of CURATED_VARIANT_SUFFIXES) {
    if (slug.endsWith(suffix)) {
      return CURATED_MODEL_DISPLAY[slug.slice(0, -suffix.length)]
    }
  }

  return undefined
}

export function isWork4YouHouseModel(model: string): boolean {
  const slug = model.trim().toLowerCase().split('/').pop() || ''

  return HOUSE_MODEL_SLUGS.has(slug)
}

/** Splash / status / picker label. Wire ids are unchanged. */
export function houseModelDisplayName(model: string): string {
  if (isWork4YouHouseModel(model)) {
    return WORK4YOU_HOUSE_MODEL_DISPLAY
  }

  return curatedModelDisplay(model) || model.split('/').pop() || model
}
