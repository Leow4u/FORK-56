import { useState } from 'react'

import { useI18n } from '@/i18n'

import { MessagingFields } from './channel-fields'
import {
  AdvancedActions,
  AdvancedSection,
  AllowlistEditor,
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
import { TelegramConnectSteps } from './telegram-connect-steps'
import { TELEGRAM_USER_ID_RE } from './validate-env'

/** Telegram's page: the step-by-step first connection until the channel is
 *  set up, then its settings as four blocks — Connection, Who can talk,
 *  What the bot does here, Advanced — over the "Channel active" switch. */
export function TelegramDetail({
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
  const s = m.telegramPage
  const cs = m.channelSettings
  // First connection: no token saved and the channel off. Once set up the
  // page is the channel's settings, and the steps can be run again from it.
  // Local state, so a list refresh behind the steps never dismisses them.
  const [steps, setSteps] = useState(!platform.enabled && !platform.configured)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)
  const routines = useDeliveringRoutines(platform.id, Boolean(platform.home_channel), scopeProfile)

  // An empty list means unknown senders get a pairing code; `*` (only ever
  // typed into .env by hand — the app saves numeric ids) lets everyone in.
  const allowed = splitList(envValue(platform, 'TELEGRAM_ALLOWED_USERS'))
  const everyone = allowed.includes('*')

  if (steps) {
    return (
      <TelegramConnectSteps
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

  const summary = everyone ? cs.whoEveryone : allowed.length > 0 ? cs.whoOnlyPeople(allowed.length) : cs.whoApprove

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
          scopeProfile={scopeProfile}
          testing={saving === `test:${platform.id}`}
        />
      </SettingsBlock>

      <SettingsBlock title={m.whoCanTalkTitle}>
        {editing ? (
          <AllowlistEditor
            allowed={everyone ? [] : allowed}
            alternative={{ description: cs.approveDesc, id: 'approve', title: cs.approveTitle }}
            envKey="TELEGRAM_ALLOWED_USERS"
            label={m.whoCanTalkTitle}
            listDescription={s.listDesc}
            listTitle={cs.listTitle}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              onQuickSetupApplied()
            }}
            placeholder="123456789, 987654321"
            platform={platform}
            requiredMessage={s.idsRequired}
            scopeProfile={scopeProfile}
            validate={list => {
              const invalid = splitList(list).find(id => !TELEGRAM_USER_ID_RE.test(id))

              return invalid ? m.envErrors.telegramUserId(invalid) : null
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
          fields={platform.env_vars.filter(field => field.key !== 'TELEGRAM_ALLOWED_USERS')}
          onClear={onClear}
          onEdit={onEdit}
          plainValues
          saving={saving}
        />
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
