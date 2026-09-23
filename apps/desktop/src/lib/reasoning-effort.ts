import { normalize } from '@/lib/text'

/** Work4You' reasoning levels, in ascending order — mirrors the backend's
 *  VALID_REASONING_EFFORTS (work4you_constants.py). `none` is not a level: it's
 *  thinking disabled, owned by the Thinking toggle rather than the scale. */
export const REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number]

/** The scale plus the off state — the full set a config value may hold. */
export const REASONING_EFFORT_VALUES = ['none', ...REASONING_EFFORTS] as const

/** Work4You' built-in level when neither the surface nor the profile config
 *  specifies one (mirrors the backend's own fallback). */
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'medium'

/** Compact labels for chrome where space is tight (pill, picker rows). Menus
 *  and settings use the translated `shell.modelOptions` strings instead. */
const SHORT_LABELS: Record<string, string> = {
  none: 'Off',
  minimal: 'Min',
  low: 'Low',
  medium: 'Med',
  high: 'High',
  xhigh: 'XHigh',
  max: 'Max',
  ultra: 'Ultra'
}

export function reasoningEffortLabel(effort: string): string {
  const key = normalize(effort)

  return key ? (SHORT_LABELS[key] ?? effort) : ''
}

export const isReasoningEffort = (value: string): value is ReasoningEffort =>
  REASONING_EFFORTS.includes(normalize(value) as ReasoningEffort)

/** Thinking is on unless a level explicitly says otherwise; an empty value
 *  means "inherit", so it resolves through `fallback` first. */
export const isThinkingEnabled = (effort: string, fallback: string = DEFAULT_REASONING_EFFORT): boolean =>
  normalize(effort || fallback) !== 'none'

/** The level a scale control should show. Empty inherits `fallback`; `none`
 *  (thinking off) selects nothing; anything unrecognized clamps to the default. */
export function resolveReasoningEffort(effort: string, fallback: string = DEFAULT_REASONING_EFFORT): string {
  const value = normalize(effort || fallback)

  if (value === 'none') {
    return ''
  }

  return isReasoningEffort(value) ? value : DEFAULT_REASONING_EFFORT
}

/** The four-step dial. Minimal and Ultra stay valid stored values — they alias
 *  Low and the model's ceiling — but they are not separate menu choices. */
export const MENU_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const

export type MenuReasoningEffort = (typeof MENU_REASONING_EFFORTS)[number] | 'max'

/** Claude's Messages API has a real `max` above Extra High. Other models do not
 *  get that fifth choice; Max and Ultra already clamp to their ceiling. */
export function claudeReasoningModel(model: string): boolean {
  return normalize(model).includes('claude')
}

export function visibleReasoningEfforts(model: string): readonly MenuReasoningEffort[] {
  return claudeReasoningModel(model) ? [...MENU_REASONING_EFFORTS, 'max'] : [...MENU_REASONING_EFFORTS]
}

/** Map a stored level onto a choice the menu lists. `none` stays off. Minimal
 *  reads as Low. On Claude, Max and Ultra read as Max. Elsewhere they read as
 *  Extra High. The stored value is left alone until the user picks a level. */
export function menuReasoningEffort(
  effort: string,
  model: string,
  fallback: string = DEFAULT_REASONING_EFFORT
): ReasoningEffort | 'none' {
  const value = normalize(effort || fallback)

  if (value === 'none' || value === 'false' || value === 'disabled') {
    return 'none'
  }

  if (value === 'minimal') {
    return 'low'
  }

  if (value === 'max' || value === 'ultra') {
    return claudeReasoningModel(model) ? 'max' : 'xhigh'
  }

  if (value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh') {
    return value
  }

  return DEFAULT_REASONING_EFFORT
}
