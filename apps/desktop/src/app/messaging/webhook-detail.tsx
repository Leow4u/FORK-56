import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { Copy, Plus } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { setWebhookEnabled, type WebhookRoute, type WebhooksResponse } from '@/work4you'

import { WEBHOOKS_ROUTE } from '../routes'

import { MessagingFields } from './channel-fields'
import {
  AdvancedActions,
  AdvancedSection,
  BLOCK_ROW,
  BlockListRow,
  ChannelActiveRow,
  ConnectionRow,
  type PlatformDetailProps,
  SettingsBlock
} from './channel-settings'
import { useWebhookRoutes, WebhookConnectSteps, webhookQueryKey } from './webhook-connect-steps'

type View = 'listener' | 'route' | 'settings'

/** The Webhooks page: the step-by-step first setup (turn the listener on,
 *  add the first route) until there is something to show, then its settings
 *  as blocks — Listener (the address routes hang under), Routes (each with
 *  its switch), Advanced — over the "Channel active" switch. Routes are
 *  created and switched with the same calls the Webhooks page makes. */
export function WebhookDetail({
  edits,
  fieldErrors,
  hasEdits,
  onClear,
  onEdit,
  onQuickSetupApplied,
  onSave,
  onTest,
  onToggle,
  platform,
  saving,
  scopeProfile
}: PlatformDetailProps) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.webhookPage
  const w = t.webhooks
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isError } = useWebhookRoutes(scopeProfile)
  const [view, setView] = useState<null | View>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Webhooks need no credential, so "not set up yet" is the listener off with
  // no route. Decided once, when the routes are known, so a refresh behind
  // the steps (a route just created) never dismisses them.
  const known = platform.enabled || data !== undefined || isError
  const firstView: View = !platform.enabled && (data?.subscriptions.length ?? 0) === 0 ? 'listener' : 'settings'

  if (view === null && known) {
    setView(firstView)
  }

  if (view === null) {
    return null
  }

  if (view !== 'settings') {
    return (
      <WebhookConnectSteps
        listenerOn={platform.enabled}
        onApplied={onQuickSetupApplied}
        onCancel={() => setView('settings')}
        onDone={() => {
          setView('settings')
          onQuickSetupApplied()
        }}
        onManageRoutes={() => navigate(WEBHOOKS_ROUTE)}
        scopeProfile={scopeProfile}
        start={view}
      />
    )
  }

  const baseUrl = data?.base_url ?? ''
  const routes = data?.subscriptions ?? []

  const routeLine = (route: WebhookRoute) =>
    s.routeLine(
      route.events.length > 0 ? route.events.join(', ') : s.everyEvent,
      route.deliver === 'log' ? s.localLogOnly : (w.deliverOptions[route.deliver] ?? route.deliver)
    )

  async function copyBaseUrl() {
    try {
      await navigator.clipboard.writeText(baseUrl)
      notify({ kind: 'success', message: t.common.copied })
    } catch (copyError) {
      notifyError(copyError, t.common.copyFailed)
    }
  }

  async function toggleRoute(route: WebhookRoute, enabled: boolean) {
    const key = webhookQueryKey(scopeProfile)

    // Paint the switch at once; the refresh below lets the backend have the
    // last word, and a failed write rolls the switch back with it.
    queryClient.setQueryData<WebhooksResponse>(key, current =>
      current
        ? {
            ...current,
            subscriptions: current.subscriptions.map(row => (row.name === route.name ? { ...row, enabled } : row))
          }
        : current
    )

    try {
      await setWebhookEnabled(route.name, enabled, scopeProfile)
    } catch (toggleError) {
      notifyError(toggleError, w.toggleFailed(route.name, enabled))
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['webhooks'] })
    }
  }

  return (
    <div className="space-y-4">
      <SettingsBlock title={s.listenerBlock}>
        <ConnectionRow
          actions={
            baseUrl ? (
              <Button onClick={() => void copyBaseUrl()} size="xs" variant="text">
                <Copy />
                {s.copyBaseUrl}
              </Button>
            ) : null
          }
          connectedLabel={s.listeningRoutes(routes.length)}
          meta={baseUrl ? `${baseUrl}/webhooks/<route>` : undefined}
          onRunSteps={() => setView('listener')}
          onTest={onTest}
          platform={platform}
          restartButton="needed"
          scopeProfile={scopeProfile}
          testing={saving === `test:${platform.id}`}
        />
      </SettingsBlock>

      <SettingsBlock title={s.routesTitle}>
        {routes.length > 0 ? (
          <div>
            {routes.map(route => (
              <BlockListRow
                action={
                  <Switch
                    aria-label={s.toggleRoute(route.name)}
                    checked={route.enabled}
                    onCheckedChange={enabled => void toggleRoute(route, enabled)}
                    size="xs"
                  />
                }
                description={routeLine(route)}
                key={route.name}
                title={route.name}
              />
            ))}
          </div>
        ) : (
          <p className="text-[0.84375rem] text-foreground">{s.noRoutes}</p>
        )}
        <div className={cn('mt-1', BLOCK_ROW)}>
          <span className="text-xs text-(--ui-text-tertiary)">{s.routesNote}</span>
          <span className="flex-1" />
          <Button onClick={() => setView(platform.enabled ? 'route' : 'listener')} size="xs" variant="text">
            <Plus />
            {s.newRoute}
          </Button>
          <Button onClick={() => navigate(WEBHOOKS_ROUTE)} size="xs" variant="text">
            {s.manageRoutes}
          </Button>
        </div>
      </SettingsBlock>

      <AdvancedSection hint={s.advancedHint} onOpenChange={setShowAdvanced} open={showAdvanced}>
        <MessagingFields
          edits={edits}
          fieldErrors={fieldErrors}
          fields={platform.env_vars}
          onClear={onClear}
          onEdit={onEdit}
          plainValues
          saving={saving}
        />
        <AdvancedActions
          hasEdits={hasEdits}
          onRunSteps={() => setView('listener')}
          onSave={onSave}
          platform={platform}
          saving={saving}
        />
      </AdvancedSection>

      <ChannelActiveRow hint={s.activeHint} onToggle={onToggle} platform={platform} saving={saving} />
    </div>
  )
}
