import { useMessageError } from '@assistant-ui/core/react'
import { useId } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button'
import { Codicon } from '@/components/ui/codicon'
import { ErrorIcon } from '@/components/ui/error-state'
import { LogView } from '@/components/ui/log-view'
import { useI18n } from '@/i18n'
import { chatErrorDescription } from '@/lib/chat-error-presentation'

/** One presentation for failed replies, including restored and tiled chats.
 * The runtime keeps the original error; only its visible explanation is localized. */
export function MessageError({ onDismiss }: { onDismiss?: () => void }) {
  const error = useMessageError()
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()

  if (error === undefined) {
    return null
  }

  const raw = typeof error === 'string' ? error : String(error)
  const copy = t.assistant.thread.errorCard

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="mt-3 min-w-0 overflow-hidden rounded-(--card-radius) border border-(--ui-stroke-tertiary) text-sm leading-5 text-(--ui-text-primary)"
      data-slot="chat-error-card"
      role="alert"
    >
      <div className="flex items-start gap-2.5 bg-(--ui-bg-quaternary) px-3.5 py-2.5">
        <ErrorIcon className="mt-0.5 shrink-0" size="1rem" />
        <h3 className="min-w-0 flex-1 wrap-anywhere font-medium" id={titleId}>
          {copy.title}
        </h3>
        {onDismiss && (
          <TooltipIconButton onClick={onDismiss} side="top" tooltip={t.assistant.thread.dismissError}>
            <Codicon name="close" size="0.875rem" />
          </TooltipIconButton>
        )}
      </div>
      <div className="space-y-3 px-3.5 py-3">
        <p className="wrap-anywhere text-(--ui-text-secondary)" id={descriptionId}>
          {chatErrorDescription(raw, copy)}
        </p>
        {raw.trim() && (
          <details className="text-xs text-(--ui-text-tertiary)">
            <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
              {copy.details}
            </summary>
            <LogView className="mt-2 max-h-48" dir="auto">
              {raw}
            </LogView>
          </details>
        )}
      </div>
    </div>
  )
}
