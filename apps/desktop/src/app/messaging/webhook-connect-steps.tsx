import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { createWebhook, getWebhooks, updateMessagingPlatform, type WebhookCreateResponse } from '@/work4you'

import { DELIVER_OPTIONS } from '../webhooks/deliver-targets'

import { splitList } from './channel-settings'
import {
  Marked,
  ReadyLine,
  ReadyView,
  restartAndWatch,
  RestartLine,
  type RestartState,
  STEP_NOTE,
  StepField,
  StepFooter,
  StepPanel,
  StepsFrame,
  UrlField
} from './channel-steps'

type Step = 'listener' | 'ready' | 'route'

/** The address routes hang under until the backend says otherwise — the
 *  listener's default bind. */
const DEFAULT_BASE_URL = 'http://localhost:8644'

/** The webhook routes of the profile being configured, shared by the steps
 *  and the settings page (and refreshed after a route changes). */
export const webhookQueryKey = (scopeProfile: null | string) => ['webhooks', scopeProfile ?? ''] as const

export function useWebhookRoutes(scopeProfile: null | string) {
  return useQuery({ queryFn: () => getWebhooks(scopeProfile), queryKey: webhookQueryKey(scopeProfile) })
}

/** The first setup of the webhook listener, and a new route later on: turn
 *  the listener on, add a route (what arrives, what the bot does, where the
 *  result goes), and a ready screen with the route's URL and its signing
 *  secret, shown this once. The listener goes on through the channel update
 *  and the gateway restart; the route through the existing route create. */
export function WebhookConnectSteps({
  listenerOn,
  onApplied,
  onCancel,
  onDone,
  onManageRoutes,
  scopeProfile,
  start
}: {
  /** The channel is on already: the first step only moves on. */
  listenerOn: boolean
  /** Something was saved; the channel list should be refreshed. */
  onApplied: () => void
  /** Back from the route step when the steps started there. */
  onCancel?: () => void
  /** Done on the ready screen. */
  onDone: () => void
  onManageRoutes: () => void
  scopeProfile: null | string
  /** Where the steps begin: the listener (first setup) or a new route. */
  start: 'listener' | 'route'
}) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.webhookPage
  const w = t.webhooks
  const queryClient = useQueryClient()
  const { data } = useWebhookRoutes(scopeProfile)
  const deliverId = useId()

  const [step, setStep] = useState<Step>(start)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<null | RestartState>(null)
  const [name, setName] = useState('')
  const [events, setEvents] = useState('')
  const [prompt, setPrompt] = useState('')
  const [deliver, setDeliver] = useState('log')
  const [created, setCreated] = useState<null | WebhookCreateResponse>(null)

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'listener', label: s.stepListener },
      { id: 'route', label: s.stepRoute },
      { id: 'ready', label: s.stepReady }
    ],
    [s]
  )

  const baseUrl = data?.base_url || DEFAULT_BASE_URL
  // The URL the backend will make of the name: lowercase, spaces as hyphens.
  const slug = name.trim().toLowerCase().replaceAll(' ', '-')
  const target = (id: string) => (id === 'log' ? s.deliverLog : (w.deliverOptions[id] ?? id))

  const hostPort = (() => {
    try {
      return new URL(baseUrl).host
    } catch {
      return baseUrl
    }
  })()

  async function turnOn() {
    if (listenerOn) {
      setStep('route')

      return
    }

    setBusy(true)
    setError('')

    try {
      await updateMessagingPlatform('webhook', { enabled: true }, scopeProfile)
      onApplied()
      setStep('route')
      // Routes are saved while the gateway restarts; the ready screen says
      // so only if the restart went wrong.
      setRestart({ outcome: 'pending' })
      void restartAndWatch(scopeProfile).then(setRestart)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    if (!name.trim()) {
      setError(s.nameRequired)

      return
    }

    const eventList = splitList(events)

    setBusy(true)
    setError('')

    try {
      const route = await createWebhook(
        {
          deliver,
          events: eventList.length > 0 ? eventList : undefined,
          name: name.trim(),
          prompt: prompt.trim() || undefined
        },
        scopeProfile
      )

      setCreated(route)
      setStep('ready')
      void queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      onApplied()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError))
    } finally {
      setBusy(false)
    }
  }

  const errorLine = error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null

  return (
    <StepsFrame current={step} slot="webhook-connect-steps" steps={steps}>
      {step === 'listener' && (
        <StepPanel note={s.listenerNote} title={s.listenerTitle}>
          <UrlField
            copyLabel={s.copyBaseUrl}
            copyValue={baseUrl}
            label={s.patternLabel}
            url={`${baseUrl}/webhooks/<route>`}
          />
          <p className={cn('mt-2.5', STEP_NOTE)}>{s.reachNote}</p>
          {errorLine}
          <StepFooter next={{ disabled: busy, label: s.turnOn, onClick: () => void turnOn() }} />
        </StepPanel>
      )}

      {step === 'route' && (
        <StepPanel note={s.routeNote} title={(data?.subscriptions.length ?? 0) > 0 ? s.routeTitleMore : s.routeTitle}>
          <StepField
            help={s.nameHelp(`/webhooks/${slug || 'github-issues'}`)}
            label={s.nameLabel}
            onChange={event => {
              setName(event.target.value)
              setError('')
            }}
            placeholder="github-issues"
            value={name}
          />
          <StepField
            help={s.eventsHelp}
            label={s.eventsLabel}
            onChange={event => setEvents(event.target.value)}
            placeholder="issues, issue_comment"
            value={events}
          />
          <StepField
            className="font-sans text-[0.8125rem]"
            label={s.promptLabel}
            onChange={event => setPrompt(event.target.value)}
            placeholder={s.promptPlaceholder}
            value={prompt}
          />
          <div className="mt-3.5 flex flex-col gap-1.5">
            <label className="text-[0.78125rem] font-medium text-(--ui-text-secondary)" htmlFor={deliverId}>
              {s.deliverLabel}
            </label>
            <Select onValueChange={setDeliver} value={deliver}>
              <SelectTrigger className="h-8 w-full max-w-[35rem] text-[0.8125rem]" id={deliverId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVER_OPTIONS.map(option => (
                  <SelectItem key={option} value={option}>
                    {w.deliverOptions[option] ?? option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className={cn('max-w-[38.75rem]', STEP_NOTE)}>{s.deliverHelp}</span>
          </div>
          {errorLine}
          <StepFooter
            back={{
              label: t.common.back,
              onClick: () => (start === 'route' && onCancel ? onCancel() : setStep('listener'))
            }}
            next={{ disabled: busy, label: s.createRoute, onClick: () => void create() }}
          />
        </StepPanel>
      )}

      {step === 'ready' && created && (
        <ReadyView
          busy={false}
          extra={
            <>
              <UrlField copyLabel={s.copyUrl} label={s.urlLabel} url={created.url} />
              <UrlField copyLabel={s.copySecret} label={s.secretLabel} url={created.secret} />
            </>
          }
          footer={
            <>
              <Button onClick={onManageRoutes} size="sm" variant="outline">
                {s.manageRoutes}
              </Button>
              <Button onClick={onDone} size="sm">
                {t.common.done}
              </Button>
            </>
          }
          note={<Marked className="text-(--ui-text-secondary)" text={s.pasteBoth(hostPort)} />}
          title={s.readyTitle}
        >
          <ReadyLine done>
            <Marked text={s.checkRoute(created.name)} />
          </ReadyLine>
          <ReadyLine done>{s.checkSecret}</ReadyLine>
          <ReadyLine done>{s.checkDeliver(target(created.deliver))}</ReadyLine>
          {restart && (restart.outcome === 'failed' || restart.outcome === 'none') && (
            <RestartLine restart={restart} scopeProfile={scopeProfile} />
          )}
        </ReadyView>
      )}
    </StepsFrame>
  )
}
