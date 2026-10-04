import { useStore } from '@nanostores/react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink, RefreshCw, Save } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { $gatewayRestarting, runGatewayRestart } from '@/store/system-actions'
import { getCronJobs, type MessagingPlatformInfo, type PairingUser, updateMessagingPlatform } from '@/work4you'

import { CRON_ROUTE } from '../routes'
import { ListRow } from '../settings/primitives'

import { pairingKey, pairingLabel } from './channel-fields'
import { detailStatus, ToneDot } from './channel-status'
import { ChoiceList, STEP_NOTE } from './channel-steps'

/** The shared pieces of a channel's settings page — the page a channel shows
 *  once it is set up: Connection, Who can talk, What the bot does here,
 *  Advanced (collapsed) and the Channel active switch. Every action is one the
 *  page already had: the channel update, the connection test, the gateway
 *  restart, pairing approve/revoke. */

export interface PlatformDetailProps {
  approved: PairingUser[]
  approving: null | string
  edits: Record<string, string>
  fieldErrors: Record<string, string>
  hasEdits: boolean
  onApprove: (user: PairingUser) => void
  onClear: (key: string) => void
  onEdit: (key: string, value: string) => void
  onQuickSetupApplied: () => void
  onRevoke: (user: PairingUser) => void
  onSave: () => void
  onTest: () => void
  onToggle: (enabled: boolean) => void
  pending: PairingUser[]
  platform: MessagingPlatformInfo
  saving: string | null
  scopeProfile: null | string
}

export const BLOCK_CLASS = 'rounded-xl border border-(--ui-stroke-quaternary) px-4 py-3.5'
export const BLOCK_TITLE = 'text-[0.72rem] font-medium text-(--ui-text-tertiary)'
export const BLOCK_ROW = 'flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.84375rem] text-foreground'

export const splitList = (value: string) =>
  value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)

/** A saved non-secret value as the backend mirrors it back (secrets come
 *  back redacted, so this is only for allowlists, modes and the like). */
export const envValue = (platform: MessagingPlatformInfo, key: string) =>
  platform.env_vars.find(field => field.key === key)?.value ?? ''

export function SettingsBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={BLOCK_CLASS}>
      <h3 className={cn('mb-2.5', BLOCK_TITLE)}>{title}</h3>
      {children}
    </section>
  )
}

/** Routines (enabled cron jobs) whose delivery reaches this channel: an
 *  explicit `<platform>` / `<platform>:<chat>` target, or `all` when the
 *  channel has a home chat. Read-only, from the same list the Routines page
 *  shows. */
export function useDeliveringRoutines(platformId: string, homeChannel: boolean, profile: null | string): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const delivers = (deliver: null | string | undefined) =>
      (deliver ?? '')
        .split(',')
        .map(part => part.trim().toLowerCase())
        .some(part => (part === 'all' ? homeChannel : part.split(':', 1)[0] === platformId))

    getCronJobs(profile ?? undefined)
      .then(jobs => {
        if (!cancelled) {
          setCount(jobs.filter(job => job.enabled && delivers(job.deliver)).length)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [homeChannel, platformId, profile])

  return count
}

/** The Connection block's one line: the channel's real state, how long it has
 *  held it when connected, and the actions that state calls for. */
export function ConnectionRow({
  actions,
  children,
  connectedLabel,
  meta,
  onRunSteps,
  onTest,
  platform,
  restartButton = 'reconnect',
  testing
}: {
  /** Buttons before the test (copy the address other programs call). */
  actions?: ReactNode
  /** Extra lines under the status (an endpoint to copy, a listener URL). */
  children?: ReactNode
  /** What "connected" means for this channel; defaults to receiving messages. */
  connectedLabel?: string
  /** A fact shown before "since …" (the bot's handle, the mailbox). */
  meta?: string
  onRunSteps: () => void
  onTest: () => void
  platform: MessagingPlatformInfo
  /** `reconnect` reads Reconnect while all is well (a chat channel's
   *  session); `restart` always reads Restart gateway (an endpoint has no
   *  session to reconnect, only a listener the restart brings back). */
  restartButton?: 'reconnect' | 'restart'
  testing: boolean
}) {
  const { locale, t } = useI18n()
  const m = t.messaging
  const restarting = useStore($gatewayRestarting)
  const connected = platform.enabled && platform.state === 'connected' && platform.gateway_running
  const status = detailStatus(platform, m)

  const needsRestart =
    platform.enabled &&
    platform.configured &&
    (!platform.gateway_running || platform.state === 'pending_restart' || platform.state === 'startup_failed')

  const since = (() => {
    if (!connected || !platform.updated_at) {
      return null
    }

    const at = new Date(platform.updated_at)

    if (Number.isNaN(at.getTime())) {
      return null
    }

    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short'
    }).format(at)
  })()

  // What to do next when the channel is not up, as the other channels' hint
  // says it; the restart it may call for is the button on the row.
  const hint = !platform.enabled
    ? platform.configured
      ? m.hintEnableToConnect
      : null
    : platform.state === 'pending_restart'
      ? m.hintPendingRestart
      : platform.configured && !platform.gateway_running
        ? m.hintGatewayStopped
        : null

  const facts = [connected ? meta : null, since ? m.connectedSince(since) : null].filter(Boolean).join(' · ')

  return (
    <>
      <div className={BLOCK_ROW}>
        <ToneDot tone={status.tone} />
        <span>
          {connected ? (connectedLabel ?? m.connectedListening) : platform.enabled ? status.label : m.channelOff}
        </span>
        {facts && <span className="text-xs text-(--ui-text-tertiary)">{facts}</span>}
        <span className="flex-1" />
        {actions}
        {platform.enabled && !platform.configured && (
          <Button onClick={onRunSteps} size="xs" variant="text">
            {m.runSetupSteps}
          </Button>
        )}
        {platform.configured && platform.enabled && platform.gateway_running && (
          <Button disabled={testing} onClick={onTest} size="xs" variant="text">
            {testing ? m.testing : m.testConnection}
          </Button>
        )}
        {platform.configured && platform.enabled && (
          <Button disabled={restarting} onClick={() => void runGatewayRestart()} size="xs" variant="text">
            {restarting
              ? m.restartingGateway
              : needsRestart || restartButton === 'restart'
                ? m.restartGateway
                : m.reconnect}
          </Button>
        )}
      </div>
      {hint && <p className="mt-2 text-xs leading-4 text-(--ui-text-tertiary)">{hint}</p>}
      {platform.error_message && <p className="mt-2 text-xs leading-4 text-destructive">{platform.error_message}</p>}
      {children}
    </>
  )
}

/** "Who can talk" in one line: who gets a reply, the ids when there is a
 *  list, and Edit. */
export function WhoSummaryRow({ detail, onEdit, summary }: { detail?: string; onEdit: () => void; summary: string }) {
  const { t } = useI18n()

  return (
    <div className={BLOCK_ROW}>
      <span>{summary}</span>
      {detail && <span className="min-w-0 text-xs text-(--ui-text-tertiary) [overflow-wrap:anywhere]">{detail}</span>}
      <span className="flex-1" />
      <Button onClick={onEdit} size="xs" variant="text">
        {t.messaging.edit}
      </Button>
    </div>
  )
}

/** The people waiting for approval, and the people already approved behind
 *  Show. Rendered only when someone is actually there. */
export function PairingRows({
  approved,
  approving,
  onApprove,
  onRevoke,
  pending
}: {
  approved: PairingUser[]
  approving: null | string
  onApprove: (user: PairingUser) => void
  onRevoke: (user: PairingUser) => void
  pending: PairingUser[]
}) {
  const { t } = useI18n()
  const m = t.messaging
  const [showApproved, setShowApproved] = useState(false)

  return (
    <>
      {pending.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-(--ui-text-tertiary)">{m.pendingRequests(pending.length)}</div>
          <div className="mt-1 grid gap-1">
            {pending.map(user => {
              const busy = approving === pairingKey(user)
              const waited = typeof user.age_minutes === 'number' ? m.waitingSince(user.age_minutes) : null

              return (
                <ListRow
                  action={
                    <Button
                      disabled={busy || !user.request_id}
                      onClick={() => onApprove(user)}
                      size="sm"
                      variant="secondary"
                    >
                      {busy ? m.approving : m.approve}
                    </Button>
                  }
                  description={[user.user_name ? user.user_id : null, waited].filter(Boolean).join(' · ')}
                  key={pairingKey(user)}
                  title={pairingLabel(user)}
                />
              )
            })}
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-xs text-(--ui-text-tertiary)">
            {m.approvedCount(approved.length)}
            <Button onClick={() => setShowApproved(value => !value)} size="inline" variant="text">
              {showApproved ? m.hide : m.show}
            </Button>
          </div>
          {showApproved && (
            <div className="mt-1 grid gap-1">
              {approved.map(user => (
                <ListRow
                  action={
                    <Button
                      aria-label={m.revokeAria(pairingLabel(user))}
                      onClick={() => onRevoke(user)}
                      size="sm"
                      variant="ghost"
                    >
                      {m.revoke}
                    </Button>
                  }
                  description={user.user_name ? user.user_id : undefined}
                  key={pairingKey(user)}
                  title={pairingLabel(user)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

/** The second answer of "Who can talk" besides a list: approve people as
 *  they message (the allowlist cleared, so unknown senders get a pairing
 *  code) or everyone (the allowlist's `*`). */
export interface AllowlistAlternative {
  description: string
  id: 'approve' | 'everyone'
  title: string
}

/** The Edit of "Who can talk": the list, or the channel's other answer when
 *  it has one. Saves through the same channel update the raw settings use. */
export function AllowlistEditor({
  allowEmpty = false,
  allowed,
  alternative,
  envKey,
  label,
  listDescription,
  listTitle,
  onCancel,
  onSaved,
  placeholder,
  platform,
  requiredMessage,
  scopeProfile,
  validate
}: {
  /** An empty list is an answer of its own here (everyone who writes gets
   *  a code), so saving it clears the list instead of asking for one. */
  allowEmpty?: boolean
  allowed: string[]
  alternative?: AllowlistAlternative
  envKey: string
  label: string
  listDescription: string
  listTitle: string
  onCancel: () => void
  onSaved: () => void
  placeholder: string
  platform: MessagingPlatformInfo
  requiredMessage: string
  scopeProfile: null | string
  /** The first invalid entry's message, or null when the list is fine. */
  validate: (list: string) => null | string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const everyone = allowed.length === 1 && allowed[0] === '*'

  // What is saved now: `*` is everyone; an empty list is approving people
  // only where that is the channel's answer (elsewhere it lets nobody in, and
  // the list is what needs filling).
  const [choice, setChoice] = useState<'list' | AllowlistAlternative['id']>(
    everyone && alternative?.id === 'everyone'
      ? 'everyone'
      : allowed.length === 0 && alternative?.id === 'approve'
        ? 'approve'
        : 'list'
  )

  const [entries, setEntries] = useState(everyone ? '' : allowed.join(', '))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    const list = splitList(entries).join(',')

    if (choice === 'list') {
      if (!list && !allowEmpty) {
        setError(requiredMessage)

        return
      }

      const invalid = list ? validate(list) : null

      if (invalid) {
        setError(invalid)

        return
      }
    }

    setBusy(true)

    try {
      if (choice === 'list' && list) {
        await updateMessagingPlatform(platform.id, { env: { [envKey]: list } }, scopeProfile)
      } else if (choice === 'list') {
        if (allowed.length > 0) {
          await updateMessagingPlatform(platform.id, { clear_env: [envKey] }, scopeProfile)
        }
      } else if (choice === 'everyone') {
        await updateMessagingPlatform(platform.id, { env: { [envKey]: '*' } }, scopeProfile)
      } else if (allowed.length > 0) {
        await updateMessagingPlatform(platform.id, { clear_env: [envKey] }, scopeProfile)
      }

      notify({
        kind: 'success',
        title: m.setupSaved(platform.name),
        message: m.restartToReconnect,
        action: { label: t.commandCenter.restartGateway, onClick: () => void runGatewayRestart() }
      })
      onSaved()
    } catch (err) {
      notifyError(err, m.failedSave(platform.name))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <ChoiceList
        label={label}
        onChange={next => {
          setChoice(next)
          setError('')
        }}
        options={[
          {
            description: listDescription,
            extra: (
              <Input
                aria-label={listTitle}
                className="mt-2.5 h-8 font-mono text-[0.78rem]"
                onChange={event => {
                  setEntries(event.target.value)
                  setError('')
                }}
                placeholder={placeholder}
                value={entries}
              />
            ),
            id: 'list' as const,
            title: listTitle
          },
          ...(alternative ? [alternative] : [])
        ]}
        value={choice}
      />
      {error && <p className="text-xs leading-4 text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button disabled={busy} onClick={onCancel} size="sm" variant="outline">
          {t.common.cancel}
        </Button>
        <Button disabled={busy} onClick={() => void save()} size="sm">
          {busy ? m.saving : t.common.save}
        </Button>
      </div>
    </div>
  )
}

/** A block's line of facts — each a name and, when there is one, what is
 *  saved — joined by dots, with the one action that changes them. */
export function FactsRow({ action, facts }: { action?: ReactNode; facts: { label: string; value?: string }[] }) {
  return (
    <div className={BLOCK_ROW}>
      {facts.map((fact, index) => (
        <span className="contents" key={fact.label}>
          {index > 0 && <span className="text-(--ui-text-quaternary)">·</span>}
          <span>{fact.label}</span>
          {fact.value && (
            <span className="min-w-0 text-xs text-(--ui-text-tertiary) [overflow-wrap:anywhere]">{fact.value}</span>
          )}
        </span>
      ))}
      <span className="flex-1" />
      {action}
    </div>
  )
}

/** The Replace / Edit of one saved value: its input (with Generate when it is
 *  a secret Work4You can make), the check, Cancel and Save through the same
 *  channel update the raw settings use. An optional value emptied here is
 *  cleared. */
export function EnvValueEditor({
  envKey,
  generate,
  help,
  isSet,
  label,
  onCancel,
  onSaved,
  placeholder,
  platform,
  requiredMessage,
  scopeProfile,
  validate,
  value: savedValue = ''
}: {
  envKey: string
  /** Makes a strong value (a key, a secret), with its button's label. */
  generate?: { label: string; make: () => string }
  help?: ReactNode
  /** Something is saved now, so an emptied optional value clears it. */
  isSet: boolean
  label: string
  onCancel: () => void
  onSaved: () => void
  placeholder?: string
  platform: MessagingPlatformInfo
  /** Given when the value cannot be empty: what to enter instead. */
  requiredMessage?: string
  scopeProfile: null | string
  /** The value's problem, or null when it is fine. */
  validate?: (value: string) => null | string
  /** What is saved now, when it is not a secret. */
  value?: string
}) {
  const { t } = useI18n()
  const m = t.messaging
  const [value, setValue] = useState(savedValue)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    const trimmed = value.trim()

    if (!trimmed && requiredMessage) {
      setError(requiredMessage)

      return
    }

    const invalid = trimmed && validate ? validate(trimmed) : null

    if (invalid) {
      setError(invalid)

      return
    }

    if (!trimmed && !isSet) {
      onCancel()

      return
    }

    setBusy(true)

    try {
      await updateMessagingPlatform(
        platform.id,
        trimmed ? { env: { [envKey]: trimmed } } : { clear_env: [envKey] },
        scopeProfile
      )
      notify({
        kind: 'success',
        title: m.setupSaved(platform.name),
        message: m.restartToReconnect,
        action: { label: t.commandCenter.restartGateway, onClick: () => void runGatewayRestart() }
      })
      onSaved()
    } catch (err) {
      notifyError(err, m.failedSave(platform.name))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-[0.78125rem] font-medium text-(--ui-text-secondary)">{label}</div>
      <div className="flex items-center gap-2">
        <Input
          aria-label={label}
          className="h-8 max-w-[35rem] font-mono text-[0.78rem]"
          onChange={event => {
            setValue(event.target.value)
            setError('')
          }}
          placeholder={placeholder}
          value={value}
        />
        {generate && (
          <Button
            className="shrink-0"
            onClick={() => {
              setValue(generate.make())
              setError('')
            }}
            size="sm"
            variant="outline"
          >
            <RefreshCw />
            {generate.label}
          </Button>
        )}
      </div>
      {help ? <p className={cn('max-w-[38.75rem]', STEP_NOTE)}>{help}</p> : null}
      {error && <p className="text-xs leading-4 text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button disabled={busy} onClick={onCancel} size="sm" variant="outline">
          {t.common.cancel}
        </Button>
        <Button disabled={busy} onClick={() => void save()} size="sm">
          {busy ? m.saving : t.common.save}
        </Button>
      </div>
    </div>
  )
}

/** "What the bot does here": the things it does on this channel, joined by
 *  dots, and the way to the Routines page. */
export function BotDoesHereRow({ items }: { items: string[] }) {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <div className={BLOCK_ROW}>
      {items.map((item, index) => (
        <span className="contents" key={item}>
          {index > 0 && <span className="text-(--ui-text-quaternary)">·</span>}
          <span>{item}</span>
        </span>
      ))}
      <span className="flex-1" />
      <Button onClick={() => navigate(CRON_ROUTE)} size="xs" variant="text">
        {t.messaging.manageRoutines}
      </Button>
    </div>
  )
}

/** The collapsed Advanced block: its title and what it holds, then the raw
 *  settings once opened. */
export function AdvancedSection({
  children,
  hint,
  onOpenChange,
  open
}: {
  children: ReactNode
  hint: string
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useI18n()

  return (
    <section className={BLOCK_CLASS}>
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
        onClick={() => onOpenChange(!open)}
        type="button"
      >
        <span className={BLOCK_TITLE}>{t.messaging.advancedTitle}</span>
        <span className="text-xs text-(--ui-text-quaternary)">{hint}</span>
        <span className="flex-1" />
        <Codicon
          className={cn('text-(--ui-text-tertiary) transition-transform', open && 'rotate-180')}
          name="chevron-down"
          size="0.875rem"
        />
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  )
}

/** The Advanced block's footer: the setup guide, running the steps again, and
 *  saving raw edits. */
export function AdvancedActions({
  extra,
  hasEdits,
  onRunSteps,
  onSave,
  platform,
  saving
}: {
  /** More buttons beside the guide (a manifest to copy, a page to open). */
  extra?: ReactNode
  hasEdits: boolean
  onRunSteps: () => void
  onSave: () => void
  platform: MessagingPlatformInfo
  saving: string | null
}) {
  const { t } = useI18n()
  const m = t.messaging
  const isSaving = saving === `env:${platform.id}`

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {platform.docs_url && (
        <Button asChild size="xs" variant="text">
          <a
            href={platform.docs_url}
            onClick={event => {
              event.preventDefault()
              openExternalLink(platform.docs_url)
            }}
            rel="noreferrer"
            target="_blank"
          >
            {m.openSetupGuide}
            <ExternalLink />
          </a>
        </Button>
      )}
      {extra}
      <Button onClick={onRunSteps} size="xs" variant="text">
        {m.runStepsAgain}
      </Button>
      <span className="flex-1" />
      {hasEdits && (
        <>
          <span className="text-xs text-muted-foreground">{m.unsavedChanges}</span>
          <Button disabled={isSaving} onClick={onSave} size="sm">
            <Save />
            {isSaving ? m.saving : m.saveChanges}
          </Button>
        </>
      )}
    </div>
  )
}

/** The page's last line: the channel's on/off switch, labeled, with what
 *  turning it off does. */
export function ChannelActiveRow({
  hint,
  onToggle,
  platform,
  saving
}: {
  hint: string
  onToggle: (enabled: boolean) => void
  platform: MessagingPlatformInfo
  saving: string | null
}) {
  const { t } = useI18n()
  const m = t.messaging

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1.5">
      <Switch
        aria-label={platform.enabled ? m.disableAria(platform.name) : m.enableAria(platform.name)}
        checked={platform.enabled}
        disabled={saving === `enabled:${platform.id}`}
        onCheckedChange={onToggle}
        size="xs"
      />
      <span className="text-[0.84375rem] text-foreground">{m.channelActive}</span>
      <span className="text-xs text-(--ui-text-tertiary)">{hint}</span>
    </div>
  )
}
