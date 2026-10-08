import { useStore } from '@nanostores/react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { chatErrorDescription } from '@/lib/chat-error-presentation'
import { $billingBlock, billingCtaLabel, clearBillingBlock, runBillingRecovery } from '@/store/billing-block'

/**
 * Persistent billing notice for THIS session, above the composer. It never
 * disables the composer — slash commands (`/topup`, `/model`, `/login`) stay
 * usable — it only offers recovery: Work4You opens Settings → Billing in-app, other
 * providers deep-link out. The sticky toast is the loud surface; this is the calm
 * reminder that outlives it.
 */
export function BillingBanner({ sessionId }: { sessionId: null | string }) {
  const active = useStore($billingBlock)
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()

  if (!active || !sessionId || active.sessionId !== sessionId) {
    return null
  }

  const { block } = active
  const copy = t.billingBlock
  const title = block.is_nous ? copy.titleWork4You : copy.titleProvider(block.provider_label)
  const errorCopy = t.assistant.thread.errorCard
  const description = chatErrorDescription(block.message, errorCopy)
  const message = description === errorCopy.generic ? errorCopy.billing : description

  return (
    <section
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="flex min-w-0 items-start gap-3 rounded-(--card-radius) border border-(--ui-stroke-tertiary) bg-(--ui-bg-quaternary) px-3.5 py-3"
      data-slot="composer-billing-notice"
    >
      <Codicon className="mt-0.5 shrink-0 text-destructive" name="credit-card" size="1.125rem" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="wrap-anywhere text-sm leading-5 font-medium text-(--ui-text-primary)" id={titleId}>
          {title}
        </h3>
        <p className="wrap-anywhere text-sm leading-5 text-(--ui-text-secondary)" id={descriptionId}>
          {message}
        </p>
        <div>
          <Button onClick={() => runBillingRecovery(block)} size="sm" type="button" variant="outline">
            {billingCtaLabel(block, copy)}
          </Button>
        </div>
      </div>
      <Tip label={copy.dismiss}>
        <Button
          aria-label={copy.dismiss}
          onClick={() => clearBillingBlock(sessionId)}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Codicon name="close" size="0.875rem" />
        </Button>
      </Tip>
    </section>
  )
}
