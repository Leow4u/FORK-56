import { SiClaude, SiGooglegemini } from '@icons-pack/react-simple-icons'

import { BrandMark } from '@/components/brand-mark'

import { resolveChatModelMark } from './chat-model-mark'
import { ModelBrandLogo } from './model-brand-logo'

export function ChatModelMarkIcon({ id, label }: { id: string; label: string }) {
  const mark = resolveChatModelMark(id, label)

  if (!mark) {
    return null
  }

  return (
    <span aria-hidden className="grid size-4 shrink-0 place-items-center" data-mark={mark}>
      {mark === 'work4you' ? (
        <BrandMark className="size-4" />
      ) : mark === 'claude' ? (
        <SiClaude className="size-4" color="#D97757" title="" />
      ) : mark === 'gemini' ? (
        <SiGooglegemini className="size-4" color="#8E75B2" title="" />
      ) : (
        <ModelBrandLogo brand={mark} className="size-4" />
      )}
    </span>
  )
}
