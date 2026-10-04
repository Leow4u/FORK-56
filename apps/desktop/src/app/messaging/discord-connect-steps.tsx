import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Check, ExternalLink } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { updateMessagingPlatform } from '@/work4you'

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
  StepsFrame,
  UrlRow
} from './channel-steps'
import {
  decodeDiscordApplicationId,
  DISCORD_BOT_TOKEN_RE,
  discordInviteUrl,
  normalizeDiscordBotToken
} from './discord-token'
import { findInvalidDiscordUser } from './validate-env'

/** Who the person said will use the bot: only them, or people in their
 *  server. */
type Audience = 'me' | 'others'

type Step = 'create' | 'invite' | 'ready' | 'talk' | 'who'

/** Who gets a reply once other people are let in: the ids on a list, or
 *  everyone the bot can see (the allowlist's `*`). Discord sends no approval
 *  codes, so there is no third answer. */
type AllowChoice = 'everyone' | 'list'

type Phase = 'applied' | 'applying' | 'idle'

export const DISCORD_PORTAL_URL = 'https://discord.com/developers/applications'

/** The first connection of Discord, one question per screen: who will use
 *  it, the bot token from the Developer Portal (the application id read out
 *  of it), the intents and the server invite, who may talk to the bot, and a
 *  ready screen. One save through the channel update — token and allowlist,
 *  the channel on — then the gateway restart. */
export function DiscordConnectSteps({
  onApplied,
  onDone,
  platformConnected,
  scopeProfile
}: {
  /** The setup was saved; the channel list should be refreshed. */
  onApplied: () => void
  /** Done on the ready screen. */
  onDone: () => void
  /** The channel list reports Discord on and connected. */
  platformConnected: boolean
  scopeProfile: null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.discordPage
  const c = m.channelSteps
  const cs = m.channelSettings

  const [audience, setAudience] = useState<Audience | null>(null)
  const [step, setStep] = useState<Step>('who')
  const [token, setToken] = useState('')
  const [ids, setIds] = useState('')
  const [allowChoice, setAllowChoice] = useState<AllowChoice>('list')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState<RestartState>({ outcome: 'pending' })

  const normalizedToken = normalizeDiscordBotToken(token)
  const tokenOk = DISCORD_BOT_TOKEN_RE.test(normalizedToken)
  const applicationId = tokenOk ? decodeDiscordApplicationId(normalizedToken) : null
  // Tokens are pasted, not typed: a value that fails the shape check is a
  // paste mistake worth saying at once.
  const tokenError = normalizedToken && !tokenOk ? m.envErrors.discordToken : ''

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: 'who', label: s.stepWho },
      { id: 'create', label: s.stepCreate },
      { id: 'invite', label: s.stepInvite },
      { id: 'talk', label: s.stepTalk },
      { id: 'ready', label: s.stepReady }
    ],
    [s]
  )

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
    const invalid = findInvalidDiscordUser(list.filter(id => id !== '*').join(','))

    if (invalid || list.includes('*')) {
      return { error: m.envErrors.discordUserId(invalid ?? '*') }
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
        'discord',
        { enabled: true, env: { DISCORD_ALLOWED_USERS: allowed.value, DISCORD_BOT_TOKEN: normalizedToken } },
        scopeProfile
      )
      setPhase('applied')
      onApplied()
      setRestart({ outcome: 'pending' })
      setRestart(await restartAndWatch())
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
            placeholder="284102345678901234, 284109876543210987"
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
    <StepsFrame current={step} slot="discord-connect-steps" steps={steps}>
      {step === 'who' && (
        <StepPanel note={s.whoNote} title={s.whoTitle}>
          <ChoiceList label={s.whoTitle} onChange={setAudience} options={audienceOptions} value={audience} />
          <StepFooter next={{ disabled: !audience, label: c.next, onClick: () => setStep('create') }} />
        </StepPanel>
      )}

      {step === 'create' && (
        <StepPanel note={s.createNote} title={s.createTitle}>
          <ol className="mt-0.5 list-decimal space-y-2 pl-[1.125rem] text-[0.8125rem] leading-5 text-(--ui-text-secondary)">
            <li>
              <Marked text={s.createStep1} />
            </li>
            <li>
              <Marked text={s.createStep2} />
            </li>
          </ol>
          <StepField
            action={
              <Button onClick={() => openExternalLink(DISCORD_PORTAL_URL)} size="sm" variant="outline">
                <ExternalLink />
                {s.openPortal}
              </Button>
            }
            help={s.tokenHelp}
            label={s.tokenLabel}
            onChange={event => setToken(event.target.value)}
            placeholder="MTI4NzQ0…"
            type="password"
            value={token}
          />
          {tokenError ? (
            <p className="mt-3 text-xs leading-4 text-destructive">{tokenError}</p>
          ) : applicationId ? (
            <p className="mt-4 flex items-center gap-2 text-[0.78rem] leading-5 text-foreground">
              <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-background">
                <Check className="size-2.5" />
              </span>
              {s.tokenRead(applicationId)}
            </p>
          ) : null}
          <StepFooter
            back={back('who')}
            next={{ disabled: !tokenOk, label: c.next, onClick: () => setStep('invite') }}
          />
        </StepPanel>
      )}

      {step === 'invite' && (
        <StepPanel note={s.inviteNote} title={s.inviteTitle}>
          <ol className="mt-0.5 list-decimal space-y-2 pl-[1.125rem] text-[0.8125rem] leading-5 text-(--ui-text-secondary)">
            <li>
              <Marked text={s.inviteStep1} />
            </li>
            <li>{s.inviteStep2}</li>
          </ol>
          {applicationId && (
            <>
              <UrlRow copyLabel={s.copyLink} url={discordInviteUrl(applicationId)} />
              <div className="mt-3 flex items-center gap-2">
                <Button onClick={() => openExternalLink(discordInviteUrl(applicationId))} size="sm" variant="outline">
                  <ExternalLink />
                  {s.openInvite}
                </Button>
              </div>
            </>
          )}
          <StepFooter back={back('create')} next={{ label: c.next, onClick: () => setStep('talk') }} />
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
            placeholder="284102345678901234"
            value={ids}
          />
          {errorLine}
          <StepFooter back={back('invite')} next={{ label: c.next, onClick: () => void finish() }} />
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
          <StepFooter back={back('invite')} next={{ label: c.next, onClick: () => void finish() }} />
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
          note={phase === 'applied' ? <Marked className="text-(--ui-text-secondary)" text={s.tryIt} /> : undefined}
          title={phase === 'applying' ? s.readySaving : platformConnected ? s.readyTitle : s.readySetUp}
        >
          <ReadyLine done>{s.checkTokenSaved}</ReadyLine>
          {phase === 'applied' && <RestartLine restart={restart} />}
          <ReadyLine done>{whoLine}</ReadyLine>
        </ReadyView>
      )}
    </StepsFrame>
  )
}
