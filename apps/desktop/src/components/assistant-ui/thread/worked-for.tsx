import { type FC, type ReactNode } from 'react'

import { SCAFFOLD_LABEL_CLASS, ScaffoldRow } from '@/components/chat/scaffold-row'
import { FadeText } from '@/components/ui/fade-text'
import { useI18n } from '@/i18n'
import { workedForLabel } from '@/lib/turn-fold'
import { cn } from '@/lib/utils'

/**
 * The one line a settled Product turn leaves behind: the work diary sits
 * behind it, the answer and deliverable stay outside.
 */
export const WorkedForDisclosure: FC<{
  children?: ReactNode
  durationS?: number
  onToggle: () => void
  open: boolean
}> = ({ children, durationS, onToggle, open }) => {
  const { t } = useI18n()

  return (
    <div
      className="text-[length:var(--conversation-tool-font-size)] text-(--ui-text-tertiary)"
      data-conversation-scaffold=""
      data-slot="aui_worked-for"
    >
      <ScaffoldRow onToggle={onToggle} open={open}>
        <FadeText className={cn(SCAFFOLD_LABEL_CLASS, 'truncate')}>
          {workedForLabel(durationS, t.assistant.thread)}
        </FadeText>
      </ScaffoldRow>
      {open && children ? <div className="mt-0.5 grid min-w-0 max-w-full gap-(--tool-row-gap)">{children}</div> : null}
    </div>
  )
}
