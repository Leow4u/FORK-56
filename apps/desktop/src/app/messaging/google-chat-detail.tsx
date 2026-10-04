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
import { googleChatMode } from './google-chat-config'
import { GoogleChatConnectSteps } from './google-chat-connect-steps'
import { findInvalidEmailSender } from './validate-env'

/** Google Chat's page: the step-by-step first connection until the channel
 *  is set up, then its settings as four blocks — Connection (with the mode
 *  events arrive by), Who can talk, What the bot does here, Advanced — over
 *  the "Channel active" switch. */
export function GoogleChatDetail({
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
  const s = m.googleChatPage
  const cs = m.channelSettings
  // First connection: nothing saved and the channel off. Once set up the page
  // is the channel's settings, and the steps can be run again. Local state,
  // so a list refresh behind the steps never dismisses them.
  const [steps, setSteps] = useState(!platform.enabled && !platform.configured)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)
  const routines = useDeliveringRoutines(platform.id, Boolean(platform.home_channel), scopeProfile)

  // Listed people get in at once; anyone else who DMs the app gets a code —
  // with or without a list.
  const allowed = splitList(envValue(platform, 'GOOGLE_CHAT_ALLOWED_USERS'))

  if (steps) {
    return (
      <GoogleChatConnectSteps
        envVars={platform.env_vars}
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

  const doesHere = [
    m.botReplies,
    routines > 0 ? m.botRoutines(routines) : null,
    platform.home_channel ? m.botAlerts : null
  ].filter((item): item is string => Boolean(item))

  return (
    <div className="space-y-4">
      <SettingsBlock title={m.connectionTitle}>
        <ConnectionRow
          meta={googleChatMode(platform.env_vars) === 'pubsub' ? s.modePubsub : s.modeHttp}
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
            allowed={allowed}
            alternative={{ description: s.approveDesc, id: 'approve', title: cs.approveTitle }}
            envKey="GOOGLE_CHAT_ALLOWED_USERS"
            label={m.whoCanTalkTitle}
            listDescription={s.listDesc}
            listTitle={cs.listTitle}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              onQuickSetupApplied()
            }}
            placeholder="ana@acme.com, bruno@acme.com"
            platform={platform}
            requiredMessage={s.emailsRequired}
            scopeProfile={scopeProfile}
            validate={list => {
              const invalid = splitList(list).includes('*') ? '*' : findInvalidEmailSender(list)

              return invalid ? m.envErrors.emailAddress(invalid) : null
            }}
          />
        ) : (
          <WhoSummaryRow
            detail={allowed.length > 0 ? allowed.join(', ') : undefined}
            onEdit={() => setEditing(true)}
            summary={allowed.length > 0 ? cs.whoOnlyPeople(allowed.length) : cs.whoApprove}
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
          fields={platform.env_vars.filter(field => field.key !== 'GOOGLE_CHAT_ALLOWED_USERS')}
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
