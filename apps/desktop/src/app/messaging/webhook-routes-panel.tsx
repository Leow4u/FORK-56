import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Copy, Globe } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { $profileScope } from '@/store/profile'
import { getWebhooks } from '@/work4you'

/** Bridge panel between the Messaging card and the real management surface.
 *
 *  The webhook channel is the only one whose setup does NOT live on this card:
 *  routes (named endpoints, each with its own URL + HMAC secret) are created
 *  and managed on the dedicated Webhooks page. Before this panel the card
 *  pointed users at external docs while the in-app manager sat one click away
 *  behind a statusbar icon — enabling the channel here left a listener running
 *  with zero routes and nothing saying where to create one. */
export function WebhookRoutesPanel({ onManageRoutes }: { onManageRoutes: () => void }) {
  const { t } = useI18n()
  const m = t.messaging
  const q = m.webhookRoutesPanel
  const profileScope = useStore($profileScope)

  const { data } = useQuery({
    queryKey: ['webhooks', profileScope],
    queryFn: getWebhooks
  })

  const activeRoutes = useMemo(() => (data?.subscriptions ?? []).filter(route => route.enabled).length, [data])
  const totalRoutes = data?.subscriptions.length ?? 0

  async function copyBaseUrl() {
    if (!data?.base_url) {
      return
    }

    try {
      await navigator.clipboard.writeText(data.base_url)
      notify({ kind: 'success', message: q.copied })
    } catch (copyError) {
      notifyError(copyError, q.copyFailed)
    }
  }

  return (
    <section>
      <h4 className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {q.title}
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.66rem] font-medium normal-case tracking-normal text-primary">
          {q.startHere}
        </span>
      </h4>
      <p className="mt-1 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
        {q.intro}
      </p>

      <div className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
        {data && (
          <div>
            <span className="block font-medium text-foreground/80">{q.baseUrlLabel}</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{`${data.base_url}/webhooks/<route>`}</code>
              <Button onClick={() => void copyBaseUrl()} size="sm" variant="secondary">
                <Copy className="size-3.5" />
                {q.copyBaseUrl}
              </Button>
            </div>
          </div>
        )}

        <p className={totalRoutes === 0 ? 'max-w-xl text-amber-600 dark:text-amber-500' : undefined}>
          {totalRoutes === 0 ? q.noRoutes : q.routeCount(activeRoutes, totalRoutes)}
        </p>

        <p className="max-w-xl">{q.tunnelHint}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={onManageRoutes} size="sm">
          <Globe className="size-3.5" />
          {q.manageRoutes}
        </Button>
      </div>
    </section>
  )
}
