import { isWork4YouHouseModel } from '@/lib/model-status-label'

export type ChatModelMark = 'claude' | 'gemini' | 'grok' | 'openai' | 'qwen' | 'work4you'

const PRODUCT_MARKS: ReadonlyArray<readonly [RegExp, ChatModelMark]> = [
  [/claude/, 'claude'],
  [/gpt-|openai|chatgpt/, 'openai'],
  [/gemini/, 'gemini'],
  [/grok/, 'grok'],
  [/qwen/, 'qwen']
]

/** Product mark for a chat-model row. Operis stays the Work4You mark. */
export function resolveChatModelMark(id: string, label: string): ChatModelMark | null {
  if (isWork4YouHouseModel(id) || /\boperis\b/i.test(`${id} ${label}`)) {
    return 'work4you'
  }

  const haystack = `${id} ${label}`.toLowerCase()

  for (const [pattern, mark] of PRODUCT_MARKS) {
    if (pattern.test(haystack)) {
      return mark
    }
  }

  return null
}
