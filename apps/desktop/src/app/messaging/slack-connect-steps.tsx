import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Copy, ExternalLink } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { getSlackManifest, updateMessagingPlatform } from '@/work4you'

import { splitList } from './channel-settings'
import {
  ChoiceList,
  type ChoiceOption,
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
  StepsFrame
} from './channel-steps'
import { validateMessagingEnv } from './validate-env'

export const SLACK_NEW_APP_URL = 'https://api.slack.com/apps?new_app=1'

/** Who the person said will use the bot: only them, or their workspace. */
type Audience = 'me' | 'others'

type Step = 'create' | 'ready' | 'talk' | 'tokens' | 'who'

/** Who gets a reply once the workspace is let in: the member ids on a list,
 *  or everyone in it (the allowlist's `*`). Slack DMs get no approval codes,
 *  so there is no third answer. */
type AllowChoice = 'everyone' | 'list'

type Phase = 'applied' | 'applying' | 'idle'

/** Copy the manifest the backend generates — every scope, event, Socket Mode
 *  and slash command — so one paste on Slack creates the whole app. */
export function useCopySlackManifest() {
  const { t } = useI18n()
  const s = t.messaging.slackPage

  return async () => {
    try {
      const { manifest } = await getSlackManifest()

      await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2))
      notify({ kind: 'success', message: s.manifestCopied })
    } catch (copyError) {
      notifyError(copyError, s.manifestCopyFailed)
    }
  }
}

/** The first connection of Slack, one question per screen: who will use it,
 *  creating the app from the generated manifest, its two tokens, who may talk
 *  to the bot, and a ready screen. One save through the channel update —
 *  tokens and allowlist, the channel on — then the gateway restart. */
export function SlackConnectSteps({
  onApplied,
  onDone,
  platformConnected,
  scopeProfile
}: {
  /** The setup was saved; the channel list should be refreshed. */
  onApplied: () => void
  /** Done on the ready screen. */
  onDone: () => void
  /** The channel list reports Slack on and connected. */
  platformConnected: boolean
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.slackPage
  const c = m.channelSteps
  const cs = m.channelSettings
  const copyManifest = useCopySlackManifest()

  const [audience, setAudience] = useState<Audience | null>(null)
  const [step, setStep] = useState<Step>('who')
  const [botToken, setBotToken] = useState('')
  const [appToken, setAppToken] = useState('')
  const [ids, setIds] = useState('')
  const [allowChoice, setAllowChoice] = useState<AllowChoice>('list')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'who', label: s.stepWho },
      { id: 'create', label: s.stepCreate },
      { id: 'tokens', label: s.stepTokens },
      { id: 'talk', label: s.stepTalk },
      { id: 'ready', label: s.stepReady }
    ],
    [s]
  )

  // Swapping the two tokens is the classic paste mistake — said at once.
  const tokenError = (key: 'SLACK_APP_TOKEN' | 'SLACK_BOT_TOKEN', value: string) => {
    const invalid = validateMessagingEnv(key, value)

    return invalid?.code === 'slackTokenPrefix' ? m.envErrors.slackTokenPrefix(invalid.prefix) : ''
  }

  const botTokenError = tokenError('SLACK_BOT_TOKEN', botToken)
  const appTokenError = tokenError('SLACK_APP_TOKEN', appToken)
  const tokensOk = Boolean(botToken.trim() && appToken.trim()) && !botTokenError && !appTokenError

  /** What the save puts in the allowlist, or a message when the answer is
   *  not usable. */
  function allowedUsers(): { error: string } | { value: string } {
    if (audience === 'others' && allowChoice === 'everyone') {
      return { value: '*' }
    }

    const list = splitList(ids)

    if (list.length === 0) {
      return { error: s.idsRequired }
    }

    // `*` is the "everyone" answer, never an entry of the list.
    const invalid = validateMessagingEnv('SLACK_ALLOWED_USERS', list.filter(id => id !== '*').join(','))

    if (invalid?.code === 'slackMemberId' || list.includes('*')) {
      return { error: m.envErrors.slackMemberId(invalid?.code === 'slackMemberId' ? invalid.value : '*') }
    }

    return { value: Array.from(new Set(list)).join(',') }
  }

  async function finish() {
    const allowed = allowedUsers()

    if ('error' in allowed) {
      setError(allowed.error)

      return
    }

    setError('')
    setPhase('applying')
    setStep('ready')

    try {
      await updateMessagingPlatform(
        'slack',
        {
          enabled: true,
          env: {
            SLACK_ALLOWED_USERS: allowed.value,
            SLACK_APP_TOKEN: appToken.trim(),
            SLACK_BOT_TOKEN: botToken.trim()
          }
        },
        scopeProfile
      )
      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      setRestart(await restartAndWatch(scopeProfile))
    } catch (saveError) {
      setPhase('idle')
      setStep('talk')
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    }
  }

  const audienceOptions: ChoiceOption<Audience>[] = [
    { description: s.meDesc, id: 'me', title: s.meTitle },
    { description: s.othersDesc, id: 'others', title: s.othersTitle }
  ]

  const allowOptions: ChoiceOption<AllowChoice>[] = [
    {
      description: s.listDesc,
      extra: (
        <>
          <Input
            aria-label={cs.listTitle}
            className="mt-2.5 h-8 font-mono text-[0.78rem]"
            onChange={event => {
              setIds(event.target.value)
              setError('')
            }}
            placeholder="U01ABC2DEF3, U04XYZ9GHI7"
            value={ids}
          />
          <span className={cn('mt-1.5 block', STEP_NOTE)}>{s.listHint}</span>
        </>
      ),
      id: 'list',
      title: cs.listTitle
    },
    { description: s.everyoneDesc, id: 'everyone', title: s.everyoneTitle }
  ]

  const whoLine =
    audience === 'me' ? s.whoMe : allowChoice === 'everyone' ? s.whoEveryone : s.whoList(new Set(splitList(ids)).size)

  const errorLine = error ? <p className="mt-3 text-xs leading-4 text-destructive">{error}</p> : null
  const back = (to: Step) => ({ label: t.common.back, onClick: () => setStep(to) })

  return (
    <StepsFrame current={step} slot="slack-connect-steps" steps={steps}>
      {step === 'who' && (
        <StepPanel note={s.whoNote} title={s.whoTitle}>
          <ChoiceList label={s.whoTitle} onChange={setAudience} options={audienceOptions} value={audience} />
          <StepFooter next={{ disabled: !audience, label: c.next, onClick: () => setStep('create') }} />
        </StepPanel>
      )}

      {step === 'create' && (
        <StepPanel note={s.createNote} title={s.createTitle}>
          <ol className="mt-0.5 list-decimal space-y-2 pl-[1.125rem] text-[0.8125rem] leading-5 text-(--ui-text-secondary)">
            <li>{s.createStep1}</li>
            <li>
              <Marked text={s.createStep2} />
            </li>
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => void copyManifest()} size="sm" variant="outline">
              <Copy />
              {s.copyManifest}
            </Button>
            <Button onClick={() => openExternalLink(SLACK_NEW_APP_URL)} size="sm" variant="outline">
              <ExternalLink />
              {s.createApp}
            </Button>
          </div>
          <StepFooter back={back('who')} next={{ label: c.next, onClick: () => setStep('tokens') }} />
        </StepPanel>
      )}

      {step === 'tokens' && (
        <StepPanel note={s.tokensNote} title={s.tokensTitle}>
          <StepField
            help={
              botTokenError ? (
                <span className="text-destructive">{botTokenError}</span>
              ) : (
                <Marked className="text-(--ui-text-secondary)" text={s.botTokenHelp} />
              )
            }
            label={s.botTokenLabel}
            onChange={event => setBotToken(event.target.value)}
            placeholder="xoxb-…"
            type="password"
            value={botToken}
          />
          <StepField
            help={
              appTokenError ? (
                <span className="text-destructive">{appTokenError}</span>
              ) : (
                <Marked className="text-(--ui-text-secondary)" text={s.appTokenHelp} />
              )
            }
            label={s.appTokenLabel}
            onChange={event => setAppToken(event.target.value)}
            placeholder="xapp-…"
            type="password"
            value={appToken}
          />
          <StepFooter
            back={back('create')}
            next={{ disabled: !tokensOk, label: c.next, onClick: () => setStep('talk') }}
          />
        </StepPanel>
      )}

      {step === 'talk' && audience === 'me' && (
        <StepPanel note={s.meIdNote} title={s.meIdTitle}>
          <StepField
            label={s.meIdLabel}
            onChange={event => {
              setIds(event.target.value)
              setError('')
            }}
            placeholder="U01ABC2DEF3"
            value={ids}
          />
          {errorLine}
          <StepFooter back={back('tokens')} next={{ label: c.next, onClick: () => void finish() }} />
        </StepPanel>
      )}

      {step === 'talk' && audience === 'others' && (
        <StepPanel
          note={<Marked className="text-(--ui-text-secondary)" text={s.talkNote(s.othersTitle)} />}
          title={s.talkTitle}
        >
          <ChoiceList
            label={s.talkTitle}
            onChange={choice => {
              setAllowChoice(choice)
              setError('')
            }}
            options={allowOptions}
            value={allowChoice}
          />
          {errorLine}
          <StepFooter back={back('tokens')} next={{ label: c.next, onClick: () => void finish() }} />
        </StepPanel>
      )}

      {step === 'ready' && (
        <ReadyView
          busy={phase === 'applying'}
          footer={
            <Button disabled={phase === 'applying'} onClick={onDone} size="sm">
              {t.common.done}
            </Button>
          }
          note={phase === 'applied' ? s.tryIt : undefined}
          title={phase === 'applying' ? s.readySaving : platformConnected ? s.readyTitle : s.readySetUp}
        >
          <ReadyLine done>{s.checkTokensSaved}</ReadyLine>
          {phase === 'applied' && <RestartLine restart={restart} scopeProfile={scopeProfile} />}
          <ReadyLine done>{whoLine}</ReadyLine>
        </ReadyView>
      )}
    </StepsFrame>
  )
}
