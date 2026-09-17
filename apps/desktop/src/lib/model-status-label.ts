import { DEFAULT_REASONING_EFFORT, reasoningEffortLabel } from '@/lib/reasoning-effort'

/** Which model/provider pair a picker should mark "current". SessionView state
 *  also drives the composer label, so a complete pair there wins over an older
 *  `model.options` response. During initial hydration (or pre-session startup),
 *  options remain the fallback. Pick one complete pair before mixing fields so
 *  a model is never shown under a different provider. */
export function currentPickerSelection(
  store: { model: string; provider: string },
  options?: { model?: string; provider?: string }
): { model: string; provider: string } {
  const storeSelection = {
    model: String(store.model || ''),
    provider: String(store.provider || '')
  }

  const optionsSelection = {
    model: String(options?.model || ''),
    provider: String(options?.provider || '')
  }

  if (storeSelection.model && storeSelection.provider) {
    return storeSelection
  }

  if (optionsSelection.model && optionsSelection.provider) {
    return optionsSelection
  }

  return {
    model: storeSelection.model || optionsSelection.model,
    provider: storeSelection.provider || optionsSelection.provider
  }
}

export const WORK4YOU_HOUSE_MODEL_ID = 'openai/gpt-5.6-luna'
export const WORK4YOU_HOUSE_MODEL_DISPLAY = 'Operis 4.0'

const HOUSE_MODEL_SLUGS = new Set(['gpt-5.6-luna', 'gemini-3.8-flash', 'deepseek-v4-flash-0731'])

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
  'fugu-ultra': 'Fugu Ultra'
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

/** Strip provider prefix and normalize for display. */
export function modelBaseId(model: string): string {
  const trimmed = model.trim()
  const slash = trimmed.lastIndexOf('/')

  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed
}

// Trailing model-id variants that should render as a grayed tag beside the
// name (e.g. "Opus 4.8" + "Fast") rather than collapsing two distinct ids to
// the same display name.
const VARIANT_TAGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/-fast$/i, 'Fast'],
  [/-thinking$/i, 'Thinking'],
  [/-preview$/i, 'Preview'],
  [/-latest$/i, 'Latest']
]

const titleCase = (text: string): string => text.replace(/\b\w/g, char => char.toUpperCase()).trim()

function prettifyBase(base: string): string {
  if (/^claude-/i.test(base)) {
    return titleCase(base.replace(/^claude-/i, '').replace(/-/g, ' '))
  }

  if (/^gpt-/i.test(base)) {
    return base.replace(/^gpt-/i, 'GPT-')
  }

  if (/^gemini-/i.test(base)) {
    return base.replace(/^gemini-/i, 'Gemini ').replace(/-/g, ' ')
  }

  return titleCase(base.replace(/-/g, ' '))
}

/** Split a model id into a clean display name plus an optional grayed variant
 *  tag, so distinct ids (e.g. `…-4.8` vs `…-4.8-fast`) don't collapse. */
export function modelDisplayParts(model: string): { name: string; tag: string } {
  if (isWork4YouHouseModel(model)) {
    return { name: WORK4YOU_HOUSE_MODEL_DISPLAY, tag: '' }
  }

  const curated = curatedModelDisplay(model)

  if (curated) {
    return { name: curated, tag: '' }
  }

  let base = modelBaseId(model)
  let tag = ''

  for (const [pattern, label] of VARIANT_TAGS) {
    if (pattern.test(base)) {
      tag = label
      base = base.replace(pattern, '')

      break
    }
  }

  // Drop a trailing date-pin (`…-20251101`) — snapshot noise, not a name.
  base = base.replace(/-\d{8}$/, '')

  return { name: prettifyBase(base) || model.trim() || 'No model', tag }
}

/** Friendly one-line model name for menus and the status bar. */
export function displayModelName(model: string): string {
  return modelDisplayParts(model).name
}

/** Status bar trigger label — model name plus the live session state (effort/fast).
 *  `defaultEffort` is the profile's configured level, used when the surface has
 *  no explicit effort so the label never advertises a default the agent won't use. */
export function formatModelStatusLabel(
  model: string,
  options?: { defaultEffort?: string; fastMode?: boolean; reasoningEffort?: string }
): string {
  const name = displayModelName(model)

  if (!model.trim()) {
    return name
  }

  const parts: string[] = []

  // Fast is shown when the speed=fast param is on (options.fastMode) OR the
  // active model is a `…-fast` variant (fast via a separate model id).
  if (options?.fastMode || /-fast$/i.test(modelBaseId(model))) {
    parts.push('Fast')
  }

  // Always surface the effort so the current reasoning level is visible at a
  // glance, not just when non-default.
  parts.push(reasoningEffortLabel(options?.reasoningEffort || options?.defaultEffort || DEFAULT_REASONING_EFFORT))

  return `${name} · ${parts.join(' ')}`
}
