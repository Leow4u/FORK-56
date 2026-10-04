import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { ExternalLink } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { MessagingFields } from './channel-fields'
import {
  AdvancedActions,
  AdvancedSection,
  AllowlistEditor,
  BLOCK_TITLE,
  BotDoesHereRow,
  ChannelActiveRow,
  ConnectionRow,
  envValue,
  PairingRows,
  type PlatformDetailProps,
  SettingsBlock,
  splitList,
  useDeliveringRoutines,
  WhoSummaryRow
} from './channel-settings'
import { STEP_NOTE, UrlRow } from './channel-steps'
import { DiscordConnectSteps } from './discord-connect-steps'
import {
  decodeDiscordApplicationId,
  DISCORD_BOT_TOKEN_RE,
  discordInviteUrl,
  normalizeDiscordBotToken
} from './discord-token'
import { findInvalidDiscordUser } from './validate-env'

/** Discord's page: the step-by-step first connection until the channel is
 *  set up, then its settings as four blocks — Connection, Who can talk,
 *  What the bot does here, Advanced — over the "Channel active" switch. */
export function DiscordDetail({
  approved,
  approving,
  edits,
  fieldErrors,
  hasEdits,
  onApprove,
  onClear,
  onEdit,
  onQuickSetupApplied,
  onRevoke,
  onSave,
  onTest,
  onToggle,
  pending,
  platform,
  saving,
  scopeProfile
}: PlatformDetailProps) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.discordPage
  const cs = m.channelSettings
  // First connection: no token saved and the channel off. Once set up the
  // page is the channel's settings, and the steps can be run again from it.
  // Local state, so a list refresh behind the steps never dismisses them.
  const [steps, setSteps] = useState(!platform.enabled && !platform.configured)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)
  const routines = useDeliveringRoutines(platform.id, Boolean(platform.home_channel), scopeProfile)

  // Discord fails closed: with no list nobody gets a reply, and it sends no
  // approval codes. `*` lets everyone the bot can see in.
  const allowed = splitList(envValue(platform, 'DISCORD_ALLOWED_USERS'))
  const everyone = allowed.includes('*')

  // The saved token comes back redacted, so the invite link can only be
  // built again from a token typed into the Advanced field.
  const typedToken = normalizeDiscordBotToken(edits.DISCORD_BOT_TOKEN ?? '')
  const applicationId = DISCORD_BOT_TOKEN_RE.test(typedToken) ? decodeDiscordApplicationId(typedToken) : null

  if (steps) {
    return (
      <DiscordConnectSteps
        onApplied={onQuickSetupApplied}
        onDone={() => {
          setSteps(false)
          onQuickSetupApplied()
        }}
        platformConnected={platform.enabled && platform.state === 'connected'}
        scopeProfile={scopeProfile}
      />
    )
  }

  const summary = everyone ? s.everyoneTitle : allowed.length > 0 ? cs.whoOnlyPeople(allowed.length) : s.whoNone

  const doesHere = [
    m.botReplies,
    routines > 0 ? m.botRoutines(routines) : null,
    platform.home_channel ? m.botAlerts : null
  ].filter((item): item is string => Boolean(item))

  return (
    <div className="space-y-4">
      <SettingsBlock title={m.connectionTitle}>
        <ConnectionRow
          onRunSteps={() => setSteps(true)}
          onTest={onTest}
          platform={platform}
          testing={saving === `test:${platform.id}`}
        />
      </SettingsBlock>

      <SettingsBlock title={m.whoCanTalkTitle}>
        {editing ? (
          <AllowlistEditor
            allowed={allowed}
            alternative={{ description: s.everyoneDesc, id: 'everyone', title: s.everyoneTitle }}
            envKey="DISCORD_ALLOWED_USERS"
            label={m.whoCanTalkTitle}
            listDescription={s.listDesc}
            listTitle={cs.listTitle}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              onQuickSetupApplied()
            }}
            placeholder="284102345678901234, 284109876543210987"
            platform={platform}
            requiredMessage={s.idsRequired}
            scopeProfile={scopeProfile}
            validate={list => {
              const entries = splitList(list)
              const invalid = findInvalidDiscordUser(entries.filter(id => id !== '*').join(','))

              return invalid || entries.includes('*') ? m.envErrors.discordUserId(invalid ?? '*') : null
            }}
          />
        ) : (
          <WhoSummaryRow
            detail={!everyone && allowed.length > 0 ? allowed.join(', ') : undefined}
            onEdit={() => setEditing(true)}
            summary={summary}
          />
        )}
        <PairingRows
          approved={approved}
          approving={approving}
          onApprove={onApprove}
          onRevoke={onRevoke}
          pending={pending}
        />
      </SettingsBlock>

      <SettingsBlock title={m.botDoesTitle}>
        <BotDoesHereRow items={doesHere} />
      </SettingsBlock>

      <AdvancedSection hint={s.advancedHint} onOpenChange={setShowAdvanced} open={showAdvanced}>
        <MessagingFields
          edits={edits}
          fieldErrors={fieldErrors}
          fields={platform.env_vars.filter(field => field.key !== 'DISCORD_ALLOWED_USERS')}
          onClear={onClear}
          onEdit={onEdit}
          plainValues
          saving={saving}
        />
        <div>
          <span className={cn('block', BLOCK_TITLE)}>{s.inviteLabel}</span>
          {applicationId ? (
            <>
              <UrlRow copyLabel={s.copyLink} url={discordInviteUrl(applicationId)} />
              <Button
                className="mt-2"
                onClick={() => openExternalLink(discordInviteUrl(applicationId))}
                size="sm"
                variant="outline"
              >
                <ExternalLink />
                {s.openInvite}
              </Button>
            </>
          ) : (
            <p className={cn('mt-1', STEP_NOTE)}>{s.inviteHint}</p>
          )}
        </div>
        <AdvancedActions
          hasEdits={hasEdits}
          onRunSteps={() => setSteps(true)}
          onSave={onSave}
          platform={platform}
          saving={saving}
        />
      </AdvancedSection>

      <ChannelActiveRow hint={m.channelActiveHint} onToggle={onToggle} platform={platform} saving={saving} />
    </div>
  )
}
